// 파일 책임: 독립 저장소에서 새 프로젝트 생성 결과와 기존 파일·비밀·버전 보호를 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
/** 실제 파일과 Git 이력을 가진 작은 후보·AWK 입력을 만든다. 실제 AWK 설치는 별도 통합 검사로 확인한다. */
function fixture(run) {
  const temporary = mkdtempSync(join(tmpdir(), 'web-kit-create-'));
  const repo = join(temporary, 'repo');
  const awk = join(temporary, 'workflow');
  const destination = join(temporary, 'my web');
  /** 시험 파일을 필요한 폴더와 함께 기록한다. */
  const write = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };
  /** 격리 저장소에만 Git 명령을 실행한다. */
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  /** 시험 저장소의 첫 커밋을 만든다. 사용자 Git 설정에는 쓰지 않는다. */
  const commit = (dir) => { git(dir, 'init'); git(dir, 'add', '.'); git(dir, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture'); };
  try {
    mkdirSync(join(repo, 'scripts'), { recursive: true });
    for (const file of ['create-starter.mjs', 'sync-starter.mjs']) copyFileSync(join(root, 'scripts', file), join(repo, 'scripts', file));
    cpSync(join(root, 'scripts/starter'), join(repo, 'scripts/starter'), { recursive: true });
    const kit = join(repo, 'packages/web-kit');
    write(join(kit, 'package.json'), JSON.stringify({ name: '@boosterlab/web-kit', version: '0.0.0-test', files: ['src'] }));
    write(join(kit, 'src/index.ts'), 'export const fixture = true;\n');
    const starter = join(repo, 'apps/starter');
    mkdirSync(join(starter, 'vendor'), { recursive: true });
    execFileSync('pnpm', ['pack', '--out', join(starter, 'vendor/boosterlab-web-kit.tgz')], { cwd: kit, stdio: 'pipe' });
    const tgz = readFileSync(join(starter, 'vendor/boosterlab-web-kit.tgz'));
    write(join(starter, 'pnpm-lock.yaml'), 'integrity: sha512-' + createHash('sha512').update(tgz).digest('base64') + '\n');
    write(join(starter, 'package.json'), JSON.stringify({ scripts: { check: 'test && conformance', 'conformance:check': 'web-kit-check --strict-fingerprints' } }));
    write(join(starter, 'components.json'), JSON.stringify({ registries: { '@web-kit': 'old' } }));
    const sourceFile = 'packages/ui-registry/src/inputs.tsx';
    const installedFile = 'src/shared/ui/web-kit/inputs.tsx';
    const content = 'export const input = true;\n';
    write(join(repo, sourceFile), content);
    write(join(starter, installedFile), content);
    write(join(repo, 'public/r/inputs.json'), '{"name":"inputs"}\n');
    write(join(repo, 'registry.json'), JSON.stringify({ items: [{ name: 'inputs', files: [{ path: sourceFile, target: '~/' + installedFile }] }] }));
    const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
    write(join(starter, 'registry-installation.json'), JSON.stringify({ version: '0.0.0-test', sourceRef: 'v0.0.0-test', sourceCommit: 'source', componentsHash: digest(join(starter, 'components.json')), items: [{ name: 'inputs', artifactHash: digest(join(repo, 'public/r/inputs.json')), files: [{ source: sourceFile, installed: 'apps/starter/' + installedFile, sourceHash: digest(join(repo, sourceFile)), installedHash: digest(join(starter, installedFile)) }] }] }));
    // 예시 업무 층: 새 프로젝트에서 빠지는 업무 폴더·route·생성 코드와, 빈 연결로 바뀌는 앱 파일, 명세에서 빠지는 endpoint·schema.
    write(join(starter, 'src/features/auth/index.ts'), 'export const auth = true;\n');
    write(join(starter, 'src/features/demo/index.ts'), 'export const demo = true;\n');
    write(join(starter, 'src/routes/_app/demo/index.tsx'), 'export const Route = 1;\n');
    write(join(starter, 'src/app/screens.ts'), "export * from '@/features/demo';\n");
    write(join(starter, 'src/api/generated/models/demo.ts'), 'export type Demo = string;\n');
    write(join(starter, 'src/api/generated/models/token.ts'), 'export type Token = string;\n');
    write(join(starter, 'src/api/generated/models/index.ts'), "export * from './demo';\nexport * from './token';\n");
    write(join(starter, 'openapi/sample.json'), JSON.stringify({
      tags: [{ name: 'auth' }, { name: 'demo' }],
      paths: { '/api/auth': { post: { tags: ['auth'], responses: { 200: { $ref: '#/components/schemas/Token' } } } }, '/api/demo': { get: { tags: ['demo'], responses: { 200: { $ref: '#/components/schemas/Demo' } } } } },
      components: { schemas: { Token: { type: 'string' }, Demo: { type: 'string' } } },
    }));
    write(join(repo, 'scripts/starter/without-examples/src/app/screens.ts'), 'export const menu = [];\n');
    write(join(repo, 'scripts/starter/examples.json'), JSON.stringify({
      remove: ['src/features/demo', 'src/routes/_app/demo', 'src/api/generated/models/demo.ts'],
      replace: { 'src/app/screens.ts': 'without-examples/src/app/screens.ts' },
      openapi: { file: 'openapi/sample.json', tags: ['demo'], schemas: ['Demo'], modelIndex: 'src/api/generated/models/index.ts' },
    }));
    write(join(starter, '.env.example'), 'KEY=\n');
    write(join(starter, '.env.mock'), 'MODE=mock\n');
    mkdirSync(join(starter, '.agents/skills'), { recursive: true });
    symlinkSync('../../node_modules/@boosterlab/web-kit/skills/web-kit-auth', join(starter, '.agents/skills/web-kit-auth'));
    // 이 시험용 installer는 호출 경로·입력 전달·출력 조립만 검증한다.
    write(join(awk, 'install.sh'), '#!/bin/bash\nset -eu\nprintf "<!-- agent-workflow-kit:begin -->\\nfixture\\n<!-- agent-workflow-kit:end -->\\n\\n## 프로젝트 지도\\n" > "$1/AGENTS.md"\nmkdir -p "$1/.agents"\ngit -C "$(dirname "$0")" rev-parse HEAD > "$1/.agents/agent-workflow-kit.version"\n');
    commit(awk);
    write(join(repo, 'scripts/starter/agent-workflow-kit.version'), git(awk, 'rev-parse', 'HEAD') + '\n');
    // 추적된 비밀·결과도 복사하지 않는다.
    write(join(starter, '.env.local'), 'PRIVATE=fixture\n');
    write(join(starter, 'dist/index.html'), 'old build');
    commit(repo);
    write(join(starter, 'private-note.txt'), 'untracked');
    /** 사용자가 실행하는 CLI와 같은 경로를 거친다. */
    const create = () => spawnSync(process.execPath, [join(repo, 'scripts/create-starter.mjs'), destination, '--workflow-kit', awk], { cwd: repo, encoding: 'utf8' });
    run({ repo, awk, starter, destination, create, write, git, tgz });
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

test('새 프로젝트는 고정 버전·스킬 링크·CI를 갖고 로컬 비밀과 실행 결과는 가져오지 않는다', () => fixture(({ destination, create, tgz, starter }) => {
  const result = create();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(join(destination, 'vendor/boosterlab-web-kit.tgz')), tgz);
  assert.deepEqual(readFileSync(join(destination, 'pnpm-lock.yaml')), readFileSync(join(starter, 'pnpm-lock.yaml')));
  assert.equal(readlinkSync(join(destination, '.agents/skills/web-kit-auth')), '../../node_modules/@boosterlab/web-kit/skills/web-kit-auth');
  for (const path of ['.env.local', '.git', 'dist', 'private-note.txt', 'node_modules', '.web-kit-results']) assert.equal(existsSync(join(destination, path)), false, path);
  assert.ok(existsSync(join(destination, '.env.example')));
  assert.match(readFileSync(join(destination, '.agents/agent-workflow-kit.version'), 'utf8'), /^[a-f0-9]{40}\n$/);
  assert.match(readFileSync(join(destination, 'AGENTS.md'), 'utf8'), /src\/runtime\/web-kit.ts/);
  assert.match(readFileSync(join(destination, '.github/workflows/check.yml'), 'utf8'), /pnpm check/);
  assert.doesNotMatch(readFileSync(join(destination, 'package.json'), 'utf8'), /strict-fingerprints/);
  assert.match(readFileSync(join(starter, 'package.json'), 'utf8'), /strict-fingerprints/);
  assert.match(readFileSync(join(destination, 'components.json'), 'utf8'), /v0.0.0-test/);
  const record = JSON.parse(readFileSync(join(destination, 'registry-installation.json'), 'utf8'));
  assert.equal(record.componentsHash, createHash('sha256').update(readFileSync(join(destination, 'components.json'))).digest('hex'));
  assert.match(result.stdout, /후보 버전/);
}));

test('기존 대상 폴더는 비어 있지 않아도 그대로 보존한다', () => fixture(({ destination, create, write }) => {
  write(join(destination, 'mine.txt'), 'keep');
  const result = create();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /이미 있습니다/);
  assert.equal(readFileSync(join(destination, 'mine.txt'), 'utf8'), 'keep');
  assert.equal(existsSync(join(destination, 'AGENTS.md')), false);
}));

test('AWK에 변경이 있으면 새 대상도 만들지 않는다', () => fixture(({ awk, destination, create, write }) => {
  write(join(awk, 'uncommitted'), 'change');
  const result = create();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AWK에 저장하지 않은 변경/);
  assert.equal(existsSync(destination), false);
}));

test('AWK 발행 tag는 고정 커밋에 붙은 것을 찾아 알리고, 없으면 커밋만 알린다(고정은 커밋으로 한다)', () => fixture(({ awk, destination, create, write, git }) => {
  const pinned = git(awk, 'rev-parse', 'HEAD');
  write(join(awk, 'later'), 'next\n');
  git(awk, 'add', '.');
  git(awk, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'later');
  git(awk, 'tag', 'v9.9.9');
  git(awk, 'checkout', '-q', pinned);
  const untagged = create();
  assert.equal(untagged.status, 0, untagged.stderr);
  assert.match(untagged.stdout, new RegExp('AWK ' + pinned.slice(0, 7) + '를'));
  assert.doesNotMatch(untagged.stdout, /v9\.9\.9/);
  rmSync(destination, { recursive: true, force: true });
  git(awk, 'tag', 'v9.9.8', pinned);
  const tagged = create();
  assert.equal(tagged.status, 0, tagged.stderr);
  assert.match(tagged.stdout, new RegExp('AWK v9\\.9\\.8\\(' + pinned.slice(0, 7) + '\\)'));
}));

test('같은 버전 번호라도 포장 내용이 달라졌으면 복사를 거절한다', () => fixture(({ repo, destination, create, write }) => {
  write(join(repo, 'packages/web-kit/src/index.ts'), 'export const fixture = false;\n');
  assert.equal(create().status, 1);
  assert.equal(existsSync(destination), false);
}));

for (const path of ['packages/ui-registry/src/inputs.tsx', 'public/r/inputs.json', 'apps/starter/components.json']) {
  test('기록 이후 바뀐 registry 입력을 거절한다: ' + path, () => fixture(({ repo, destination, create, write }) => {
    write(join(repo, path), '{}\n');
    const result = create();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /registry.*다릅니다/);
    assert.equal(existsSync(destination), false);
  }));
}

test('설치 항목을 비워 생성 검사를 피할 수 없다', () => fixture(({ starter, destination, create, write }) => {
  const path = join(starter, 'registry-installation.json');
  const record = JSON.parse(readFileSync(path, 'utf8'));
  record.items = [];
  write(path, JSON.stringify(record));
  assert.equal(create().status, 1);
  assert.equal(existsSync(destination), false);
}));

test('새 프로젝트는 예시 업무 없이 앱·인증 기반만 갖고, 검사 앱의 예시는 그대로 둔다', () => fixture(({ destination, create, starter }) => {
  const result = create();
  assert.equal(result.status, 0, result.stderr);
  for (const path of ['src/features/demo', 'src/routes/_app/demo', 'src/api/generated/models/demo.ts']) assert.equal(existsSync(join(destination, path)), false, path);
  assert.ok(existsSync(join(destination, 'src/features/auth/index.ts')));
  assert.equal(readFileSync(join(destination, 'src/app/screens.ts'), 'utf8'), 'export const menu = [];\n');
  assert.equal(readFileSync(join(destination, 'src/api/generated/models/index.ts'), 'utf8'), "export * from './token';\n");
  const spec = JSON.parse(readFileSync(join(destination, 'openapi/sample.json'), 'utf8'));
  assert.deepEqual(Object.keys(spec.paths), ['/api/auth']);
  assert.deepEqual(Object.keys(spec.components.schemas), ['Token']);
  assert.deepEqual(spec.tags, [{ name: 'auth' }]);
  assert.ok(existsSync(join(starter, 'src/features/demo/index.ts')), '검사 앱의 예시 업무는 남는다');
  assert.equal(readFileSync(join(starter, 'src/app/screens.ts'), 'utf8'), "export * from '@/features/demo';\n");
}));

for (const [name, change, message] of [
  ['목록에 있는 경로가 starter에 없으면', (manifest) => manifest.remove.push('src/features/gone'), /\(없는 경로\): src\/features\/gone/],
  ['명세에 없는 schema를 빼라고 하면', (manifest) => manifest.openapi.schemas.push('Gone'), /\(없는 schema\): Gone/],
  ['남은 endpoint가 뺀 schema를 가리키면', (manifest) => manifest.openapi.schemas.push('Token'), /끊긴 참조가 있습니다: Token/],
]) test('예시 업무 목록이 starter와 어긋나면 새 프로젝트를 만들지 않는다: ' + name, () => fixture(({ repo, destination, write, git }) => {
  const path = join(repo, 'scripts/starter/examples.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  change(manifest);
  write(path, JSON.stringify(manifest));
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'manifest');
  const result = spawnSync(process.execPath, [join(repo, 'scripts/create-starter.mjs'), destination, '--workflow-kit', join(dirname(repo), 'workflow')], { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, message);
  assert.equal(existsSync(destination), false);
}));
