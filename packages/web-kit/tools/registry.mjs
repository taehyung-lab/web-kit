// 파일 책임: 선택한 registry의 설치 기록과 원본/프로젝트 변경 비교를 공통으로 처리한다. UI 파일은 쓰지 않는다.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { digest, projectPath, readJson } from './files.mjs';

/** Git 출처는 명시한 원본 checkout에서 읽는다. */
function git(source, ...args) { return execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
/** 원본 정의·빌드 JSON·실제 파일이 같은 후보인지 확인한다. */
function sourceRegistry(source, version) {
  const pkg = readJson(resolve(source, 'packages/web-kit/package.json'));
  if (pkg.version !== version) throw new Error('패키지와 registry 버전이 다릅니다');
  const registry = readJson(resolve(source, 'registry.json'));
  const items = new Map(registry.items.map((item) => [item.name, item]));
  if (items.size !== registry.items.length) throw new Error('중복 registry 항목');
  return { items, version: pkg.version };
}
/**
 * 선택 항목의 내부 의존을 중복 없이 포함한다. 이름만 있는 의존(button·dialog 등)은 shadcn 공식 registry의 기본 부품이라
 * 프로젝트가 소유하는 파일이며 키트 설치 기록·지문에 넣지 않는다. 그 밖의 외부 registry 의존은 거절한다.
 */
function selection(items, selected) {
  if (!Array.isArray(selected) || selected.length === 0) throw new Error('설치한 항목을 하나 이상 선택하세요');
  const names = new Set();
  function visit(name) {
    if (names.has(name)) return;
    if (!/^[a-z0-9-]+$/.test(name) || !items.has(name)) throw new Error('없는 registry 항목: ' + name);
    names.add(name);
    for (const dep of items.get(name).registryDependencies ?? []) {
      if (/^[a-z0-9-]+$/.test(dep)) continue;
      if (!dep.startsWith('@web-kit/')) throw new Error('외부 registry 의존: ' + dep);
      visit(dep.slice('@web-kit/'.length));
    }
  }
  selected.forEach(visit);
  return [...names];
}
/** 빌드 JSON의 내용과 정의된 원본을 대조한다. */
function artifact(source, item) {
  const path = projectPath(source, 'public/r/' + item.name + '.json');
  const bytes = readFileSync(path);
  const built = JSON.parse(bytes);
  const expected = item.files ?? [];
  const { files: _sourceFiles, $schema: _sourceSchema, ...sourceMetadata } = item;
  const { files: _builtFiles, $schema: _builtSchema, ...builtMetadata } = built;
  if (!isDeepStrictEqual(sourceMetadata, builtMetadata) || (built.files ?? []).length !== expected.length)
    throw new Error('registry 산출물이 원본과 다릅니다: ' + item.name);
  for (const file of expected) {
    const packed = built.files?.find((entry) => entry.path === file.path);
    const { content, ...metadata } = packed ?? {};
    if (!isDeepStrictEqual(metadata, file) || content !== readFileSync(projectPath(source, file.path), 'utf8'))
      throw new Error('registry 산출물이 원본과 다릅니다: ' + file.path);
  }
  return digest(bytes);
}
/** 기본 설치 target을 프로젝트 상대 경로로 바꾼다. */
function defaultPath(file) { return file.target?.replace(/^~\//, ''); }

/** 일반 프로젝트와 검사 앱 모두 같은 형식으로 설치 직후의 출처·지문을 기록한다. */
export function recordInstallation({ source, project, selected, version, paths = {}, installationComponents, method = 'shadcn@4.19.1 add; installation recorded after review' }) {
  source = resolve(source); project = resolve(project);
  const { items } = sourceRegistry(source, version);
  const names = selection(items, selected);
  const knownFiles = new Set(names.flatMap((name) => (items.get(name).files ?? []).map((file) => file.path)));
  for (const path of Object.keys(paths)) if (!knownFiles.has(path)) throw new Error('선택 밖 경로 대응: ' + path);
  const installedPaths = new Set();
  const records = names.map((name) => {
    const item = items.get(name);
    return { name, artifactHash: artifact(source, item), files: (item.files ?? []).map((file) => {
      const installed = paths[file.path] ?? defaultPath(file);
      const path = projectPath(project, installed);
      if (installedPaths.has(path)) throw new Error('설치 경로가 겹칩니다: ' + installed);
      installedPaths.add(path);
      return { source: file.path, registryTarget: file.target, installed: relative(project, path).replaceAll('\\', '/'), sourceHash: digest(readFileSync(projectPath(source, file.path))), installedHash: digest(readFileSync(path)) };
    }) };
  });
  const components = readFileSync(projectPath(project, 'components.json'));
  return {
    schemaVersion: 1, version, sourceRef: 'v' + version, sourceCommit: git(source, 'rev-parse', 'HEAD'),
    sourceWorkingTree: git(source, 'status', '--porcelain', '--', 'packages/web-kit', 'packages/ui-registry', 'registry.json', 'public/r') ? 'modified; fingerprints identify the candidate' : 'clean',
    shadcn: '4.19.1', method, componentsHash: digest(components),
    ...(installationComponents === undefined ? {} : { installationComponentsHash: digest(installationComponents) }),
    items: records,
  };
}

/** 이전 설치 기록과 새 원본·현재 수정본의 변경을 구분한다. 비교는 파일을 바꾸지 않는다. */
export function compareInstallation({ installation, source, project, version }) {
  source = resolve(source); project = resolve(project);
  const { items } = sourceRegistry(source, version);
  const retained = installation.items.map((item) => item.name).filter((name) => items.has(name));
  const names = retained.length ? selection(items, retained) : [];
  const current = new Map(installation.items.flatMap((item) => item.files).map((file) => [file.source, file]));
  const next = new Map();
  for (const name of names) {
    const item = items.get(name);
    artifact(source, item);
    for (const file of item.files ?? []) next.set(file.path, file);
  }
  return [...new Set([...current.keys(), ...next.keys()])].sort().map((sourcePath) => {
    const previous = current.get(sourcePath);
    const file = next.get(sourcePath);
    const installed = previous ? installedPath(installation, previous.installed) : defaultPath(file);
    const actual = projectPath(project, installed);
    const currentHash = existsSync(actual) ? digest(readFileSync(actual)) : null;
    const nextHash = file ? digest(readFileSync(projectPath(source, sourcePath))) : null;
    const sourceChanged = previous ? previous.sourceHash !== nextHash : true;
    const projectChanged = previous ? previous.installedHash !== currentHash : currentHash !== null;
    return { source: sourcePath, installed, sourceChanged, projectChanged,
      change: !previous ? 'added' : !file ? 'removed' : sourceChanged && projectChanged ? 'both' : sourceChanged ? 'source' : projectChanged ? 'project' : 'unchanged',
      previousSourceHash: previous?.sourceHash ?? null, nextSourceHash: nextHash, currentHash,
      targetChanged: previous?.registryTarget && file ? previous.registryTarget !== file.target : null,
    };
  });
}

/** 이전 starter 기록만 접두를 벗기고 새 기록은 프로젝트 상대 경로를 그대로 쓴다. */
export function installedPath(installation, path) { return installation.schemaVersion === 1 ? path : path.replace(/^apps\/starter\//, ''); }
