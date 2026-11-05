// 파일 책임: 현재 소비 파일에서 검사를 새로 실행하고 결과를 그 입력에 묶는다.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { digest, projectPath, readJson } from './files.mjs';
import { installedPath } from './registry.mjs';

/** 검사 경로는 부모까지 실제 경로를 쓰게 하여 심링크 별칭으로 입력 보호를 우회하지 못하게 한다. */
function conformancePath(root, path) {
  const full = projectPath(root, path);
  let current = root;
  for (const part of relative(root, full).split(sep)) {
    current = resolve(current, part);
    try {
      if (lstatSync(current).isSymbolicLink()) throw new Error('검사 경로의 심링크는 실제 파일 경로로 선언하세요: ' + path);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return full;
}

/**
 * 모노레포 앱은 lockfile 같은 공용 파일이 저장소 맨 위에 있다. `workspace: { root: "../..", inputs: ["pnpm-lock.yaml"] }`로
 * 프로젝트의 조상 폴더와 그 안의 일반 파일만 입력에 더한다(폴더는 받지 않아 검사 출력·다른 앱을 담지 않는다).
 */
function workspaceFiles(root, config) {
  const workspace = config.workspace;
  if (workspace === undefined) return [];
  const parts = typeof workspace?.root === 'string' ? workspace.root.split('/') : [];
  if (!parts.length || parts.some((part) => part !== '..')) throw new Error('workspace.root는 프로젝트의 조상 폴더("..", "../.." 등)여야 합니다');
  if (!Array.isArray(workspace.inputs) || !workspace.inputs.length) throw new Error('workspace.inputs를 선언하세요');
  const base = resolve(root, workspace.root);
  return workspace.inputs.map((path) => {
    const full = conformancePath(base, path);
    const stat = lstatSync(full);
    if (!stat.isFile()) throw new Error('workspace 입력은 일반 파일이어야 합니다: ' + path);
    if (!relative(base, full).split(sep).every((part) => part !== 'node_modules' && !part.startsWith('.env'))) throw new Error('검사 입력으로 사용할 수 없는 경로: ' + path);
    return { name: workspace.root + '/' + path, full };
  });
}

/** 선언한 코드·설정과 실제 설치 파일의 현재 지문을 모은다. 비밀·의존성·결과 폴더는 포함하지 않는다. */
function snapshot(root, inputs, installation, excluded, workspace = []) {
  const files = new Map();
  const generatedRoots = new Set(['dist', 'coverage', 'test-results', 'playwright-report', '.web-kit-results', 'work']);
  /** 프로젝트 루트의 결과 폴더만 제외하여 src/work 같은 업무 소스는 기록한다. */
  function ignored(path) {
    const parts = relative(root, resolve(root, path)).split(sep);
    const name = parts.at(-1);
    return name.startsWith('.env') || ['node_modules', '.git'].includes(name) || (parts.length === 1 && generatedRoots.has(name));
  }
  /** 선언한 디렉터리를 실제 파일까지 순회한다. */
  function visit(path) {
    if (ignored(path)) throw new Error('검사 입력으로 사용할 수 없는 경로: ' + path);
    const full = conformancePath(root, path);
    if (excluded.has(full)) throw new Error('검사 입력과 출력이 겹칩니다: ' + path);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error('검사 입력의 심링크는 실제 파일 경로로 선언하세요: ' + path);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(full).sort()) {
        const child = path + '/' + entry;
        if (ignored(child)) continue;
        if (!excluded.has(resolve(root, child))) visit(child);
      }
    } else if (stat.isFile()) files.set(relative(root, full).replaceAll('\\', '/'), digest(readFileSync(full)));
    else throw new Error('일반 파일이 아닌 검사 입력: ' + path);
  }
  for (const path of inputs) visit(path);
  for (const { name, full } of workspace) files.set(name, digest(readFileSync(full)));
  for (const item of installation.items ?? []) for (const file of item.files ?? []) visit(installedPath(installation, file.installed));
  return Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)));
}

/** 출력 정리 전에 입력 파일·디렉터리와의 겹침을 모두 거절한다. */
function executionInputs({ root, configPath, installationPath }, config, installation, outputs) {
  if (!Array.isArray(config.inputs) || !config.inputs.length) throw new Error('검사 입력 inputs를 선언하세요');
  const inputs = [...config.inputs, relative(root, configPath), relative(root, installationPath)];
  const sources = [...inputs, ...(installation.items ?? []).flatMap((item) => (item.files ?? []).map((file) => installedPath(installation, file.installed)))];
  const inputPaths = sources.map((path) => conformancePath(root, path));
  if (new Set(outputs).size !== outputs.length) throw new Error('검사 출력 경로가 겹칩니다');
  for (const path of outputs) {
    const checked = conformancePath(root, relative(root, path));
    if (existsSync(checked) && !lstatSync(checked).isFile()) throw new Error('검사 출력은 일반 파일이어야 합니다: ' + path);
    for (const input of inputPaths) {
      const rel = relative(input, checked);
      if (rel === '' || (lstatSync(input).isDirectory() && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)))
        throw new Error('검사 입력과 출력 경로가 겹칩니다: ' + relative(root, checked));
    }
  }
  return inputs;
}
/** 셸을 거치지 않는 명령 배열인지 확인한다. */
function command(value, kind) {
  if (!Array.isArray(value) || value.length === 0 || value.some((part) => typeof part !== 'string' || !part)) throw new Error(kind + ': 실행 명령 배열이 필요합니다');
  return value;
}

/** 이전 결과를 없애고 두 러너의 새 결과를 현재 입력에 연결한 실행 기록을 만든다. */
export function runConformance({ root, configPath, installationPath, unitPath, browserPath, receiptPath }) {
  const config = readJson(configPath);
  const unit = command(config.unit, 'unit');
  const browser = config.browser === null ? null : command(config.browser, 'browser');
  const installation = readJson(installationPath);
  const outputs = [unitPath, browserPath, receiptPath];
  const inputs = executionInputs({ root, configPath, installationPath }, config, installation, outputs);
  const excluded = new Set(outputs);
  const workspace = workspaceFiles(root, config);
  const recorded = [...inputs, ...workspace.map((file) => file.name)];
  const before = snapshot(root, inputs, installation, excluded, workspace);
  // 실패한 실행 뒤에도 이전 receipt나 보고서가 이번 통과로 보이지 않게 먼저 지운다.
  for (const path of outputs) rmSync(path, { force: true });
  function run(args, output) {
    const result = spawnSync(args[0], args.slice(1), { cwd: root, stdio: 'inherit', shell: false });
    if (result.error || result.status !== 0) throw new Error('검사 명령 실패: ' + args[0] + ' (exit ' + result.status + ')');
    if (!existsSync(output)) throw new Error('새 검사 보고서가 없습니다: ' + relative(root, output));
  }
  run(unit, unitPath);
  if (browser) run(browser, browserPath);
  else {
    mkdirSync(dirname(browserPath), { recursive: true });
    writeFileSync(browserPath, JSON.stringify({ suites: [], errors: [] }) + '\n');
  }
  const after = snapshot(root, inputs, installation, excluded, workspace);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('검사 실행 중 입력 파일이 바뀌었습니다');
  const receipt = { schemaVersion: 1, inputs: recorded, files: before, reports: { unit: digest(readFileSync(unitPath)), browser: digest(readFileSync(browserPath)) } };
  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
}

/** 실행 뒤 파일 또는 보고서가 달라졌으면 지난 실행 기록을 거절한다. */
export function verifyConformanceRun({ root, configPath, installationPath, unitPath, browserPath, receiptPath }) {
  const receipt = readJson(receiptPath);
  const config = readJson(configPath);
  const installation = readJson(installationPath);
  const inputs = executionInputs({ root, configPath, installationPath }, config, installation, [unitPath, browserPath, receiptPath]);
  const workspace = workspaceFiles(root, config);
  const recorded = [...inputs, ...workspace.map((file) => file.name)];
  if (receipt.schemaVersion !== 1 || JSON.stringify(receipt.inputs) !== JSON.stringify(recorded) ||
      JSON.stringify(receipt.files) !== JSON.stringify(snapshot(root, inputs, installation, new Set([unitPath, browserPath, receiptPath]), workspace)) ||
      receipt.reports.unit !== digest(readFileSync(unitPath)) || receipt.reports.browser !== digest(readFileSync(browserPath))) throw new Error('현재 파일·검사 결과와 실행 기록이 다릅니다. --run으로 다시 검사하세요');
}
