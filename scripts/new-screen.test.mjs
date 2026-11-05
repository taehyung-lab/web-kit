// 파일 책임: 화면 골격 생성기(web-kit-new)가 덮어쓰지 않고, 다시 실행해도 같고, --dry-run은 쓰지 않으며, 구조 검사를 통과하되 완성처럼 보이지 않는지 실제 CLI로 검사한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStructureCheck } from '../packages/web-kit/tools/structure/check.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const bin = join(root, 'packages/web-kit/bin/new-screen.mjs');
const fixture = join(root, 'scripts/fixtures/structure/valid');

/** 정상 구조 예제를 복사한 임시 프로젝트에서 실행한다. */
function project(run) {
  const dir = mkdtempSync(join(tmpdir(), 'web-kit-new-'));
  cpSync(fixture, dir, { recursive: true });
  /** 생성기 CLI를 그 프로젝트 폴더에서 실행한다. */
  const cli = (...args) => spawnSync(process.execPath, [bin, ...args], { cwd: dir, encoding: 'utf8' });
  return Promise.resolve(run({ dir, cli })).finally(() => rmSync(dir, { recursive: true, force: true }));
}

/** 폴더 아래 파일 목록. */
function files(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(dir, entry.name), base) : [join(dir, entry.name).slice(base.length + 1)]).sort();
}

const screens = [
  ['list', '/invoices', 'src/routes/_app/invoices/index.tsx', "createFileRoute('/_app/invoices/')"],
  ['detail', '/invoices/$invoiceId', 'src/routes/_app/invoices/$invoiceId/index.tsx', "createFileRoute('/_app/invoices/$invoiceId/')"],
  ['form', '/invoices/new', 'src/routes/_app/invoices/new.tsx', "createFileRoute('/_app/invoices/new')"],
  ['form', '/invoices/$invoiceId/edit', 'src/routes/_app/invoices/$invoiceId/edit.tsx', "createFileRoute('/_app/invoices/$invoiceId/edit')"],
];

test('--dry-run은 계획만 보이고 파일을 쓰지 않는다', () => project(({ dir, cli }) => {
  const before = files(dir);
  const result = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices', '--dry-run');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /만들 파일 src\/features\/invoices\/flows\/use-invoice-list\.ts/);
  assert.deepEqual(files(dir), before);
}));

test('네 화면 종류를 정한 자리에 만들고, 구조 검사는 통과하지만 미완성 표시가 남는다', () => project(async ({ dir, cli }) => {
  for (const [kind, url, route, id] of screens) {
    const result = cli('--feature', 'invoices', '--kind', kind, '--url', url);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /생성한 파일 수는 완료한 화면 수가 아니다/);
    assert.ok(readFileSync(join(dir, route), 'utf8').includes(id), route);
  }
  const created = files(join(dir, 'src/features/invoices'));
  assert.deepEqual(created.filter((path) => /\.(?:test|spec)\./.test(path)), [], '검사 파일을 만들지 않는다');
  for (const path of created) assert.doesNotMatch(readFileSync(join(dir, 'src/features/invoices', path), 'utf8'), /\b(?:it|test|describe)\.skip\b|Promise\.resolve\(/, path);
  const structure = await runStructureCheck({ root: dir, resolveFrom: join(root, 'packages/web-kit') });
  assert.equal(structure.ok, true, JSON.stringify(structure.violations, null, 2));
  assert.ok(structure.todoMarkers >= 10, '채우지 않은 자리는 선언되지 않은 TODO 이름으로 남아야 한다: ' + structure.todoMarkers);
}));

test('같은 입력으로 다시 실행하면 바뀌는 것이 없다', () => project(({ dir, cli }) => {
  assert.equal(cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices').status, 0);
  const snapshot = files(dir).map((path) => [path, readFileSync(join(dir, path), 'utf8')]);
  const again = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices');
  assert.equal(again.status, 0, again.stderr);
  assert.doesNotMatch(again.stdout, /만듦/);
  assert.deepEqual(files(dir).map((path) => [path, readFileSync(join(dir, path), 'utf8')]), snapshot);
}));

test('내용이 다른 화면 파일이 있으면 아무 파일도 쓰지 않고 실패한다. 공유 파일은 덮어쓰지 않고 쓴다', () => project(({ dir, cli }) => {
  assert.equal(cli('--feature', 'invoices', '--kind', 'detail', '--url', '/invoices/$invoiceId').status, 0);
  const model = join(dir, 'src/features/invoices/model/invoice.ts');
  writeFileSync(model, 'export interface Invoice { readonly id: string }\n');
  const shared = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices');
  assert.equal(shared.status, 0, shared.stderr);
  assert.match(shared.stdout, /기존 파일 사용 src\/features\/invoices\/model\/invoice\.ts/);
  assert.equal(readFileSync(model, 'utf8'), 'export interface Invoice { readonly id: string }\n');
  const screen = join(dir, 'src/features/invoices/screens/InvoiceCreateScreen.tsx');
  writeFileSync(screen, 'export const mine = 1;\n');
  const conflict = cli('--feature', 'invoices', '--kind', 'form', '--url', '/invoices/new');
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /충돌 src\/features\/invoices\/screens\/InvoiceCreateScreen\.tsx/);
  assert.equal(readFileSync(screen, 'utf8'), 'export const mine = 1;\n');
  assert.equal(existsSync(join(dir, 'src/features/invoices/flows/use-invoice-create.ts')), false, '충돌이 있으면 다른 파일도 쓰지 않는다');
}));

for (const [args, message] of [
  [['--feature', 'Invoices', '--kind', 'list', '--url', '/invoices'], /kebab-case/],
  [['--feature', 'invoices', '--kind', 'page', '--url', '/invoices'], /--kind/],
  [['--feature', 'invoices', '--kind', 'detail', '--url', '/invoices'], /\$<id>/],
  [['--feature', 'invoices', '--kind', 'list', '--url', 'invoices'], /--url/],
  [['--feature', 'utils', '--kind', 'list', '--url', '/utils'], /포괄 이름/],
  [['--feature', 'invoices', '--kind', 'list'], /--url/],
]) test('잘못된 입력은 쓰기 전에 거절한다: ' + args.join(' '), () => project(({ dir, cli }) => {
  const before = files(dir);
  const result = cli(...args);
  assert.equal(result.status, 1);
  assert.match(result.stderr, message);
  assert.deepEqual(files(dir), before);
}));
