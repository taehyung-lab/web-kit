// 파일 책임: 새 프로젝트 수용 검사. pnpm starter:create로 만든 프로젝트가 예시 업무 없이 시작하고, 다른 업무를 열지 않고
// 키트 기본 골격(web-kit-new)만으로 첫 업무의 목록·상세·등록·수정 화면을 만들 수 있는지 실제 설치·검사로 확인한다.
//   node scripts/check-new-project.mjs --workflow-kit <고정 AWK checkout> [--keep]
// 1. 임시 폴더에 새 프로젝트를 만든다(검사 앱 apps/starter는 바꾸지 않는다).
// 2. 예시 업무가 없다: features는 auth뿐이고 예시 업무 경로가 없다.
// 3. 설치 → 생성 코드(api:generate)·route 트리가 남은 명세·route와 같다 → pnpm check(format·typecheck·lint·build·적합성 unit/browser).
// 4. web-kit-new로 첫 업무 네 화면을 만든다. 채우기 전 typecheck는 미완성 표시로 실패해야 한다.
// 5. 미완성 표시만 검사용 값으로 채우면 typecheck·lint(구조 포함)가 통과하고, 로그인 뒤 네 주소가 각 화면을 그린다.
// 검사용 채움 값의 응답은 이 검사 안에서만 쓰는 고정 값이다(실제 서버 계약이 아니다).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStarter } from './create-starter.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const examples = JSON.parse(readFileSync(join(root, 'scripts/starter/examples.json'), 'utf8'));
const args = process.argv.slice(2);
const workflowKit = args[args.indexOf('--workflow-kit') + 1];
if (!args.includes('--workflow-kit') || !workflowKit) {
  console.error('사용법: node scripts/check-new-project.mjs --workflow-kit <고정 AWK checkout> [--keep]');
  process.exit(1);
}

const SCREENS = [
  ['list', '/orders', 'list screen'],
  ['detail', '/orders/$orderId', 'detail screen'],
  ['form', '/orders/new', 'create screen'],
  ['form', '/orders/$orderId/edit', 'edit screen'],
];
/** 키트 기본 골격의 미완성 표시 → 검사용 채움 값. 모르는 표시가 남으면 실패한다. */
const FILL = {
  model_fields: '{ readonly name: string }',
  form_fields: '{ name: z.string().trim().min(1) }',
  form_empty_values: "{ name: '' }",
  form_values: 'acceptanceFormValues',
  after_save: '() => undefined',
  list_endpoint: 'acceptanceList',
  detail_endpoint: 'acceptanceDetail',
  create_endpoint: 'acceptanceCreate',
  update_endpoint: 'acceptanceUpdate',
  list_layout: 'AcceptanceList',
  detail_layout: 'AcceptanceDetail',
  edit_layout: 'AcceptanceEdit',
  form_layout: 'AcceptanceForm',
};
/** 채움 값이 쓰는 이름을 그 파일 끝에 더한다. */
const ADD = {
  'api/order-list-query.ts': "\nasync function acceptanceList(_params: OrderListParams, _signal: AbortSignal): Promise<ListPage<Order>> {\n  return { rows: [{ id: '1', fields: { name: 'First order' } }], total: 1 };\n}\n",
  'api/order-detail-query.ts': "\nasync function acceptanceDetail(id: string, _signal: AbortSignal): Promise<Order> {\n  return { id, fields: { name: 'First order' } };\n}\n",
  'api/order-create.ts': "\nasync function acceptanceCreate(_output: OrderFormOutput): Promise<{ readonly id: string }> {\n  return { id: '2' };\n}\n",
  'api/order-update.ts': '\nasync function acceptanceUpdate(_id: string, _output: OrderFormOutput): Promise<void> {}\n',
  'model/form/use-order-edit.ts': '\nfunction acceptanceFormValues(record: Order) {\n  return { name: record.fields.name };\n}\n',
  'ui/list/OrderListPage.tsx': "\nfunction AcceptanceList(_props: { list: unknown }) {\n  return <p>list screen</p>;\n}\n",
  'ui/detail/OrderDetailPage.tsx': "\nfunction AcceptanceDetail(_props: { state: unknown }) {\n  return <p>detail screen</p>;\n}\n",
  'ui/form/OrderCreatePage.tsx': "\nfunction AcceptanceForm(_props: { editor: unknown }) {\n  return <p>create screen</p>;\n}\n",
  'ui/form/OrderEditPage.tsx':
    "\nfunction AcceptanceEdit(_props: { state: unknown; renderForm: unknown }) {\n  return <p>edit screen</p>;\n}\nfunction AcceptanceForm(_props: { editor: unknown }) {\n  return <p>edit form</p>;\n}\n",
};
const SCREEN_TEST = `import { renderApp } from '@/test/app';
import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';

it.each(${JSON.stringify(SCREENS.map(([, url, text]) => [url.replace('$orderId', '1'), text]))})('로그인 뒤 %s 주소가 그 화면을 그린다', async (url, text) => {
  renderApp(url);
  expect(await screen.findByText(text)).toBeTruthy();
});

it('로그인하지 않았으면 첫 업무 화면도 로그인으로 보낸다', async () => {
  const { router } = renderApp('/orders', { signedIn: false });
  await screen.findByLabelText(/아이디/);
  expect(router.state.location.pathname).toBe('/login');
});
`;

/** 명령을 실행한다. 실패하면 출력과 함께 멈춘다. */
function expectPass(name, cwd, command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd, encoding: 'utf8', env: { ...process.env, CI: '1' } });
  if (result.status !== 0) throw new Error(`${name} 실패\n${result.stdout}${result.stderr}`);
  console.log(`  통과 ${name}`);
  return result.stdout;
}
/** 폴더 아래 파일 목록(내용 지문 포함). */
function snapshot(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      return `${relative(dir, path)} ${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
    })
    .sort();
}

const parent = mkdtempSync(join(tmpdir(), 'web-kit-new-project-'));
const project = join(parent, 'first-project');
try {
  console.log(`새 프로젝트 수용 검사(${project})`);
  createStarter(project, resolve(workflowKit));
  console.log('  통과 starter:create');

  // 2. 예시 업무가 없다.
  const features = readdirSync(join(project, 'src/features'));
  if (JSON.stringify(features) !== JSON.stringify(['auth'])) throw new Error(`새 프로젝트 features가 auth뿐이 아니다: ${features.join(', ')}`);
  for (const path of examples.remove) if (existsSync(join(project, path))) throw new Error(`예시 업무가 남았다: ${path}`);
  if (!existsSync(join(root, 'apps/starter/src/features/products'))) throw new Error('검사 앱의 예시 업무가 사라졌다');
  console.log('  통과 예시 업무 없음(features: auth), 검사 앱 예시 보존');

  // 3. 설치와 기반 검사. 생성 코드·route 트리는 남은 명세·route에서 다시 만들어도 같아야 한다.
  expectPass('pnpm install --frozen-lockfile', project, 'pnpm', ['install', '--frozen-lockfile']);
  const generated = snapshot(join(project, 'src/api/generated'));
  expectPass('pnpm api:generate', project, 'pnpm', ['api:generate']);
  if (JSON.stringify(snapshot(join(project, 'src/api/generated'))) !== JSON.stringify(generated))
    throw new Error('생성 코드가 남은 서버 명세와 다르다(scripts/starter/examples.json의 openapi·remove 목록을 확인)');
  console.log('  통과 생성 코드 = 남은 서버 명세');
  const routeTree = readFileSync(join(project, 'src/routeTree.gen.ts'), 'utf8');
  expectPass('pnpm check', project, 'pnpm', ['check']);
  if (readFileSync(join(project, 'src/routeTree.gen.ts'), 'utf8') !== routeTree)
    throw new Error('route 트리가 남은 route와 다르다(scripts/starter/without-examples/src/routeTree.gen.ts를 다시 만든다)');
  console.log('  통과 route 트리 = 남은 route');

  // 4. 첫 업무 네 화면을 키트 기본 골격으로 만든다.
  for (const [kind, url] of SCREENS) expectPass(`web-kit-new ${kind} ${url}`, project, 'pnpm', ['exec', 'web-kit-new', '--feature', 'orders', '--kind', kind, '--url', url]);
  const before = spawnSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.app.json', '--noEmit'], { cwd: project, encoding: 'utf8' });
  if (before.status === 0 || !/TODO_web_kit_new_/.test(before.stdout + before.stderr)) throw new Error('채우기 전 골격이 typecheck를 통과했다');
  console.log('  통과 채우기 전 typecheck는 미완성 표시로 실패한다');

  // 5. 미완성 표시만 채운다.
  const featureDir = join(project, 'src/features/orders');
  for (const entry of readdirSync(featureDir, { recursive: true, withFileTypes: true }).filter((item) => item.isFile())) {
    const path = join(entry.parentPath, entry.name);
    const local = relative(featureDir, path);
    const text = (readFileSync(path, 'utf8') + (ADD[local] ?? '')).replace(/TODO_web_kit_new_([A-Za-z0-9_]+)/g, (marker, name) => {
      if (!Object.hasOwn(FILL, name)) throw new Error(`채움 값이 없는 미완성 표시: ${marker} (${local})`);
      return FILL[name];
    });
    writeFileSync(path, text);
  }
  writeFileSync(join(featureDir, 'ui/Orders.test.tsx'), SCREEN_TEST);
  expectPass('route 트리 재생성(build)', project, 'pnpm', ['build']);
  expectPass('typecheck', project, 'pnpm', ['typecheck']);
  expectPass('lint(구조 포함)', project, 'pnpm', ['lint']);
  expectPass('첫 업무 화면 검사', project, 'pnpm', ['exec', 'vitest', 'run', 'src/features/orders']);
  console.log('새 프로젝트 수용 검사 통과');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (args.includes('--keep')) console.log(`보존: ${project}`);
  else rmSync(parent, { recursive: true, force: true });
}
