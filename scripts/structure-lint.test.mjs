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

test('정상 구조: 타입 전용 import·생성 모델 값·public.ts 재export·검사 파일·지원 코드는 통과한다', async () => {
  const result = await check('valid');
  assert.equal(result.ok, true, show(result));
  assert.equal(result.violations.length, 0);
  assert.ok(result.files >= 15, '실제 파일을 검사해야 한다: ' + result.files);
});

test('모노레포: 부모 tsconfig의 paths 별칭을 해소하고 다른 workspace 패키지는 앱 구조 밖으로 본다', async () => {
  const result = await check('monorepo', {}, { project: 'apps/admin' });
  assert.equal(result.ok, true, show(result));
  const bad = await check('monorepo', { 'src/shared/bad.ts': "import { X_LIMIT } from '@admin/features/x/rules/x-policy';\nexport const n = X_LIMIT;\n" }, { project: 'apps/admin' });
  assert.deepEqual(bad.violations.map((v) => [v.file, v.rule]), [['src/shared/bad.ts', 'layer-import']], show(bad));
});

const cases = [
  ['shared → feature(별칭)', 'src/shared/lib/order-label.ts', "import { ORDER_LIMIT } from '@/features/orders/rules/order-policy';\nexport const label = ORDER_LIMIT;\n", 'layer-import'],
  ['shared → feature(타입 전용도 금지)', 'src/shared/lib/order-label.ts', "import type { OrderQuery } from '@/features/orders/forms/order-form';\nexport type Label = OrderQuery;\n", 'layer-import'],
  ['shared → 생성 코드', 'src/shared/lib/order-label.ts', "import { listOrders } from '@/api/generated/orders';\nexport const load = listOrders;\n", 'layer-import'],
  ['runtime → feature(상대 경로)', 'src/runtime/sign-out.ts', "import { orderListQuery } from '../features/orders/api/orders';\nexport const q = orderListQuery;\n", 'layer-import'],
  ['runtime → app', 'src/runtime/notices.ts', "import { App } from '@/app/App';\nexport const a = App;\n", 'layer-import'],
  ['feature → app', 'src/features/orders/hooks/use-app.ts', "import { App } from '@/app/App';\nexport const useApp = () => App;\n", 'layer-import'],
  ['feature → routes', 'src/features/orders/hooks/use-route.ts', "import { Route } from '@/routes/_app/route';\nexport const useRoute = () => Route;\n", 'layer-import'],
  ['다른 feature 내부', 'src/features/billing/hooks/use-orders.ts', "import { useOrderList } from '@/features/orders/hooks/use-order-list';\nexport const useOrders = useOrderList;\n", 'feature-public'],
  ['public.ts 재export로 api 우회', 'src/features/billing/pages/BillingPage.tsx', "import { orderListQuery } from '@/features/orders/public';\nexport const q = orderListQuery;\n", 'layer-import', { 'src/features/orders/public.ts': "export { isOrderOpen } from './rules/order-policy';\nexport { orderListQuery } from './api/orders';\n" }],
  ['import 후 export로 api 우회', 'src/features/orders/pages/OrderPage.tsx', "import { query } from '../hooks/forward';\nexport const q = query;\n", 'layer-import', { 'src/features/orders/hooks/forward.ts': "import { orderListQuery } from '../api/orders';\nexport { orderListQuery as query };\n" }],
  ['model → React', 'src/features/orders/rules/order-state.ts', "import { useState } from 'react';\nexport const useOrder = useState;\n", 'package-import'],
  ['model → 이동', 'src/features/orders/rules/order-route.ts', "import { useNavigate } from '@tanstack/react-router';\nexport const go = useNavigate;\n", 'package-import'],
  ['model → 요청 실행(api 값)', 'src/features/orders/rules/order-load.ts', "import { orderListQuery } from '../api/orders';\nexport const load = orderListQuery;\n", 'layer-import'],
  ['model → 생성 endpoint', 'src/features/orders/rules/order-load.ts', "import { listOrders } from '@/api/generated/orders';\nexport const load = listOrders;\n", 'layer-import'],
  ['model → 브라우저 저장소', 'src/features/orders/rules/order-memory.ts', "export const remember = (v: string) => localStorage.setItem('order', v);\n", 'browser-global'],
  ['model → 네트워크', 'src/features/orders/rules/order-fetch.ts', "export const load = () => fetch('/orders');\n", 'browser-global'],
  ['state → screens', 'src/features/orders/storage/order-view.ts', "import { OrderListPage } from '../pages/OrderListPage';\nexport const view = OrderListPage;\n", 'layer-import'],
  ['flows → screens', 'src/features/orders/hooks/use-view.ts', "import { OrderListPage } from '../pages/OrderListPage';\nexport const useView = () => OrderListPage;\n", 'layer-import'],
  ['flows의 JSX', 'src/features/orders/hooks/use-badge.tsx', 'export const useBadge = () => <span>badge</span>;\n', 'no-jsx'],
  ['screens → api 값', 'src/features/orders/pages/OrderPage.tsx', "import { orderListQuery } from '../api/orders';\nexport const q = orderListQuery;\n", 'layer-import'],
  ['screens → 동적 import api', 'src/features/orders/pages/OrderPage.tsx', "export const load = () => import('../api/orders');\n", 'layer-import'],
  ['screens → 생성 코드(별칭)', 'src/features/orders/pages/OrderPage.tsx', "import { listOrders } from '@/api/generated/orders';\nexport const q = listOrders;\n", 'layer-import'],
  ['screens → runtime', 'src/features/orders/pages/OrderPage.tsx', "import { http } from '@/runtime/http';\nexport const h = http;\n", 'layer-import'],
  ['screens → state 값', 'src/features/orders/pages/OrderPage.tsx', "import { orderListSearch } from '../search/order-list-search';\nexport const s = orderListSearch;\n", 'layer-import'],
  ['screens → zod', 'src/features/orders/pages/OrderPage.tsx', "import { z } from 'zod';\nexport const s = z.string();\n", 'package-import'],
  ['screens → useSaveForm', 'src/features/orders/pages/OrderPage.tsx', "import { useSaveForm } from '@boosterlab/web-kit/form';\nexport const use = useSaveForm;\n", 'package-import'],
  ['screens → useNavigate', 'src/features/orders/pages/OrderPage.tsx', "import { useNavigate } from '@tanstack/react-router';\nexport const use = useNavigate;\n", 'package-import'],
  ['screens → 요청 hook', 'src/features/orders/pages/OrderPage.tsx', "import { useQuery } from '@tanstack/react-query';\nexport const use = useQuery;\n", 'package-import'],
  ['routes → api', 'src/routes/_app/orders/new.tsx', "import { orderListQuery } from '@/features/orders/api/orders';\nexport const Route = { q: orderListQuery };\n", 'layer-import'],
  ['routes → runtime', 'src/routes/_app/orders/new.tsx', "import { http } from '@/runtime/http';\nexport const Route = { h: http };\n", 'layer-import'],
  ['routes → flows', 'src/routes/_app/orders/new.tsx', "import { useOrderList } from '@/features/orders/hooks/use-order-list';\nexport const Route = { u: useOrderList };\n", 'layer-import'],
  ['route 기본 loader', 'src/routes/_app/orders/new.tsx', "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/_app/orders/new')({ loader: () => undefined });\n", 'route-loader'],
  ['화면의 맨 button', 'src/features/orders/pages/OrderPage.tsx', 'export const Page = () => <button>save</button>;\n', 'raw-element'],
  ['route의 맨 input', 'src/routes/_app/orders/new.tsx', 'export const Page = () => <input />;\n', 'raw-element'],
  ['제품 코드 → mock', 'src/features/orders/hooks/use-mock.ts', "import { db } from '@/mocks/db';\nexport const useMock = () => db;\n", 'layer-import'],
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
  const result = await check('valid', { 'src/features/orders/pages/OrderPage.tsx': "// eslint-disable-next-line web-kit-structure/layer-import\nimport { orderListQuery } from '../api/orders';\nexport const q = orderListQuery;\n" });
  assert.equal(result.ok, false, show(result));
});

test('예외: 파일·규칙·이유가 맞는 위반만 덮고, 쓰지 않는 예외와 다른 규칙 위반은 실패한다', async () => {
  const file = 'src/features/orders/pages/OrderPage.tsx';
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

// Every pure role keeps the same protections after removing model/ nesting.
for (const folder of ['', 'forms/', 'rules/']) {
  for (const [label, content, rule] of [
    ['React', "import { useState } from 'react'; export const use = useState;", 'package-import'],
    ['browser', "export const read = () => localStorage.getItem('x');", 'browser-global'],
    ['api', "import { orderListQuery } from '@/features/orders/api/orders'; export const query = orderListQuery;", 'layer-import'],
    ['storage', "import { signedIn } from '@/features/orders/storage/signed-in'; export const read = signedIn;", 'layer-import'],
    ['JSX', "export const View = () => <span />;", 'no-jsx'],
  ]) test(`pure ${folder || 'data'} rejects ${label}`, async () => {
    const file = `src/features/orders/${folder}order-data.${label === 'JSX' ? 'tsx' : 'ts'}`;
    const result = await check('valid', { [file]: content, 'src/features/orders/storage/signed-in.ts': 'export const signedIn = true;' });
    assert.ok(result.violations.some(v => v.file === file && v.rule === (folder === '' && label === 'JSX' ? 'file-layout' : rule)), show(result));
  });
}
for (const folder of ['model', 'state', 'flows', 'screens']) test(`legacy ${folder} is rejected`, async () => {
  const file = `src/features/orders/${folder}/old.ts`;
  const result = await check('valid', { [file]: 'export const old = 1;' });
  assert.ok(result.violations.some(v => v.file === file && v.rule === 'file-layout'), show(result));
});
test('root data, colocated tests, messages and local page helpers are valid; permissions is execution storage', async () => {
  const files = {
    'src/features/orders/order.ts': 'export type Order = { id: string }; export const total = (n: number) => n * 2;',
    'src/features/orders/order.test.ts': 'export const test = 1;',
    'src/features/orders/messages.ts': 'export const messages = { title: "Orders" };',
    'src/features/orders/permissions.ts': "import { http } from '@/runtime/http'; export const permissions = http;",
    'src/features/orders/pages/parts/OrderHeading.tsx': 'export const OrderHeading = () => <h1>Orders</h1>;',
  };
  const good = await check('valid', files);
  assert.equal(good.ok, true, show(good));
  const bad = await check('valid', { ...files, 'src/features/orders/pages/OrderPage.tsx': "import { permissions } from '../permissions'; export const p = permissions;" });
  assert.ok(bad.violations.some(v => v.rule === 'layer-import'), show(bad));
});
for (const folder of ['search', 'storage']) test(`routes may use public ${folder}, pages may not execute it`, async () => {
  const files = {
    [`src/features/orders/${folder}/connection.ts`]: 'export const connection = {};',
    'src/features/orders/public.ts': `export { connection } from './${folder}/connection';`,
    'src/routes/_app/orders/index.tsx': "import { connection } from '@/features/orders/public'; export const Route = connection;",
  };
  const good = await check('valid', files);
  assert.equal(good.ok, true, show(good));
  const bad = await check('valid', { ...files, 'src/features/orders/pages/OrderPage.tsx': "import { connection } from '../public'; export const p = connection;" });
  assert.ok(bad.violations.some(v => v.rule === 'layer-import'), show(bad));
});

test('pages consume pure forms/rules/data and hook results, including nested UI helpers', async () => {
  const result = await check('valid', {
    'src/features/orders/order.ts': 'export const orderTitle = "Orders";',
    'src/features/orders/pages/parts/OrderSummary.tsx': "import { orderTitle } from '../../order'; import type { OrderQuery } from '../../forms/order-form'; import { ORDER_LIMIT } from '../../rules/order-policy'; export const OrderSummary = (_: { query: OrderQuery }) => <p>{orderTitle}{ORDER_LIMIT}</p>;",
  });
  assert.equal(result.ok, true, show(result));
});
for (const folder of ['storage', 'search', 'hooks']) test(`${folder} cannot import page types or JSX`, async () => {
  const file = `src/features/orders/${folder}/view.tsx`;
  const result = await check('valid', { [file]: "import type { Query } from '../pages/OrderListPage'; export const View = (_: Query) => <span />;" });
  for (const rule of ['layer-import', 'no-jsx']) assert.ok(result.violations.some(v => v.file === file && v.rule === rule), show(result));
});
for (const folder of ['', 'forms/', 'rules/']) test(`pure ${folder || 'data'} rejects search and runtime values but permits DTO types`, async () => {
  const file = `src/features/orders/${folder}boundaries.ts`;
  const result = await check('valid', { [file]: "import { http } from '@/runtime/http'; import { orderListSearch } from '@/features/orders/search/order-list-search'; import type { Order } from '@/api/generated/models/order'; export type Data = Order; export const values = [http, orderListSearch];" });
  assert.equal(result.violations.filter(v => v.file === file && v.rule === 'layer-import').length, 2, show(result));
});
