// 파일 책임: 배포하는 구조 규칙이 정상 구조를 통과시키고, 각 위반(별칭·상대 경로·재export·동적 import·타입 전용·생성 코드·모노레포 별칭)을 실제로 거절하는지 검사한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStructureCheck } from '../packages/web-kit/tools/structure/check.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const kit = join(root, 'packages/web-kit');
const fixtures = join(root, 'scripts/fixtures/structure');

/** 고정 예제를 임시 폴더에 복사하고 바꿀 파일을 쓴 뒤 구조 검사를 실행한다. */
async function check(fixture, files = {}, { project = '.', config } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'web-kit-structure-'));
  try {
    cpSync(join(fixtures, fixture), dir, { recursive: true });
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, project, path)), { recursive: true });
      writeFileSync(join(dir, project, path), content);
    }
    if (config) {
      const path = join(dir, project, 'web-kit.structure.json');
      writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, 'utf8')), ...config }));
    }
    return await runStructureCheck({ root: join(dir, project), resolveFrom: kit });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** 위반 목록을 짧게 보여 준다. */
const show = (result) => JSON.stringify({ violations: result.violations, errors: result.errors, unused: result.unusedExceptions }, null, 2);

test('정상 구조: 타입 전용 import·생성 모델 값·index.ts 재export·검사 파일·지원 코드는 통과한다', async () => {
  const result = await check('valid');
  assert.equal(result.ok, true, show(result));
  assert.equal(result.violations.length, 0);
  assert.ok(result.files >= 15, '실제 파일을 검사해야 한다: ' + result.files);
});

test('모노레포: 부모 tsconfig의 paths 별칭을 해소하고 다른 workspace 패키지는 앱 구조 밖으로 본다', async () => {
  const result = await check('monorepo', {}, { project: 'apps/admin' });
  assert.equal(result.ok, true, show(result));
  const bad = await check('monorepo', { 'src/shared/bad.ts': "import { X_LIMIT } from '@admin/features/x/model/x-policy';\nexport const n = X_LIMIT;\n" }, { project: 'apps/admin' });
  assert.deepEqual(bad.violations.map((v) => [v.file, v.rule]), [['src/shared/bad.ts', 'layer-import']], show(bad));
});

const cases = [
  ['app는 공개 입구를 사용한다', 'src/app/Bad.ts', "import { ORDER_LIMIT } from '@/features/orders/model/order-policy'; export const limit = ORDER_LIMIT;", 'feature-public'],
  ['route는 공개 입구를 사용한다', 'src/routes/_app/orders/new.tsx', "import { ORDER_LIMIT } from '@/features/orders/model/order-policy'; export const Route = ORDER_LIMIT;", 'feature-public'],
  ['model은 UI 문구도 모른다', 'src/features/orders/model/order-copy.ts', "import { messages } from '../ui/messages'; export const copy = messages;", 'layer-import', { 'src/features/orders/ui/messages.ts': 'export const messages = {};' }],
  ['중첩 입구는 만들지 않는다', 'src/features/orders/model/list/index.ts', 'export const x = 1;', 'file-layout'],
  ['업무 루트에 문구를 쌓지 않는다', 'src/features/orders/messages.ts', 'export const messages = {};', 'file-layout'],
  ['shared → feature(별칭)', 'src/shared/lib/order-label.ts', "import { ORDER_LIMIT } from '@/features/orders/model/order-policy';\nexport const label = ORDER_LIMIT;\n", 'layer-import'],
  ['shared → feature(타입 전용도 금지)', 'src/shared/lib/order-label.ts', "import type { OrderQuery } from '@/features/orders/model/order-form';\nexport type Label = OrderQuery;\n", 'layer-import'],
  ['shared → 생성 코드', 'src/shared/lib/order-label.ts', "import { listOrders } from '@/api/generated/orders';\nexport const load = listOrders;\n", 'layer-import'],
  ['runtime → feature(상대 경로)', 'src/runtime/sign-out.ts', "import { orderListQuery } from '../features/orders/api/orders';\nexport const q = orderListQuery;\n", 'layer-import'],
  ['runtime → app', 'src/runtime/notices.ts', "import { App } from '@/app/App';\nexport const a = App;\n", 'layer-import'],
  ['feature → app', 'src/features/orders/model/use-app.ts', "import { App } from '@/app/App';\nexport const useApp = () => App;\n", 'layer-import'],
  ['feature → routes', 'src/features/orders/model/use-route.ts', "import { Route } from '@/routes/_app/route';\nexport const useRoute = () => Route;\n", 'layer-import'],
  ['다른 feature 내부', 'src/features/billing/model/use-orders.ts', "import { useOrderList } from '@/features/orders/model/use-order-list';\nexport const useOrders = useOrderList;\n", 'feature-public'],
  ['index.ts 재export로 api 우회', 'src/features/billing/ui/BillingPage.tsx', "import { orderListQuery } from '@/features/orders/index';\nexport const q = orderListQuery;\n", 'layer-import', { 'src/features/orders/index.ts': "export { isOrderOpen } from './model/order-policy';\nexport { orderListQuery } from './api/orders';\n" }],
  ['import 후 export로 api 우회', 'src/features/orders/ui/OrderPage.tsx', "import { query } from '../model/forward';\nexport const q = query;\n", 'layer-import', { 'src/features/orders/model/forward.ts': "import { orderListQuery } from '../api/orders';\nexport { orderListQuery as query };\n" }],
  ['model → React', 'src/features/orders/model/order-data.ts', "import { useState } from 'react';\nexport const useOrder = useState;\n", 'package-import'],
  ['model → 이동', 'src/features/orders/model/order-route.ts', "import { useNavigate } from '@tanstack/react-router';\nexport const go = useNavigate;\n", 'package-import'],
  ['model → 요청 실행(api 값)', 'src/features/orders/model/order-load.ts', "import { orderListQuery } from '../api/orders';\nexport const load = orderListQuery;\n", 'layer-import'],
  ['model → 생성 endpoint', 'src/features/orders/model/order-load.ts', "import { listOrders } from '@/api/generated/orders';\nexport const load = listOrders;\n", 'layer-import'],
  ['model → 브라우저 저장소', 'src/features/orders/model/order-memory.ts', "export const remember = (v: string) => localStorage.setItem('order', v);\n", 'browser-global'],
  ['model → 네트워크', 'src/features/orders/model/order-fetch.ts', "export const load = () => fetch('/orders');\n", 'browser-global'],
  ['state → screens', 'src/features/orders/model/order-view-state.ts', "import { OrderListPage } from '../ui/OrderListPage';\nexport const view = OrderListPage;\n", 'layer-import'],
  ['flows → screens', 'src/features/orders/model/use-view.ts', "import { OrderListPage } from '../ui/OrderListPage';\nexport const useView = () => OrderListPage;\n", 'layer-import'],
  ['flows의 JSX', 'src/features/orders/model/use-badge.tsx', 'export const useBadge = () => <span>badge</span>;\n', 'no-jsx'],
  ['screens → api 값', 'src/features/orders/ui/OrderPage.tsx', "import { orderListQuery } from '../api/orders';\nexport const q = orderListQuery;\n", 'layer-import'],
  ['screens → 동적 import api', 'src/features/orders/ui/OrderPage.tsx', "export const load = () => import('../api/orders');\n", 'layer-import'],
  ['screens → 생성 코드(별칭)', 'src/features/orders/ui/OrderPage.tsx', "import { listOrders } from '@/api/generated/orders';\nexport const q = listOrders;\n", 'layer-import'],
  ['screens → runtime', 'src/features/orders/ui/OrderPage.tsx', "import { http } from '@/runtime/http';\nexport const h = http;\n", 'layer-import'],
  ['screens → state 값', 'src/features/orders/ui/OrderPage.tsx', "import { orderListSearch } from '../model/order-list-search';\nexport const s = orderListSearch;\n", 'layer-import'],
  ['screens → zod', 'src/features/orders/ui/OrderPage.tsx', "import { z } from 'zod';\nexport const s = z.string();\n", 'package-import'],
  ['screens → useSaveForm', 'src/features/orders/ui/OrderPage.tsx', "import { useSaveForm } from '@boosterlab/web-kit/form';\nexport const use = useSaveForm;\n", 'package-import'],
  ['screens → useNavigate', 'src/features/orders/ui/OrderPage.tsx', "import { useNavigate } from '@tanstack/react-router';\nexport const use = useNavigate;\n", 'package-import'],
  ['screens → 요청 hook', 'src/features/orders/ui/OrderPage.tsx', "import { useQuery } from '@tanstack/react-query';\nexport const use = useQuery;\n", 'package-import'],
  ['routes → api', 'src/routes/_app/orders/new.tsx', "import { orderListQuery } from '@/features/orders/api/orders';\nexport const Route = { q: orderListQuery };\n", 'layer-import'],
  ['routes → runtime', 'src/routes/_app/orders/new.tsx', "import { http } from '@/runtime/http';\nexport const Route = { h: http };\n", 'layer-import'],
  ['routes → flows', 'src/routes/_app/orders/new.tsx', "import { useOrderList } from '@/features/orders/model/use-order-list';\nexport const Route = { u: useOrderList };\n", 'layer-import'],
  ['route 기본 loader', 'src/routes/_app/orders/new.tsx', "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/_app/orders/new')({ loader: () => undefined });\n", 'route-loader'],
  ['화면의 맨 button', 'src/features/orders/ui/OrderPage.tsx', 'export const Page = () => <button>save</button>;\n', 'raw-element'],
  ['route의 맨 input', 'src/routes/_app/orders/new.tsx', 'export const Page = () => <input />;\n', 'raw-element'],
  ['제품 코드 → mock', 'src/features/orders/model/use-mock.ts', "import { db } from '@/mocks/db';\nexport const useMock = () => db;\n", 'layer-import'],
  ['utils 이름', 'src/features/orders/utils.ts', 'export const x = 1;\n', 'file-layout'],
  ['feature 바로 아래 JSX 파일', 'src/features/orders/OrderCard.tsx', 'export const x = 1;\n', 'file-layout'],
  ['정해지지 않은 src 폴더', 'src/lib/date.ts', 'export const x = 1;\n', 'file-layout'],
  ['URL 폴더가 아닌 route 파일', 'src/routes/_app/orders/$orderId.tsx', 'export const Route = {};\n', 'file-layout'],
  ['route 폴더의 검사 파일', 'src/routes/_app/orders/index.test.tsx', 'export const x = 1;\n', 'file-layout'],
  ['$id 밖의 edit', 'src/routes/_app/orders/edit.tsx', 'export const Route = {};\n', 'file-layout'],
];

for (const [name, file, content, rule, extra = {}] of cases) {
  test('위반: ' + name, async () => {
    const result = await check('valid', { ...extra, [file]: content });
    assert.equal(result.ok, false, name + ' 위반을 통과시켰다');
    assert.ok(result.violations.some((v) => v.file === file && v.rule === rule), `${rule} 위반이 ${file}에서 나와야 한다\n${show(result)}`);
  });
}

test('인라인 eslint-disable 주석으로 구조 규칙을 끌 수 없다', async () => {
  const result = await check('valid', { 'src/features/orders/ui/OrderPage.tsx': "// eslint-disable-next-line web-kit-structure/layer-import\nimport { orderListQuery } from '../api/orders';\nexport const q = orderListQuery;\n" });
  assert.equal(result.ok, false, show(result));
});

test('예외: 파일·규칙·이유가 맞는 위반만 덮고, 쓰지 않는 예외와 다른 규칙 위반은 실패한다', async () => {
  const file = 'src/features/orders/ui/OrderPage.tsx';
  const content = "import { orderListQuery } from '../api/orders';\nexport const q = orderListQuery;\n";
  const covered = await check('valid', { [file]: content }, { config: { exceptions: [{ file, rule: 'layer-import', reason: '이전 전 화면. 인증 이전 묶음에서 flows로 옮긴다' }] } });
  assert.equal(covered.ok, true, show(covered));
  assert.equal(covered.excepted.length, 1);
  const unused = await check('valid', {}, { config: { exceptions: [{ file, rule: 'layer-import', reason: '이미 옮긴 화면의 남은 예외' }] } });
  assert.equal(unused.ok, false);
  assert.equal(unused.unusedExceptions.length, 1);
  const other = await check('valid', { [file]: content + 'export const B = () => <button />;\n' }, { config: { exceptions: [{ file, rule: 'layer-import', reason: '이전 전 화면. 인증 이전 묶음에서 옮긴다' }] } });
  assert.deepEqual(other.violations.map((v) => v.rule), ['raw-element']);
  await assert.rejects(check('valid', {}, { config: { exceptions: [{ file, rule: 'layer-import', reason: '' }] } }), /이유/);
});

// Pure model files keep the same protections at every business grouping depth.
for (const folder of ['model/', 'model/form/', 'model/policy/']) {
  for (const [label, content, rule] of [
    ['React', "import { useState } from 'react'; export const use = useState;", 'package-import'],
    ['browser', "export const read = () => localStorage.getItem('x');", 'browser-global'],
    ['api', "import { orderListQuery } from '@/features/orders/api/orders'; export const query = orderListQuery;", 'layer-import'],
    ['storage', "import { signedIn } from '@/features/orders/model/auth-session'; export const read = signedIn;", 'layer-import'],
    ['JSX', "export const View = () => <span />;", 'no-jsx'],
  ]) test(`pure ${folder || 'data'} rejects ${label}`, async () => {
    const file = `src/features/orders/${folder}order-data.${label === 'JSX' ? 'tsx' : 'ts'}`;
    const result = await check('valid', { [file]: content, 'src/features/orders/model/auth-session.ts': 'export const signedIn = true;' });
    assert.ok(result.violations.some(v => v.file === file && v.rule === (rule)), show(result));
  });
}
for (const folder of ['hooks', 'forms', 'rules', 'storage', 'search', 'pages', 'state', 'flows', 'screens']) test(`legacy ${folder} is rejected`, async () => {
  const file = `src/features/orders/${folder}/old.ts`;
  const result = await check('valid', { [file]: 'export const old = 1;' });
  assert.ok(result.violations.some(v => v.file === file && v.rule === 'file-layout'), show(result));
});
test('model data, colocated tests, UI messages/helpers are valid; permissions remain execution state', async () => {
  const files = {
    'src/features/orders/model/order.ts': 'export type Order = { id: string }; export const total = (n: number) => n * 2;',
    'src/features/orders/model/order.test.ts': 'export const test = 1;',
    'src/features/orders/ui/messages.ts': 'export const messages = { title: "Orders" };',
    'src/features/orders/model/order-permissions.ts': "import { http } from '@/runtime/http'; export const permissions = http;",
    'src/features/orders/ui/parts/OrderHeading.tsx': 'export const OrderHeading = () => <h1>Orders</h1>;',
  };
  const good = await check('valid', files);
  assert.equal(good.ok, true, show(good));
  const bad = await check('valid', { ...files, 'src/features/orders/ui/OrderPage.tsx': "import { permissions } from '../model/order-permissions'; export const p = permissions;" });
  assert.ok(bad.violations.some(v => v.rule === 'layer-import'), show(bad));
});
for (const folder of ['search', 'store']) test(`routes may use public ${folder}, pages may not execute it`, async () => {
  const files = {
    [`src/features/orders/model/connection-${folder}.ts`]: 'export const connection = {};',
    'src/features/orders/index.ts': `export { connection } from './model/connection-${folder}';`,
    'src/routes/_app/orders/index.tsx': "import { connection } from '@/features/orders/index'; export const Route = connection;",
  };
  const good = await check('valid', files);
  assert.equal(good.ok, true, show(good));
  const bad = await check('valid', { ...files, 'src/features/orders/ui/OrderPage.tsx': "import { connection } from '../index'; export const p = connection;" });
  assert.ok(bad.violations.some(v => v.rule === 'layer-import'), show(bad));
});

test('UI consumes pure model data and hook results, including nested UI helpers', async () => {
  const result = await check('valid', {
    'src/features/orders/model/order.ts': 'export const orderTitle = "Orders";',
    'src/features/orders/ui/parts/OrderSummary.tsx': "import { orderTitle } from '../../model/order'; import type { OrderQuery } from '../../model/order-form'; import { ORDER_LIMIT } from '../../model/order-policy'; export const OrderSummary = (_: { query: OrderQuery }) => <p>{orderTitle}{ORDER_LIMIT}</p>;",
  });
  assert.equal(result.ok, true, show(result));
});
for (const folder of ['store', 'search', 'hooks']) test(`${folder} cannot import page types or JSX`, async () => {
  const file = `src/features/orders/model/${folder === 'hooks' ? 'use-view' : 'view-' + folder}.tsx`;
  const result = await check('valid', { [file]: "import type { Query } from '../ui/OrderListPage'; export const View = (_: Query) => <span />;" });
  for (const rule of ['layer-import', 'no-jsx']) assert.ok(result.violations.some(v => v.file === file && v.rule === rule), show(result));
});
for (const folder of ['model/', 'model/form/', 'model/policy/']) test(`pure ${folder || 'data'} rejects search and runtime values but permits DTO types`, async () => {
  const file = `src/features/orders/${folder}boundaries.ts`;
  const result = await check('valid', { [file]: "import { http } from '@/runtime/http'; import { orderListSearch } from '@/features/orders/model/order-list-search'; import type { Order } from '@/api/generated/models/order'; export type Data = Order; export const values = [http, orderListSearch];" });
  assert.equal(result.violations.filter(v => v.file === file && v.rule === 'layer-import').length, 2, show(result));
});

for (const folder of ['schema', 'schemas']) {
  for (const parent of ['model', 'model/form']) test(`technical ${parent}/${folder} is rejected`, async () => {
    const file = `src/features/orders/${parent}/${folder}/order-form.ts`;
    const result = await check('valid', { [file]: 'export const initialOrder = { name: "" };' });
    assert.ok(result.violations.some(v => v.file === file && v.rule === 'file-layout'), show(result));
  });
}
test('form validation and mapping stay beside the business hook', async () => {
  const result = await check('valid', {
    'src/features/orders/model/form/order-form.ts': 'export const initialOrder = { name: "" }; export const toOrderRequest = (name: string) => ({ name: name.trim() });',
    'src/features/orders/model/form/use-order-form.ts': "import { initialOrder, toOrderRequest } from './order-form'; export const useOrderForm = () => toOrderRequest(initialOrder.name);",
  });
  assert.equal(result.ok, true, show(result));
});
