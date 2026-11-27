// 파일 책임: 화면 골격 생성기(web-kit-new)가 덮어쓰지 않고, 다시 실행해도 같고, --dry-run은 쓰지 않으며, 구조 검사를 통과하되 완성처럼 보이지 않는지 실제 CLI로 검사한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, linkSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
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
  assert.match(result.stdout, /만들 파일 src\/features\/invoices\/model\/list\/use-invoice-list\.ts/);
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

test('공개 입구에 사용자 연결을 보존하며 새 화면 연결만 추가하고 dry-run은 바꾸지 않는다', () => project(({ dir, cli }) => {
  const feature = join(dir, 'src/features/invoices');
  mkdirSync(feature, { recursive: true });
  const entry = join(feature, 'index.ts');
  const original = '// 사용자 연결\nexport const custom = 1;\n';
  writeFileSync(entry, original);
  const dry = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices', '--dry-run');
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(readFileSync(entry, 'utf8'), original);
  const created = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices');
  assert.equal(created.status, 0, created.stderr);
  const after = readFileSync(entry, 'utf8');
  assert.ok(after.startsWith(original));
  assert.match(after, /export \{ InvoiceListPage \} from '\.\/ui\/list\/InvoiceListPage'/);
  assert.match(after, /export \{ invoiceListSearch \} from '\.\/model\/list\/invoice-list-search'/);
  assert.equal(cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices').status, 0);
  assert.equal(readFileSync(entry, 'utf8'), after);
}));

test('공개 export는 따옴표·공백·묶음이 달라도 중복하지 않고 다른 출처의 같은 이름은 원자적으로 거절한다', () => project(({ dir, cli }) => {
  const feature = join(dir, 'src/features/invoices');
  mkdirSync(feature, { recursive: true });
  const entry = join(feature, 'index.ts');
  const original = 'export {InvoiceListPage, extra} from "./ui/list/InvoiceListPage";\n';
  writeFileSync(entry, original);
  assert.equal(cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices').status, 0);
  const after = readFileSync(entry, 'utf8');
  assert.equal((after.match(/\bInvoiceListPage\b(?=[,} ])/g) ?? []).length, 1);
  assert.ok(after.startsWith(original));
  writeFileSync(entry, after + 'export { AnotherPage as InvoiceCreatePage } from "./custom";\n');
  const before = files(dir).map(path => [path, readFileSync(join(dir, path), 'utf8')]);
  const conflict = cli('--feature', 'invoices', '--kind', 'form', '--url', '/invoices/new');
  assert.equal(conflict.status, 1);
  assert.deepEqual(files(dir).map(path => [path, readFileSync(join(dir, path), 'utf8')]), before);
}));

test('내용이 다른 화면 파일이 있으면 아무 파일도 쓰지 않고 실패한다. 공유 파일은 덮어쓰지 않고 쓴다', () => project(({ dir, cli }) => {
  assert.equal(cli('--feature', 'invoices', '--kind', 'detail', '--url', '/invoices/$invoiceId').status, 0);
  const model = join(dir, 'src/features/invoices/model/invoice.ts');
  writeFileSync(model, 'export interface Invoice { readonly id: string }\n');
  const shared = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices');
  assert.equal(shared.status, 0, shared.stderr);
  assert.match(shared.stdout, /기존 파일 사용 src\/features\/invoices\/model\/invoice\.ts/);
  assert.equal(readFileSync(model, 'utf8'), 'export interface Invoice { readonly id: string }\n');
  const screen = join(dir, 'src/features/invoices/ui/form/InvoiceCreatePage.tsx');
  mkdirSync(join(dir, 'src/features/invoices/ui/form'), { recursive: true });
  writeFileSync(screen, 'export const mine = 1;\n');
  const conflict = cli('--feature', 'invoices', '--kind', 'form', '--url', '/invoices/new');
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /충돌 src\/features\/invoices\/ui\/form\/InvoiceCreatePage\.tsx/);
  assert.equal(readFileSync(screen, 'utf8'), 'export const mine = 1;\n');
  assert.equal(existsSync(join(dir, 'src/features/invoices/model/form/use-invoice-create.ts')), false, '충돌이 있으면 다른 파일도 쓰지 않는다');
}));

test('묶음 이름은 프로젝트가 정한다: --group은 설정보다 앞서고, 둘 다 없으면 만들지 않는다', () => project(({ dir, cli }) => {
  mkdirSync(join(dir, 'src/routes/_staff'), { recursive: true });
  writeFileSync(join(dir, 'src/routes/_staff/route.tsx'), 'export const Route = { component: () => null };\n');
  const chosen = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices', '--group', '_staff');
  assert.equal(chosen.status, 0, chosen.stderr);
  assert.ok(readFileSync(join(dir, 'src/routes/_staff/invoices/index.tsx'), 'utf8').includes("createFileRoute('/_staff/invoices/')"));

  const config = join(dir, 'web-kit.structure.json');
  const { screenGroup: _, ...withoutGroup } = JSON.parse(readFileSync(config, 'utf8'));
  writeFileSync(config, JSON.stringify(withoutGroup));
  const before = files(dir);
  const missing = cli('--feature', 'orders', '--kind', 'list', '--url', '/orders');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /route 묶음을 정하세요/);
  assert.deepEqual(files(dir), before);
}));

test('진입 판정(route.tsx)이 없는 묶음에는 화면을 만들지 않는다', () => project(({ dir, cli }) => {
  const before = files(dir);
  const result = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices', '--group', '_authenticated');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /route 묶음 _authenticated이 없습니다/);
  assert.deepEqual(files(dir), before);
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

/** 프로젝트가 소유하는 골격 폴더를 쓰고 web-kit.structure.json의 screenTemplates로 연결한다. */
function useProjectTemplates(dir, manifest, templates) {
  for (const [name, text] of Object.entries(templates)) {
    mkdirSync(join(dir, 'screen-templates', name, '..'), { recursive: true });
    writeFileSync(join(dir, 'screen-templates', name), text);
  }
  writeFileSync(join(dir, 'screen-templates/screens.json'), JSON.stringify(manifest));
  const config = join(dir, 'web-kit.structure.json');
  writeFileSync(config, JSON.stringify({ ...JSON.parse(readFileSync(config, 'utf8')), screenTemplates: 'screen-templates' }));
}

const projectList = {
  list: {
    files: [
      { path: '{{featureDir}}/model/list/use-{{entity}}-list.ts', template: 'list/use-list.ts.tpl' },
      { path: '{{routesDir}}/{{routeFile}}', template: 'list/route.tsx.tpl' },
    ],
    exports: ["export { use{{Entity}}List } from './model/list/use-{{entity}}-list';"],
    next: ['{{url}} 화면을 프로젝트 목록 분류에 더한다'],
  },
};
const projectListTemplates = {
  'list/use-list.ts.tpl': "// 프로젝트 목록 입구\nexport function use{{Entity}}List() {\n  return {{TODO}}project_list_entry;\n}\n",
  'list/route.tsx.tpl': "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('{{routeId}}')({});\n",
};

test('프로젝트 골격(screenTemplates)이 있으면 그 골격으로 만들고 키트 기본 골격은 쓰지 않는다', () => project(({ dir, cli }) => {
  useProjectTemplates(dir, projectList, projectListTemplates);
  const result = cli('--feature', 'order-items', '--kind', 'list', '--url', '/order-items');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(dir, 'src/features/order-items/model/list/use-order-item-list.ts'), 'utf8'),
    '// 프로젝트 목록 입구\nexport function useOrderItemList() {\n  return TODO_web_kit_new_project_list_entry;\n}\n');
  assert.match(readFileSync(join(dir, 'src/routes/_app/order-items/index.tsx'), 'utf8'), /createFileRoute\('\/_app\/order-items\/'\)/);
  assert.match(readFileSync(join(dir, 'src/features/order-items/index.ts'), 'utf8'), /export \{ useOrderItemList \} from '\.\/model\/list\/use-order-item-list';/);
  assert.equal(existsSync(join(dir, 'src/features/order-items/api/order-item-list-query.ts')), false, '키트 기본 골격 파일을 섞지 않는다');
  assert.match(result.stdout, /직접 연결할 것:\n  - \/order-items 화면을 프로젝트 목록 분류에 더한다/);
  assert.match(result.stdout, /미완성 표시 1곳/);
}));

test('프로젝트 골격에 없는 화면 종류는 키트 기본으로 대신 만들지 않고 실패한다', () => project(({ dir, cli }) => {
  useProjectTemplates(dir, projectList, projectListTemplates);
  const before = files(dir);
  const result = cli('--feature', 'invoices', '--kind', 'detail', '--url', '/invoices/$invoiceId');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /detail 화면 골격이 없습니다/);
  assert.deepEqual(files(dir), before);
}));

for (const [name, change, message] of [
  ['feature 밖에 쓰는 골격', (m) => { m.list.files[0].path = 'src/shared/{{entity}}.ts'; }, /src\/features\/invoices\/ 안이거나/],
  ['업무 폴더 뒤 .. 로 다른 업무 route에 쓰는 골격', (m) => { m.list.files[0].path = '{{featureDir}}/../../routes/_app/orders/index.tsx'; }, /상대 조각/],
  ['업무 폴더 뒤 . 조각을 쓰는 골격', (m) => { m.list.files[0].path = '{{featureDir}}/./model/x.ts'; }, /상대 조각/],
  ['다른 업무 route에 쓰는 골격', (m) => { m.list.files[0].path = '{{routesDir}}/orders/index.tsx'; m.list.files[0].shared = true; }, /src\/features\/invoices\/ 안이거나/],
  ['목록 묶음 route를 shared 없이 쓰는 골격', (m) => { m.list.files[0].path = '{{routesDir}}{{collectionUrl}}/route.tsx'; }, /\(shared\)/],
  ['목록 묶음 route id가 없는 골격', (m, t) => { m.list.files[0] = { path: '{{routesDir}}{{collectionUrl}}/route.tsx', template: 'list/use-list.ts.tpl', shared: true }; t['list/use-list.ts.tpl'] = '{{TODO}}x\n'; }, /목록 묶음 route 파일에 route id/],
  ['검사 파일을 만드는 골격', (m) => { m.list.files[0].path = '{{featureDir}}/model/list/use-{{entity}}-list.test.ts'; }, /검사 파일은 골격으로 만들지 않습니다/],
  ['채울 자리가 없는 골격', (m, t) => { t['list/use-list.ts.tpl'] = 'export const done = true;\n'; }, /채울 자리/],
  ['모르는 자리 이름', (m, t) => { t['list/use-list.ts.tpl'] = '{{TODO}}x {{Entiy}}\n'; }, /알 수 없는 골격 자리 \{\{Entiy\}\}/],
  ['route id가 없는 route 골격', (m, t) => { t['list/route.tsx.tpl'] = 'export const Route = {};\n'; }, /route id/],
  ['route 파일이 없는 골격', (m) => { m.list.files.pop(); }, /route 파일/],
  ['공개 입구를 파일로 쓰는 골격', (m) => { m.list.files[0].path = '{{featureDir}}/index.ts'; }, /exports로 적습니다/],
]) test('프로젝트 골격 오류는 쓰기 전에 거절한다: ' + name, () => project(({ dir, cli }) => {
  const manifest = structuredClone(projectList);
  const templates = { ...projectListTemplates };
  change(manifest, templates);
  useProjectTemplates(dir, manifest, templates);
  const before = files(dir);
  const result = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices');
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, message);
  assert.deepEqual(files(dir), before);
}));

test('screenTemplates 폴더에 screens.json이 없으면 설정 오류다', () => project(({ dir, cli }) => {
  mkdirSync(join(dir, 'empty-templates'));
  const config = join(dir, 'web-kit.structure.json');
  writeFileSync(config, JSON.stringify({ ...JSON.parse(readFileSync(config, 'utf8')), screenTemplates: 'empty-templates' }));
  const result = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /screens\.json이 없습니다/);
}));

test('골격 자리값: 목록 주소·상세 주소·주소 변수는 화면 종류마다 같은 목록을 가리키고, 목록 묶음 route.tsx는 함께 쓴다', () => project(({ dir, cli }) => {
  const screen = (mode) => ({
    files: [
      { path: '{{featureDir}}/model/{{mode}}-values.ts'.replace('{{mode}}', mode), template: 'values.ts.tpl' },
      { path: '{{routesDir}}{{collectionUrl}}/route.tsx', template: 'group.tsx.tpl', shared: true },
      { path: '{{routesDir}}/{{routeFile}}', template: 'route.tsx.tpl' },
    ],
  });
  useProjectTemplates(dir, { list: screen('list'), detail: screen('detail'), create: screen('create'), edit: screen('edit') }, {
    'values.ts.tpl': "export const values = '{{url}}|{{collectionUrl}}|{{recordUrl}}|{{id}}|{{group}}' as {{TODO}}x;\n",
    'group.tsx.tpl': "import { permission } from '{{alias}}features/{{feature}}';\nexport const Route = createFileRoute('/{{group}}{{collectionUrl}}')({ permission });\n",
    'route.tsx.tpl': "export const Route = createFileRoute('{{routeId}}')({});\n",
  });
  for (const [kind, url] of [['list', '/sales/order-items'], ['detail', '/sales/order-items/$orderItemId'], ['form', '/sales/order-items/new'], ['form', '/sales/order-items/$orderItemId/edit']])
    assert.equal(cli('--feature', 'order-items', '--kind', kind, '--url', url).status, 0);
  const values = (mode) => readFileSync(join(dir, `src/features/order-items/model/${mode}-values.ts`), 'utf8').match(/'(.*)'/)[1];
  // 네 화면이 같은 상세 주소(recordUrl)와 같은 주소 변수(id)를 가리킨다.
  assert.equal(values('list'), '/sales/order-items|/sales/order-items|/sales/order-items/$orderItemId|orderItemId|_app');
  assert.equal(values('detail'), '/sales/order-items/$orderItemId|/sales/order-items|/sales/order-items/$orderItemId|orderItemId|_app');
  assert.equal(values('create'), '/sales/order-items/new|/sales/order-items|/sales/order-items/$orderItemId|orderItemId|_app');
  assert.equal(values('edit'), '/sales/order-items/$orderItemId/edit|/sales/order-items|/sales/order-items/$orderItemId|orderItemId|_app');
  // 이미 있는 상세와 다른 변수로 상세를 또 만들면 같은 주소에 상세가 둘이 되므로 만들지 않는다.
  const before = files(dir);
  const other = cli('--feature', 'order-items', '--kind', 'detail', '--url', '/sales/order-items/$itemId');
  assert.equal(other.status, 1);
  assert.match(other.stderr, /상세 주소는 이미 \$orderItemId입니다/);
  assert.deepEqual(files(dir), before);
  assert.equal(readFileSync(join(dir, 'src/routes/_app/sales/order-items/route.tsx'), 'utf8'), "import { permission } from '@/features/order-items';\nexport const Route = createFileRoute('/_app/sales/order-items')({ permission });\n");
}));

test('상세 주소 변수는 프로젝트가 정하고, 네 화면이 같은 변수를 쓴다(먼저 만든 상세·목록이 정한 이름을 따른다)', () => project(({ dir, cli }) => {
  assert.equal(cli('--feature', 'invoices', '--kind', 'detail', '--url', '/invoices/$id').status, 0);
  assert.equal(cli('--feature', 'invoices', '--kind', 'form', '--url', '/invoices/$id/edit').status, 0);
  // 목록이 나중에 만들어져도 이미 있는 상세($id)를 가리킨다.
  const list = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices');
  assert.equal(list.status, 0, list.stderr);
  assert.ok(existsSync(join(dir, 'src/routes/_app/invoices/$id/index.tsx')));
  const mismatch = cli('--feature', 'invoices', '--kind', 'form', '--url', '/invoices/$invoiceId/edit');
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /상세 주소는 이미 \$id입니다/);
}));

test('목록 묶음 진입 판정(route.tsx)은 다른 업무 것을 쓰지 않고, 이미 다른 화면이 있는 주소에 새로 걸지 않는다', () => project(({ dir, cli }) => {
  const screen = (mode) => ({ files: [
    { path: '{{featureDir}}/model/{{entity}}-' + mode + '.ts', template: 'value.ts.tpl' },
    { path: '{{routesDir}}{{collectionUrl}}/route.tsx', template: 'group.tsx.tpl', shared: true },
    { path: '{{routesDir}}/{{routeFile}}', template: 'route.tsx.tpl' },
  ] });
  useProjectTemplates(dir, { list: screen('list'), detail: screen('detail'), create: screen('create') }, {
    'value.ts.tpl': 'export const value = {{TODO}}x;\n',
    'group.tsx.tpl': "import { permission } from '{{alias}}features/{{feature}}';\nexport const Route = createFileRoute('/{{group}}{{collectionUrl}}')({ permission });\n",
    'route.tsx.tpl': "export const Route = createFileRoute('{{routeId}}')({});\n",
  });
  // 다른 업무가 쓰는 목록 주소: 그 업무의 진입 판정과 상세가 이미 있다.
  mkdirSync(join(dir, 'src/routes/_app/manage/venue/$venueId'), { recursive: true });
  writeFileSync(join(dir, 'src/routes/_app/manage/venue/route.tsx'), "import { permission } from '@/features/venues';\n");
  writeFileSync(join(dir, 'src/routes/_app/manage/venue/$venueId/index.tsx'), 'export const Route = 1;\n');
  writeFileSync(join(dir, 'src/routes/_app/manage/venue/index.tsx'), 'export const Route = 1;\n');
  const before = files(dir);
  const sameDetail = cli('--feature', 'probes', '--entity', 'probe', '--kind', 'detail', '--url', '/manage/venue/$probeId');
  assert.equal(sameDetail.status, 1);
  assert.match(sameDetail.stderr, /상세 주소는 이미 \$venueId입니다/);
  const otherGroup = cli('--feature', 'probes', '--entity', 'probe', '--kind', 'form', '--url', '/manage/venue/new');
  assert.equal(otherGroup.status, 1);
  assert.match(otherGroup.stderr, /다른 업무의 진입 판정/);
  // 다른 화면이 이미 있는 상위 주소(/manage)에 새 업무의 진입 판정을 걸면 그 화면들도 새 권한을 거치게 된다.
  const parent = cli('--feature', 'probes', '--entity', 'probe', '--kind', 'form', '--url', '/manage/new');
  assert.equal(parent.status, 1);
  assert.match(parent.stderr, /이미 다른 화면\([^)]*venue\/route\.tsx[^)]*\)이 있는 주소/);
  assert.deepEqual(files(dir), before);
  // 같은 업무가 만든 진입 판정은 다음 화면이 그대로 쓴다.
  assert.equal(cli('--feature', 'probes', '--entity', 'probe', '--kind', 'list', '--url', '/probes').status, 0);
  const next = cli('--feature', 'probes', '--entity', 'probe', '--kind', 'form', '--url', '/probes/new');
  assert.equal(next.status, 0, next.stderr);
  assert.match(next.stdout, /변경 없음 src\/routes\/_app\/probes\/route\.tsx/);
}));

test('골격 자리값: 업무·이름 표기(featureCamel·ENTITY)를 바꾸고 JSX 객체 값 {{ a: 1 }}은 그대로 둔다', () => project(({ dir, cli }) => {
  useProjectTemplates(dir, {
    list: { files: [
      { path: '{{featureDir}}/ui/list/{{Entity}}ListPage.tsx', template: 'page.tsx.tpl' },
      { path: '{{routesDir}}/{{routeFile}}', template: 'route.tsx.tpl' },
    ] },
  }, {
    'page.tsx.tpl': "export const names = ['{{featureCamel}}', '{{ENTITY}}'];\nexport const view = <List messages={{ empty: t('{{featureCamel}}.empty') }} value={{{TODO}}value} />;\n",
    'route.tsx.tpl': "export const Route = createFileRoute('{{routeId}}')({});\n",
  });
  assert.equal(cli('--feature', 'sales-orders', '--entity', 'sales-order', '--kind', 'list', '--url', '/sales-orders').status, 0);
  assert.equal(readFileSync(join(dir, 'src/features/sales-orders/ui/list/SalesOrderListPage.tsx'), 'utf8'),
    "export const names = ['salesOrders', 'SALES_ORDER'];\nexport const view = <List messages={{ empty: t('salesOrders.empty') }} value={TODO_web_kit_new_value} />;\n");
}));

test('화면 자신의 route를 shared로 두는 골격은 거절한다(같은 주소의 기존 화면은 재사용이 아니라 충돌이다)', () => project(({ dir, cli }) => {
  const manifest = structuredClone(projectList);
  manifest.list.files[1].shared = true;
  useProjectTemplates(dir, manifest, projectListTemplates);
  const before = files(dir);
  const result = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /shared로 둘 수 없습니다/);
  assert.deepEqual(files(dir), before);
}));

test('쓰는 파일이나 상위 폴더가 심볼릭 링크면 다른 곳을 고치지 않고 아무 파일도 쓰지 않는다', () => project(({ dir, cli }) => {
  // 업무 입구가 다른 업무의 route를 가리키는 링크인 경우
  mkdirSync(join(dir, 'src/routes/_app/orders'), { recursive: true });
  const other = join(dir, 'src/routes/_app/orders/index.tsx');
  writeFileSync(other, 'export const keep = 1;\n');
  mkdirSync(join(dir, 'src/features/invoices'), { recursive: true });
  symlinkSync(other, join(dir, 'src/features/invoices/index.ts'));
  const linked = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices');
  assert.equal(linked.status, 1);
  assert.match(linked.stderr, /src\/features\/invoices\/index\.ts가 심볼릭 링크/);
  assert.equal(readFileSync(other, 'utf8'), 'export const keep = 1;\n');
  assert.equal(existsSync(join(dir, 'src/routes/_app/invoices/index.tsx')), false);
  // 업무 폴더 자체가 다른 폴더를 가리키는 링크인 경우
  rmSync(join(dir, 'src/features/invoices'), { recursive: true });
  mkdirSync(join(dir, 'elsewhere'));
  symlinkSync(join(dir, 'elsewhere'), join(dir, 'src/features/invoices'));
  const folder = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices');
  assert.equal(folder.status, 1);
  assert.match(folder.stderr, /src\/features\/invoices가 심볼릭 링크/);
  assert.deepEqual(readdirSync(join(dir, 'elsewhere')), []);
}));

test('공개 입구가 다른 업무 route와 하드 링크로 묶여 있으면 아무 파일도 쓰지 않는다', () => project(({ dir, cli }) => {
  mkdirSync(join(dir, 'src/routes/_app/orders'), { recursive: true });
  const other = join(dir, 'src/routes/_app/orders/index.tsx');
  writeFileSync(other, 'export const keep = 1;\n');
  mkdirSync(join(dir, 'src/features/invoices'), { recursive: true });
  linkSync(other, join(dir, 'src/features/invoices/index.ts'));
  const result = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /하드 링크/);
  assert.equal(readFileSync(other, 'utf8'), 'export const keep = 1;\n');
  assert.equal(existsSync(join(dir, 'src/routes/_app/invoices/index.tsx')), false);
}));

test('골격 이름이 겹치는 프로젝트 골격은 쓰기 전에 거절한다(import와 지역 선언 충돌 포함)', () => project(({ dir, cli }) => {
  useProjectTemplates(dir, {
    list: { files: [
      { path: '{{featureDir}}/model/list/use-{{entity}}-list.ts', template: 'clash.ts.tpl' },
      { path: '{{routesDir}}/{{routeFile}}', template: 'route.tsx.tpl' },
    ] },
  }, {
    'clash.ts.tpl': "import { use{{Entity}}List } from './elsewhere';\nexport function use{{Entity}}List() {\n  return {{TODO}}x;\n}\n",
    'route.tsx.tpl': "export const Route = createFileRoute('{{routeId}}')({});\n",
  });
  const before = files(dir);
  const result = cli('--feature', 'invoices', '--kind', 'list', '--url', '/invoices');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /이름이 겹치거나 문법 오류[\s\S]*useInvoiceList이\(가\) 맨 위에서 두 번 선언된다/);
  assert.deepEqual(files(dir), before);
}));

test('키트 기본 골격은 골격 이름과 같아질 수 있는 업무 이름으로도 겹침 없이 만든다', () => project(({ dir, cli }) => {
  const ts = createRequire(join(root, 'packages/web-kit/package.json'))('typescript');
  // 골격이 쓰는 지역·함수 이름과 같아질 수 있는 업무 이름들(예: create → useCreate + Create = useCreateCreate).
  const names = ['state', 'record', 'editor', 'navigate', 'create', 'update', 'list', 'detail', 'edit', 'form', 'route', 'query'];
  const refused = [];
  for (const name of names) {
    for (const [kind, url] of [['list', `/x-${name}`], ['detail', `/x-${name}/$${name}Id`], ['form', `/x-${name}/new`], ['form', `/x-${name}/$${name}Id/edit`]]) {
      const before = files(dir);
      const result = cli('--feature', `x-${name}`, '--entity', name, '--kind', kind, '--url', url);
      if (result.status === 0) continue;
      assert.match(result.stderr, /이름이 겹치거나 문법 오류/, `${name} ${kind} ${url}: ${result.stderr}`);
      assert.deepEqual(files(dir), before, '거절하면 아무 파일도 쓰지 않는다');
      refused.push(`${name} ${url}`);
    }
  }
  // 키트 기본 골격은 이 이름들 모두로 만들 수 있어야 한다(요청 hook 별칭 등으로 겹치지 않게 썼다).
  assert.deepEqual(refused, [], '키트 기본 골격이 거절한 업무 이름');
  // 만든 파일은 문법 오류와 같은 범위 중복 선언이 없다(TODO 이름 없음은 의도한 실패라 보지 않는다).
  const generated = [...files(join(dir, 'src/features')).map((path) => join(dir, 'src/features', path)), ...files(join(dir, 'src/routes')).map((path) => join(dir, 'src/routes', path))]
    .filter((path) => /\.tsx?$/.test(path));
  const program = ts.createProgram(generated, { noEmit: true, jsx: ts.JsxEmit.Preserve, noResolve: true, types: [] });
  for (const path of generated) {
    const file = program.getSourceFile(path);
    const found = [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file).filter((item) => [2300, 2451, 2393, 2440].includes(item.code))];
    assert.deepEqual(found.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')), [], path);
  }
}));

test('다른 업무 화면과 같은 주소를 쓰거나 그 화면에 새 진입 판정이 걸리는 골격은 쓰지 않는다', () => project(({ dir, cli }) => {
  const screen = (mode) => ({ files: [
    { path: '{{featureDir}}/model/{{entity}}-' + mode + '.ts', template: 'value.ts.tpl' },
    { path: '{{routesDir}}{{collectionUrl}}/route.tsx', template: 'group.tsx.tpl', shared: true },
    { path: '{{routesDir}}/{{routeFile}}', template: 'route.tsx.tpl' },
  ] });
  useProjectTemplates(dir, { list: screen('list'), detail: screen('detail'), edit: screen('edit') }, {
    'value.ts.tpl': 'export const value = {{TODO}}x;\n',
    'group.tsx.tpl': "import { permission } from '{{alias}}features/{{feature}}';\nexport const Route = createFileRoute('/{{group}}{{collectionUrl}}')({ permission });\n",
    'route.tsx.tpl': "export const Route = createFileRoute('{{routeId}}')({});\n",
  });
  // 다른 업무의 상세가 같은 $id 폴더에 있고 묶음 route.tsx는 없다: 수정 화면과 함께 묶음 진입 판정을 새로 걸면 그 상세에도 걸린다.
  mkdirSync(join(dir, 'src/routes/_app/venues/$id'), { recursive: true });
  writeFileSync(join(dir, 'src/routes/_app/venues/$id/index.tsx'), 'export const Route = 1;\n');
  const before = files(dir);
  const edit = cli('--feature', 'probes', '--entity', 'probe', '--kind', 'form', '--url', '/venues/$id/edit');
  assert.equal(edit.status, 1);
  assert.match(edit.stderr, /이미 다른 화면\(\$id\/index\.tsx\)이 있는 주소/);
  // 같은 주소를 다른 파일 모양으로 이미 쓰는 route: venues/new.tsx가 있으면 venues/new 목록(new/index.tsx·new/route.tsx)은 같은 주소다.
  writeFileSync(join(dir, 'src/routes/_app/venues/new.tsx'), 'export const Route = 1;\n');
  const twin = cli('--feature', 'probes', '--entity', 'probe', '--kind', 'list', '--url', '/venues/new');
  assert.equal(twin.status, 1);
  assert.match(twin.stderr, /같은 주소의 route src\/routes\/_app\/venues\/new\.tsx가 이미 있다/);
  rmSync(join(dir, 'src/routes/_app/venues/new.tsx'));
  assert.deepEqual(files(dir), before);
  // route 묶음(_이름)은 주소에 나타나지 않는다: 다른 묶음의 로그인 화면(/login)과 같은 주소의 목록도 같은 주소다.
  mkdirSync(join(dir, 'src/routes/_public/login'), { recursive: true });
  writeFileSync(join(dir, 'src/routes/_public/login/index.tsx'), 'export const Route = 1;\n');
  const login = cli('--feature', 'probes', '--entity', 'probe', '--kind', 'list', '--url', '/login');
  assert.equal(login.status, 1);
  assert.match(login.stderr, /같은 주소의 route src\/routes\/_public\/login\/index\.tsx가 이미 있다/);
  assert.equal(existsSync(join(dir, 'src/routes/_app/login')), false);
  // 업무 소유는 import 문으로 판정한다: 따옴표 모양이 달라도 같은 업무, 주석·문자열에만 있으면 다른 업무.
  mkdirSync(join(dir, 'src/routes/_app/tickets'), { recursive: true });
  writeFileSync(join(dir, 'src/routes/_app/tickets/route.tsx'), 'import { permission } from "@/features/tickets";\n');
  const owned = cli('--feature', 'tickets', '--entity', 'ticket', '--kind', 'list', '--url', '/tickets');
  assert.equal(owned.status, 0, owned.stdout + owned.stderr);
  mkdirSync(join(dir, 'src/routes/_app/bills'), { recursive: true });
  writeFileSync(join(dir, 'src/routes/_app/bills/route.tsx'), "// import { permission } from '@/features/bills';\nimport { permission } from '@/features/venues';\n");
  const comment = cli('--feature', 'bills', '--entity', 'bill', '--kind', 'list', '--url', '/bills');
  assert.equal(comment.status, 1);
  assert.match(comment.stderr, /다른 업무의 진입 판정/);
}));
