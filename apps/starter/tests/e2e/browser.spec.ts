// 파일 책임: jsdom으로 볼 수 없는 키트 보장을 실제 브라우저에서 관찰한다 — 여러 탭의 세션, 진입 주소 정규화와 요청 순서, 결과가 있을 때의 재조회 실패, 저장 직후 이동과 이탈 질문,
// 저장·페이지 첫 조회 중 화면 전체 덮개(실제 inert 클릭·Tab 차단).
import { expect, test, type Page, type Request } from '@playwright/test';

/** mock 계정으로 로그인하고 상품 목록이 보일 때까지 기다린다. */
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('아이디').fill('admin');
  await page.getByLabel('비밀번호').fill('password');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/products$/);
  // URL 이동만 기다리면 다음 화면의 요청 기록에 로그인 직후 목록 요청이 섞일 수 있다.
  await expect(page.getByRole('cell', { name: 'Mouse Pad' })).toBeVisible();
}

/** 기록 시작 후 발생한 API 요청과 그 성공 응답만 순서대로 기록한다. */
function recordApi(page: Page) {
  const events: string[] = [];
  const requests = new Set<Request>();
  const line = (url: URL) => `${url.pathname}${decodeURIComponent(url.search)}`;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      requests.add(request);
      events.push(`→ ${request.method()} ${line(url)}`);
    }
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (requests.has(response.request()) && response.status() === 200) events.push(`← 200 ${url.pathname}`);
  });
  return events;
}

test('signing out in one tab ends the session in the other tab', async ({ context }) => {
  const first = await context.newPage();
  await signIn(first);
  const second = await context.newPage();
  await second.goto('/products');
  await expect(second.getByRole('cell', { name: 'Mouse Pad' })).toBeVisible();

  await first.getByRole('button', { name: '로그아웃' }).click();

  await expect(second).toHaveURL(/\/login\?reason=other-tab/);
  await expect(second.getByText('다른 탭에서 로그아웃했습니다.')).toBeVisible();
});

test('an entry URL with unknown values is replaced and the list waits for the options', async ({ page }) => {
  await signIn(page);
  const events = recordApi(page);
  await page.goto('/products?keyword=a&categoryId=c-gone&statuses=ACTIVE,BOGUS&sort=color');

  await expect(page).toHaveURL(/\/products\?keyword=a$/);
  await expect(page.getByRole('cell').first()).toBeVisible();
  const products = events.filter((event) => event.startsWith('→ GET /api/products'));
  // 없는 분류는 선택지를 받은 뒤 버려지고, 목록 요청은 고친 조건으로만, 선택지 응답 뒤에 나간다.
  expect(products.length).toBeGreaterThan(0);
  expect(products.every((event) => !event.includes('categoryId') && !event.includes('BOGUS'))).toBe(true);
  expect(events.indexOf(products[0]!)).toBeGreaterThan(events.indexOf('← 200 /api/categories'));
  expect(events.indexOf('← 200 /api/categories')).toBeGreaterThan(-1);
});

test('a failed background refresh keeps the rows and offers a retry', async ({ page }) => {
  await signIn(page);
  // mock 서버(이 페이지의 msw)를 내려 같은 조건 재조회를 실패시킨다.
  await page.evaluate(async () => {
    // 개발 서버가 앱과 같은 모듈 인스턴스로 내주는 경로다(브라우저 안에서만 존재).
    const dbModule = '/src/mocks/db.ts';
    const { mockDb } = (await import(/* @vite-ignore */ dbModule)) as { mockDb: object };
    Object.defineProperty(mockDb, 'products', {
      get: () => {
        throw new Error('mock server down');
      },
      configurable: true,
    });
  });
  await page.getByRole('button', { name: '검색' }).click();

  await expect(page.getByText('최신 내용을 불러오지 못했습니다.', { exact: false })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Mouse Pad' })).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
});

/** 등록 폼을 유효한 값으로 채운다. */
async function fillNewProduct(page: Page) {
  await page.goto('/products/new');
  await page.getByLabel('상품명').fill('Fresh Item');
  await page.getByLabel('상품 코드').fill('FRESH-1');
  await page.getByLabel(/옵션명 1/).fill('Large');
  await expect(page.getByRole('option', { name: 'Stationery' })).toBeAttached();
  await page.getByLabel('분류').selectOption({ label: 'Stationery' });
}

test('saving a new product moves to its detail without an unsaved-changes question', async ({ page }) => {
  await signIn(page);
  await fillNewProduct(page);
  await page.getByRole('button', { name: '등록', exact: true }).click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

/** 브라우저 mock 응답 지연을 바꾼다(진행 중 화면을 오래 붙잡아 본다). 개발 서버가 앱과 같은 모듈 인스턴스로 내주는 경로다. */
async function setLatency(page: Page, ms: number) {
  await page.evaluate(async (value) => {
    const dbModule = '/src/mocks/db.ts';
    const { mockDb } = (await import(/* @vite-ignore */ dbModule)) as { mockDb: { latencyMs: number } };
    mockDb.latencyMs = value;
  }, ms);
}

/** 앱 본문(덮개가 막는 영역) 안에 포커스가 있는가. */
function focusInBody(page: Page) {
  return page.evaluate(() => document.activeElement?.closest('.wk-blocking-root') != null);
}

// 저장 중에는 화면 전체 덮개가 입력을 막는다(2026-10-28 사용자 결정, 0008). 이전의 "저장 중 입력 → 이동 때 묻기"는 덮개가 대신한다.
test('saving a new product covers the page with the create message and blocks clicks and Tab', async ({ page }) => {
  await signIn(page);
  await fillNewProduct(page);
  await setLatency(page, 1500);
  await page.getByRole('button', { name: '등록', exact: true }).click();
  await expect(page.locator('.wk-blocking').getByText('등록 중입니다.')).toBeVisible();
  await expect(page.locator('.wk-blocking').getByText('잠시만 기다려 주세요.')).toBeVisible();
  // 화면 낭독기는 늘 있는 상태 영역에서 같은 문구를 읽는다.
  await expect(page.getByRole('status').filter({ hasText: '등록 중입니다.' })).toHaveText('등록 중입니다. 잠시만 기다려 주세요.');
  await expect(page.locator('.wk-blocking-root')).toHaveAttribute('inert', '');
  await expect(page.locator('.wk-blocking-root')).toHaveAttribute('aria-busy', 'true');
  // 덮개가 위에 있어 입력칸 클릭이 닿지 않고, Tab으로도 본문에 들어가지 못한다.
  await expect(page.getByLabel('상품명').click({ timeout: 300 })).rejects.toThrow();
  await page.keyboard.press('Tab');
  expect(await focusInBody(page)).toBe(false);
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(page.locator('.wk-blocking')).toHaveCount(0);
});

test('an edit closes the confirmation, covers the page with the edit message, then shows the detail', async ({ page }) => {
  await signIn(page);
  await page.getByRole('cell', { name: 'Mouse Pad' }).click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await page.goto(`${new URL(page.url()).pathname}/edit`);
  await page.getByLabel('상품명').fill('Mouse Pad 3');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toBeVisible();
  await expect(page.locator('.wk-blocking')).toHaveCount(0);
  await setLatency(page, 1500);
  await confirm.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.locator('.wk-blocking').getByText('수정 중입니다.')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(page.locator('.wk-blocking')).toHaveCount(0);
});

// 확인창을 거친 저장이 칸 없는 오류(500)로 끝나면, 확인창 버튼은 사라졌으므로 포커스는 본문에서 확인창을 연 저장 버튼으로 돌아온다(0008 포커스).
test('an edit that fails after the confirmation returns focus to the save button, not the document body', async ({ page }) => {
  await signIn(page);
  await page.getByRole('cell', { name: 'Mouse Pad' }).click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await page.goto(`${new URL(page.url()).pathname}/edit`);
  await page.getByLabel('상품명').fill('Mouse Pad 500');
  const save = page.getByRole('button', { name: '저장', exact: true });
  await save.click();
  const confirm = page.getByRole('alertdialog');
  await setLatency(page, 800);
  await confirm.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.locator('.wk-blocking').getByText('수정 중입니다.')).toBeVisible();
  // 덮개가 열린 동안 mock 서버를 내려 PUT을 500으로 끝낸다(지연 뒤 상품 조회에서 예외).
  await page.evaluate(async () => {
    const dbModule = '/src/mocks/db.ts';
    const { mockDb } = (await import(/* @vite-ignore */ dbModule)) as { mockDb: object };
    Object.defineProperty(mockDb, 'products', {
      get: () => {
        throw new Error('mock server down');
      },
      configurable: true,
    });
  });
  await expect(page.locator('.wk-blocking')).toHaveCount(0);
  await expect(page.locator('.wk-form-failure')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(save).toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
});

test('a page entry is covered while its first data loads, a page change keeps the rows uncovered', async ({ page }) => {
  await signIn(page);
  await setLatency(page, 1500);
  await page.getByRole('cell', { name: 'Mouse Pad' }).click();
  await expect(page.locator('.wk-blocking').getByText('데이터를 불러오는 중입니다.')).toBeVisible();
  await expect(page.locator('.wk-blocking-root')).toHaveAttribute('inert', '');
  await expect(page.getByText('Mouse Pad').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.wk-blocking')).toHaveCount(0);

  await page.goBack();
  await expect(page.getByRole('cell', { name: 'Mouse Pad' })).toBeVisible();
  // 같은 조건 다시 조회: 요청이 진행되는 동안(응답 1.5초 지연) 이전 결과를 보인 채 한 번도 덮지 않는다.
  const refetch = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/products');
  await page.getByRole('button', { name: '검색' }).click();
  await refetch;
  const coveredDuringRefetch = await page.evaluate(async () => {
    for (let i = 0; i < 10; i += 1) {
      if (document.querySelector('.wk-blocking') !== null || document.querySelector('.wk-blocking-root[inert]') !== null) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  });
  expect(coveredDuringRefetch).toBe(false);
  await expect(page.getByRole('cell', { name: 'Mouse Pad' })).toBeVisible();
});

test('leaving with unsaved input asks first and staying keeps the input', async ({ page }) => {
  await signIn(page);
  await page.goto('/products/new');
  await page.getByLabel('상품명').fill('Kept name');
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '계속 편집' }).click();
  await expect(page.getByLabel('상품명')).toHaveValue('Kept name');
});

test('saving an edit moves to the detail without an unsaved-changes question', async ({ page }) => {
  await signIn(page);
  await page.getByRole('cell', { name: 'Mouse Pad' }).click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await page.goto(`${new URL(page.url()).pathname}/edit`);
  await page.getByLabel('상품명').fill('Mouse Pad 2');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '저장', exact: true }).click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

// 기본 확인 UI의 키보드 focus와 필수 표시를 실제 브라우저에서 확인한다.
test('save confirmation traps focus and Escape returns to the save button', async ({ page }, testInfo) => {
  await signIn(page);
  await page.getByRole('cell', { name: 'Mouse Pad' }).click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await page.goto(`${new URL(page.url()).pathname}/edit`);
  await expect(page.getByRole('option', { name: 'Kitchen' })).toBeAttached();
  await expect(page.getByLabel('분류')).toHaveValue('c-kitchen');
  const name = page.getByLabel('상품명');
  await expect(name).toHaveAttribute('aria-required', 'true');
  await name.fill('Keyboard edit');
  const save = page.getByRole('button', { name: '저장', exact: true });
  await save.click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="alertdialog"]')!;
    (window as unknown as { focusEscaped: boolean }).focusEscaped = false;
    document.addEventListener('focusin', (event) => {
      if (dialog.isConnected && !dialog.contains(event.target as Node)) (window as unknown as { focusEscaped: boolean }).focusEscaped = true;
    });
  });
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press(key);
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }
  }
  expect(await page.evaluate(() => (window as unknown as { focusEscaped: boolean }).focusEscaped)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('save-dialog.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(save).toBeFocused();
  await expect(name).toHaveValue('Keyboard edit');
  await page.screenshot({ path: testInfo.outputPath('edit-form.png'), fullPage: true });
});

// 새 공용 선택 칸을 포장한 패키지로 소비하며 값·URL 복원을 확인한다.
test('choice filters keep selected values in the URL and restore their labels', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: '분류', exact: true }).click();
  await page.getByRole('radio', { name: 'Stationery' }).check();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page).toHaveURL(/categoryId=c-stationery/);
  await page.reload();
  await expect(page.getByRole('button', { name: '분류', exact: true })).toHaveText('Stationery');
  await expect(page.getByRole('cell', { name: 'Notebook A5' })).toBeVisible();
});

test('the login form leaves without a dirty-input question', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('아이디').fill('작성 중인 아이디');
  let questions = 0;
  page.on('dialog', async (dialog) => { questions += 1; await dialog.accept(); });
  await page.reload();
  await expect(page.getByLabel('아이디')).toHaveValue('');
  expect(questions).toBe(0);
});
