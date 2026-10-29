// 파일 책임: 검증용 starter를 새 프로젝트로 복사하고 고정 AWK·프로젝트 지도·소비 검사를 연결한다.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, symlinkSync, copyFileSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const starter = join(root, 'apps/starter');
const templates = join(root, 'scripts/starter');
const excluded = new Set(['node_modules', 'dist', 'coverage', '.git', 'work', 'test-results', 'playwright-report', '.web-kit-results', '.DS_Store']);

/** JSON과 파일 지문은 실제 복사할 파일에서 읽는다. */
function json(path) { return JSON.parse(readFileSync(path, 'utf8')); }
/** 설치 당시의 파일 지문을 계산한다. */
function hash(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
/** 새 프로젝트의 JSON 설정을 읽기 쉬운 형식으로 기록한다. */
function writeJson(path, value) { writeFileSync(path, JSON.stringify(value, null, 2) + '\n'); }
/** Git 명령은 명시한 체크아웃 안에서만 실행한다. */
function git(cwd, ...args) { return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim(); }

/** 로컬 비밀·의존성·결과를 제외하고 소스를 복사한다. 스킬 링크만 상대 경로 그대로 보존한다. */
function copyStarter(source, destination, tracked) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.name.endsWith('.tsbuildinfo') ||
        (entry.name.startsWith('.env') && !['.env.example', '.env.mock'].includes(entry.name))) continue;
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    const sourcePath = relative(starter, from).replaceAll('\\', '/');
    if (!tracked.some((path) => path === sourcePath || path.startsWith(sourcePath + '/'))) continue;
    if (entry.isSymbolicLink()) {
      const rel = relative(starter, from).replaceAll('\\', '/');
      const target = readlinkSync(from);
      if (!/^\.agents\/skills\/web-kit-[a-z-]+$/.test(rel) || target !== `../../node_modules/@boosterlab/web-kit/skills/${entry.name}`)
        throw new Error(`예상하지 않은 심링크: ${rel}`);
      symlinkSync(target, to);
    } else if (entry.isDirectory()) copyStarter(from, to, tracked);
    else copyFileSync(from, to);
  }
}

/** 대상에 쓰기 전에 버전·잠금·UI 원본 보존을 확인한다. */
function validateSource(workflowKit) {
  const expected = readFileSync(join(templates, 'agent-workflow-kit.version'), 'utf8').trim();
  if (realpathSync(git(workflowKit, 'rev-parse', '--show-toplevel')) !== realpathSync(workflowKit))
    throw new Error('AWK 저장소의 루트 경로를 지정하세요.');
  if (git(workflowKit, 'status', '--porcelain')) throw new Error('AWK에 저장하지 않은 변경이 있습니다. 깨끗한 고정 버전을 사용하세요.');
  if (git(workflowKit, 'rev-parse', 'HEAD') !== expected) throw new Error(`이 starter의 AWK 고정 버전은 ${expected}입니다. 그 버전의 별도 checkout을 지정하세요.`);
  // 설치는 하지 않고 기존 포장 비교 경로로 후보와 vendor가 같은 내용인지 확인한다.
  execFileSync(process.execPath, [join(root, 'scripts/sync-starter.mjs'), '--frozen', '--verify-only'], { cwd: root, stdio: 'pipe' });
  const version = json(join(root, 'packages/web-kit/package.json')).version;
  const archive = join(starter, 'vendor/boosterlab-web-kit.tgz');
  const packed = JSON.parse(execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }));
  const integrity = 'sha512-' + createHash('sha512').update(readFileSync(archive)).digest('base64');
  if (packed.version !== version || !readFileSync(join(starter, 'pnpm-lock.yaml'), 'utf8').includes(integrity))
    throw new Error('starter 패키지와 lockfile이 맞지 않습니다. pnpm starter:sync 후 다시 검사하세요.');
  const installation = json(join(starter, 'registry-installation.json'));
  if (installation.version !== version || installation.sourceRef !== `v${version}`) throw new Error('패키지와 registry 버전이 다릅니다. 같은 후보로 설치·검사하세요.');
  const registry = json(join(root, 'registry.json'));
  if (!installation.items?.length || JSON.stringify(installation.items.map((item) => item.name).sort()) !== JSON.stringify(registry.items.map((item) => item.name).sort()))
    throw new Error('registry 설치 항목이 현재 원본 목록과 다릅니다.');
  if (installation.componentsHash !== hash(join(starter, 'components.json'))) throw new Error('registry 설치 설정이 기록과 다릅니다.');
  for (const item of installation.items) {
    const definition = registry.items.find((entry) => entry.name === item.name);
    if (!/^[a-z0-9-]+$/.test(item.name) || hash(join(root, 'public/r', item.name + '.json')) !== item.artifactHash)
      throw new Error(`registry 배포 JSON이 설치 기록과 다릅니다: ${item.name}`);
    const expected = (definition.files ?? []).map((file) => file.path).sort();
    if (JSON.stringify(item.files.map((file) => file.source).sort()) !== JSON.stringify(expected)) throw new Error(`registry 파일 목록이 다릅니다: ${item.name}`);
    for (const file of item.files) {
      const source = resolve(root, file.source);
      if (!source.startsWith(root) || hash(source) !== file.sourceHash) throw new Error(`registry 원본이 설치 기록과 다릅니다: ${file.source}`);
      const expectedPath = definition.files.find((entry) => entry.path === file.source).target.replace(/^~\//, '');
      const installedPath = file.installed.replace(/^apps\/starter\//, '');
      const path = resolve(starter, installedPath);
      if (installedPath !== expectedPath || !path.startsWith(starter + '/') || hash(path) !== file.installedHash)
        throw new Error(`검사 앱의 원본 복사본이 달라졌습니다: ${file.installed}`);
    }
  }
  return { version, installation };
}

/** 새 폴더를 완성한 뒤에만 목적지로 옮긴다. 기존 폴더는 비어 있어도 건드리지 않는다. */
export function createStarter(destination, workflowKit) {
  destination = resolve(destination);
  workflowKit = resolve(workflowKit);
  if (existsSync(destination) || (() => { try { lstatSync(destination); return true; } catch { return false; } })())
    throw new Error('대상 폴더가 이미 있습니다. 새 경로를 지정하세요.');
  if (!existsSync(dirname(destination))) throw new Error('대상 상위 폴더를 먼저 만드세요.');
  const { version, installation } = validateSource(workflowKit);
  const stage = mkdtempSync(join(dirname(destination), '.web-kit-start-'));
  try {
    const tracked = git(root, 'ls-files', '--', 'apps/starter').split('\n').map((path) => path.replace(/^apps\/starter\//, ''));
    copyStarter(starter, stage, tracked);
    execFileSync('bash', [join(workflowKit, 'install.sh'), stage], { stdio: 'pipe' });
    const agents = join(stage, 'AGENTS.md');
    const installed = readFileSync(agents, 'utf8');
    const end = '<!-- agent-workflow-kit:end -->';
    writeFileSync(agents, installed.slice(0, installed.indexOf(end) + end.length) + '\n\n' + readFileSync(join(templates, 'project-map.md'), 'utf8'));
    copyFileSync(join(templates, 'README.md'), join(stage, 'README.md'));
    mkdirSync(join(stage, '.github/workflows'), { recursive: true });
    copyFileSync(join(templates, 'check.yml'), join(stage, '.github/workflows/check.yml'));
    const pkg = json(join(stage, 'package.json'));
    // 내부 검사 앱만 strict를 쓴다. 프로젝트도 필수 연결·실패·skip·버전 검사는 유지한다.
    pkg.scripts['conformance:check'] = pkg.scripts['conformance:check'].replace(' --strict-fingerprints', '');
    writeJson(join(stage, 'package.json'), pkg);
    const components = json(join(stage, 'components.json'));
    components.registries['@web-kit'] = `https://raw.githubusercontent.com/taehyung-lab/web-kit/v${version}/public/r/{name}.json`;
    writeJson(join(stage, 'components.json'), components);
    // 원본·설치 지문은 그대로 두고 위치만 새 프로젝트 기준으로 옮긴다.
    for (const item of installation.items) for (const file of item.files) file.installed = file.installed.replace(/^apps\/starter\//, '');
    writeJson(join(stage, 'registry-installation.json'), installation);
    // 복사 도중 다른 작업이 대상 폴더를 만들었으면 덮어쓰지 않는다.
    if (existsSync(destination)) throw new Error('복사 도중 대상 폴더가 생겼습니다. 다른 경로로 다시 시작하세요.');
    renameSync(stage, destination);
    return { destination, version };
  } finally { rmSync(stage, { recursive: true, force: true }); }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  if (args.length !== 3 || args[1] !== '--workflow-kit') {
    console.log('사용법: pnpm starter:create <새 폴더> --workflow-kit <고정 AWK checkout>');
    if (!args.includes('--help')) process.exitCode = 1;
  } else {
    try {
      const result = createStarter(args[0], args[2]);
      console.log(`생성 완료: ${result.destination}\nweb-kit ${result.version}; AWK는 .agents/agent-workflow-kit.version에 고정했습니다.\n새 폴더에서 pnpm install --frozen-lockfile → pnpm exec playwright install chromium → pnpm check → pnpm dev:mock 순서로 실행하세요.`);
      if (result.version.includes('-')) console.log('후보 버전입니다. 복사된 UI는 로컬에서 사용할 수 있지만 registry 추가 설치는 해당 tag 발행 전에는 사용할 수 없습니다. 실서버 검증·정식 발행 완료를 뜻하지 않습니다.');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
