// 파일 책임: 일반 소비처의 선택 설치·갱신 비교·새 검사 실행을 실제 임시 파일과 CLI로 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareInstallation, recordInstallation } from '../packages/web-kit/tools/registry.mjs';
import { digest } from '../packages/web-kit/tools/files.mjs';
import { runConformance, verifyConformanceRun } from '../packages/web-kit/tools/run-conformance.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const version = JSON.parse(readFileSync(join(root, 'packages/web-kit/package.json'), 'utf8')).version;
/** 사용자 파일을 건드리지 않는 작은 원본과 서로 다른 소비 환경을 만든다. */
function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'web-kit-tools-'));
  const source = join(dir, 'source'); const project = join(dir, 'my project');
  const write = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'); };
  const git = (...args) => execFileSync('git', ['-C', source, ...args], { stdio: 'pipe', encoding: 'utf8' }).trim();
  const registry = { items: [
    { name: 'inputs', files: [{ path: 'packages/ui-registry/src/input.tsx', target: '~/src/input.tsx' }], registryDependencies: [] },
    { name: 'form', files: [{ path: 'packages/ui-registry/src/form.tsx', target: '~/src/form.tsx' }], registryDependencies: ['@web-kit/inputs'] },
    { name: 'unused', files: [], registryDependencies: [] },
  ] };
  /** 원본과 빌드 JSON을 함께 갱신한다. */
  function build() {
    write(join(source, 'registry.json'), registry);
    for (const item of registry.items) write(join(source, 'public/r', item.name + '.json'), { ...item, files: item.files.map((file) => ({ ...file, content: readFileSync(join(source, file.path), 'utf8') })) });
  }
  write(join(source, 'packages/web-kit/package.json'), { version });
  write(join(source, 'packages/ui-registry/src/input.tsx'), 'export const input = "old";\n');
  write(join(source, 'packages/ui-registry/src/form.tsx'), 'export const form = "old";\n');
  write(join(project, 'components.json'), {});
  write(join(project, 'src/input.tsx'), 'export const input = "old";\n');
  write(join(project, 'src/form.tsx'), 'export const form = "old";\n');
  build();
  git('init'); git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture');
  const record = (extra = {}) => recordInstallation({ source, project, selected: ['form'], version, ...extra });
  try { run({ dir, source, project, write, git, registry, build, record }); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('일반 소비처: 선택과 내부 의존만 기록하고 CLI 변환 후 지문을 구별한다', () => fixture(({ project, write, record }) => {
  write(join(project, 'src/form.tsx'), '// transformed import\n');
  const result = record();
  assert.deepEqual(result.items.map((item) => item.name), ['form', 'inputs']);
  assert.notEqual(result.items[0].files[0].sourceHash, result.items[0].files[0].installedHash);
  assert.equal(result.items[0].files[0].installedHash, digest('// transformed import\n'));
  assert.match(result.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(result.sourceWorkingTree, 'clean');
}));

test('다른 배치의 소비처: 경로 대응표와 프로젝트 상대 경로를 보존한다', () => fixture(({ project, write, record }) => {
  write(join(project, 'apps/starter/fields/form.tsx'), '// custom\n');
  const result = record({ paths: { 'packages/ui-registry/src/form.tsx': 'apps/starter/fields/form.tsx' } });
  assert.equal(result.items[0].files[0].installed, 'apps/starter/fields/form.tsx');
  assert.equal(readFileSync(join(project, 'apps/starter/fields/form.tsx'), 'utf8'), '// custom\n');
}));

test('원본 버전·빌드 JSON·설치 파일·경로 오류는 기록하지 못한다', () => fixture(({ source, project, dir, write, record }) => {
  assert.throws(() => record({ version: 'different' }), /버전/);
  assert.throws(() => record({ selected: ['absent'] }), /없는/);
  assert.throws(() => record({ paths: { unknown: 'src/input.tsx' } }), /선택 밖/);
  assert.throws(() => record({ paths: { 'packages/ui-registry/src/form.tsx': '../escape' } }), /밖/);
  write(join(dir, 'outside'), 'keep');
  symlinkSync(join(dir, 'outside'), join(project, 'symlink'));
  assert.throws(() => record({ paths: { 'packages/ui-registry/src/form.tsx': 'symlink' } }), /심링크/);
  write(join(source, 'packages/ui-registry/src/form.tsx'), '// not built\n');
  assert.throws(record, /산출물/);
}));

for (const mode of ['unchanged', 'source', 'project', 'both', 'removed', 'added']) test('갱신 비교: ' + mode + '를 구별하며 수정본을 보존한다', () => fixture(({ source, project, write, record, registry, build }) => {
  const installation = record();
  if (['source', 'both'].includes(mode)) write(join(source, 'packages/ui-registry/src/form.tsx'), '// next\n');
  if (['project', 'both'].includes(mode)) write(join(project, 'src/form.tsx'), '// mine\n');
  if (mode === 'removed') registry.items[1].files = [];
  if (mode === 'added') {
    write(join(source, 'packages/ui-registry/src/new.tsx'), '// new\n');
    registry.items[1].files.push({ path: 'packages/ui-registry/src/new.tsx', target: '~/src/new.tsx' });
  }
  build();
  const before = readFileSync(join(project, 'src/form.tsx'));
  const changes = compareInstallation({ installation, source, project, version });
  assert.equal(changes.find((file) => file.source.endsWith(mode === 'added' ? '/new.tsx' : '/form.tsx')).change, mode);
  assert.deepEqual(readFileSync(join(project, 'src/form.tsx')), before);
  assert.equal(existsSync(join(project, 'src/new.tsx')), false);
}));

test('배포 CLI: 새 기록·기존 기록 보호·비교가 같은 공통 module을 쓴다', () => fixture(({ source, project }) => {
  const cli = join(root, 'packages/web-kit/bin/registry.mjs');
  const args = ['--source', source, '--project', project, '--items', 'form'];
  const run = (mode) => spawnSync(process.execPath, [cli, mode, ...args], { encoding: 'utf8' });
  assert.equal(run('record').status, 0);
  assert.equal(run('record').status, 1);
  const result = run('compare');
  assert.equal(result.status, 0, result.stderr);
  assert(JSON.parse(result.stdout).every((file) => file.change === 'unchanged'));
  const nested = spawnSync(process.execPath, [cli, 'record', ...args, '--output', 'records/installation.json'], { encoding: 'utf8' });
  assert.equal(nested.status, 1);
  assert.match(nested.stderr, /프로젝트 루트/);
  assert.equal(existsSync(join(project, 'records/installation.json')), false);
}));

for (const field of ['dependencies', 'devDependencies', 'type']) test('원본 메타 불일치 거절: ' + field, () => fixture(({ source, record, registry, build, write }) => {
  registry.items[0][field] = field === 'type' ? 'registry:block' : ['react@19.2.8'];
  build();
  const path = join(source, 'public/r/inputs.json');
  const built = JSON.parse(readFileSync(path, 'utf8'));
  built[field] = field === 'type' ? 'registry:style' : ['react@0.0.0'];
  write(path, built);
  assert.throws(record, /산출물/);
}));

test('항목 자체가 사라진 갱신도 제거로 분류한다', () => fixture(({ source, project, record, registry, build }) => {
  const installation = record();
  registry.items = registry.items.filter((item) => item.name !== 'form'); build();
  const result = compareInstallation({ installation, source, project, version });
  assert.equal(result.find((file) => file.source.endsWith('/form.tsx')).change, 'removed');
}));

/** 진짜 자식 프로세스가 검사 JSON을 생성하는 실행 입력을 만든다. */
function runFixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'web-kit-run-'));
  const write = (path, value) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), typeof value === 'string' ? value : JSON.stringify(value)); };
  const title = '[web-kit:inputs-unit|' + version + '|v' + version + '|commit] contract';
  write('inputs.test.tsx', '// current connection\n');
  write('index.html', '<div id="root"></div>');
  write('package.json', { name: 'fixture' }); write('pnpm-lock.yaml', 'lock\n');
  write('registry-installation.json', { version, sourceRef: 'v' + version, sourceCommit: 'commit', schemaVersion: 1, items: [{ name: 'inputs', files: [{ source: 'checks/inputs.test.tsx', installed: 'inputs.test.tsx', installedHash: digest('// current connection\n') }] }] });
  write('unit.mjs', 'import { writeFileSync } from "node:fs"; writeFileSync("unit.json", ' + JSON.stringify(JSON.stringify({ success: true, testResults: [{ assertionResults: [{ fullName: title, status: 'passed' }] }] })) + ');\n');
  write('browser.mjs', 'import { writeFileSync } from "node:fs"; writeFileSync("browser.json", \'{"suites":[],"errors":[]}\');\n');
  write('web-kit.check.json', { inputs: ['index.html', 'inputs.test.tsx', 'unit.mjs', 'browser.mjs', 'package.json', 'pnpm-lock.yaml'], unit: [process.execPath, 'unit.mjs'], browser: [process.execPath, 'browser.mjs'] });
  const options = { root: dir, configPath: join(dir, 'web-kit.check.json'), installationPath: join(dir, 'registry-installation.json'), unitPath: join(dir, 'unit.json'), browserPath: join(dir, 'browser.json'), receiptPath: join(dir, 'run.json') };
  try { run({ dir, write, options }); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('새 실행: 현재 입력과 새 보고서를 묶고 배포 CLI도 판정한다', () => runFixture(({ dir, options }) => {
  runConformance(options); verifyConformanceRun(options);
  const result = spawnSync(process.execPath, [join(root, 'packages/web-kit/bin/check-conformance.mjs'), '--run', 'web-kit.check.json', '--installation', 'registry-installation.json', '--unit', 'unit.json', '--browser', 'browser.json', '--receipt', 'run.json', '--strict-fingerprints'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /적합성 통과/);
}));

for (const mode of ['missing-report', 'failed-command', 'changed-during-run']) test('새 실행 거절: ' + mode, () => runFixture(({ write, options }) => {
  runConformance(options);
  write('unit.mjs', mode === 'missing-report' ? '// no new result\n' : mode === 'failed-command' ? 'process.exit(1);\n' : 'import {writeFileSync} from "node:fs"; writeFileSync("inputs.test.tsx","// changed"); writeFileSync("unit.json","{}");\n');
  assert.throws(() => runConformance(options), mode === 'missing-report' ? /새 검사 보고서/ : mode === 'failed-command' ? /명령 실패/ : /실행 중/);
  assert.equal(existsSync(options.receiptPath), false);
}));

for (const path of ['index.html', 'inputs.test.tsx', 'pnpm-lock.yaml', 'unit.json', 'browser.json', 'web-kit.check.json']) test('지난 실행 거절: ' + path + ' 변경', () => runFixture(({ write, options }) => {
  runConformance(options); write(path, path.endsWith('.json') ? '{}' : '// changed\n');
  assert.throws(() => verifyConformanceRun(options));
}));

test('브라우저 불필요한 선택은 null을 쓰되 필수 ID 판정은 그대로 둔다', () => runFixture(({ write, options }) => {
  const config = JSON.parse(readFileSync(options.configPath, 'utf8')); config.browser = null; write('web-kit.check.json', config);
  runConformance(options); verifyConformanceRun(options);
  assert.deepEqual(JSON.parse(readFileSync(options.browserPath, 'utf8')), { suites: [], errors: [] });
}));

for (const kind of ['unitPath', 'browserPath', 'receiptPath']) test('입력 아래 출력 거절: ' + kind + '는 소스 파일을 보존한다', () => runFixture(({ dir, write, options }) => {
  write('src/model.ts', 'export const value = 1;\n');
  const config = JSON.parse(readFileSync(options.configPath, 'utf8'));
  config.inputs.push('src'); write('web-kit.check.json', config);
  options[kind] = join(dir, 'src/model.ts');
  assert.throws(() => runConformance(options), /입력과 출력.*겹/);
  assert.equal(readFileSync(join(dir, 'src/model.ts'), 'utf8'), 'export const value = 1;\n');
  assert.equal(existsSync(join(dir, 'unit.json')), false, '입력/출력 오류는 명령 실행 전에 거절한다');
}));

for (const folder of ['work', 'dist', 'coverage']) test('선언한 소스의 하위 폴더도 기록한다: src/' + folder, () => runFixture(({ dir, write, options }) => {
  const source = 'src/' + folder + '/model.ts';
  write(source, 'export const value = 1;\n');
  const config = JSON.parse(readFileSync(options.configPath, 'utf8'));
  config.inputs.push('src'); write('web-kit.check.json', config);
  runConformance(options);
  const receipt = JSON.parse(readFileSync(options.receiptPath, 'utf8'));
  assert.equal(receipt.files[source], digest('export const value = 1;\n'));
  write(source, 'export const value = 999;\n');
  assert.throws(() => verifyConformanceRun(options), /실행 기록이 다릅니다/);
  assert.equal(readFileSync(join(dir, source), 'utf8'), 'export const value = 999;\n');
}));

for (const kind of ['unitPath', 'browserPath', 'receiptPath']) test('심링크 부모를 통한 출력도 실행 전에 거절한다: ' + kind, () => runFixture(({ dir, write, options }) => {
  write('src/model.ts', 'export const value = 1;\n');
  write('reports/keep.txt', 'keep');
  symlinkSync(join(dir, 'src'), join(dir, 'reports/alias'), 'dir');
  const config = JSON.parse(readFileSync(options.configPath, 'utf8'));
  config.inputs.push('src'); write('web-kit.check.json', config);
  options[kind] = join(dir, 'reports/alias/model.ts');
  assert.throws(() => runConformance(options), /심링크/);
  assert.equal(readFileSync(join(dir, 'src/model.ts'), 'utf8'), 'export const value = 1;\n');
  assert.equal(existsSync(join(dir, 'unit.json')), false);
}));

test('입력의 심링크 부모도 실제 소스 경로로 선언하게 한다', () => runFixture(({ dir, write, options }) => {
  write('src/model.ts', 'export const value = 1;\n');
  symlinkSync(join(dir, 'src'), join(dir, 'alias'), 'dir');
  const config = JSON.parse(readFileSync(options.configPath, 'utf8'));
  config.inputs.push('alias/model.ts'); write('web-kit.check.json', config);
  options.unitPath = join(dir, 'src/model.ts');
  assert.throws(() => runConformance(options), /심링크/);
  assert.equal(readFileSync(join(dir, 'src/model.ts'), 'utf8'), 'export const value = 1;\n');
}));
