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
  assert.match(readFileSync(join(destination, 'AGENTS.md'), 'utf8'), /src\/app\/web-kit.ts/);
  assert.match(readFileSync(join(destination, '.github/workflows/check.yml'), 'utf8'), /pnpm check/);
  assert.doesNotMatch(readFileSync(join(destination, 'package.json'), 'utf8'), /strict-fingerprints/);
  assert.match(readFileSync(join(starter, 'package.json'), 'utf8'), /strict-fingerprints/);
  assert.match(readFileSync(join(destination, 'components.json'), 'utf8'), /v0.0.0-test/);
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
