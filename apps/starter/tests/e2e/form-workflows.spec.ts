// 파일 책임: 실제 브라우저에서 작성 예제의 선택·임시 저장과 저장 뒤 후속 조회를 확인한다.
// 파일 책임: 공용 참조 정리·임시저장·저장 후 이탈 보호를 실제 브라우저에서 검사한다.
import { expect, test } from '@playwright/test';

test('reference cleanup and draft save share the form lifecycle', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('아이디').fill('admin');
  await page.getByLabel('비밀번호').fill('password');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/products$/);
  await page.getByRole('link', { name: '작성 예제' }).click();
  await page.getByRole('button', { name: '항목 추가' }).click();
  await page.getByRole('button', { name: '대표 항목' }).click();
  await page.getByRole('radio', { name: '새 항목 1' }).check();
  await page.keyboard.press('Escape');
  await page.getByLabel('항목 1 이름').fill('바뀐 이름');
  await expect(page.getByRole('button', { name: '대표 항목' })).toHaveText('바뀐 이름');
  await page.getByRole('button', { name: '항목 1 삭제' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('1곳에서 쓰고 있습니다.');
  await dialog.getByRole('button', { name: '취소' }).click();
  await expect(page.getByLabel('항목 1 이름')).toHaveValue('바뀐 이름');
  await page.getByRole('button', { name: '항목 1 삭제' }).click();
  await dialog.getByRole('button', { name: '함께 정리' }).click();
  await expect(page.getByLabel('항목 1 이름')).toHaveCount(0);
  await page.getByRole('button', { name: '게시', exact: true }).click();
  await expect(page.getByText('제목을 입력해 주세요.')).toBeVisible();
  const request = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/form-workflows'));
  await page.getByRole('button', { name: '임시 저장' }).click();
  expect((await request).postDataJSON()).toEqual({ mode: 'draft', values: { title: '', hasNote: false, note: '', items: [], selected: '' } });
  await expect(page.getByRole('status').filter({ hasText: '임시 저장했습니다.' })).toHaveText('임시 저장했습니다.');
  await page.getByRole('link', { name: '상품', exact: true }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('link', { name: '작성 예제' }).click();
  await page.getByRole('button', { name: '임시 저장' }).click();
  await expect(page.getByRole('status').filter({ hasText: '임시 저장했습니다.' })).toHaveText('임시 저장했습니다.');
  await page.getByLabel('제목').fill('저장 뒤 새 입력');
  await page.getByRole('link', { name: '상품', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('저장하지 않은 변경이 있습니다');
  await page.getByRole('button', { name: '계속 편집' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('저장 뒤 새 입력');
});

test('publishing completes after the project follow-up request', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('아이디').fill('admin');
  await page.getByLabel('비밀번호').fill('password');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/products$/);
  await page.getByRole('link', { name: '작성 예제' }).click();
  await page.evaluate(async () => {
    const path = '/src/mocks/db.ts';
    const { mockDb } = (await import(/* @vite-ignore */ path)) as { mockDb: { latencyMs: number } };
    mockDb.latencyMs = 800;
  });
  const sent: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/form-workflows')) sent.push(`${request.method()} ${path}`);
  });
  await page.getByLabel('제목').fill('게시 후 조회');
  const followUp = page.waitForRequest((request) => request.method() === 'GET' && request.url().includes('/api/form-workflows/'));
  await page.getByRole('button', { name: '게시', exact: true }).click();
  await followUp;
  await expect(page.getByText('게시했습니다.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '게시', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('게시했습니다.', { exact: true })).toBeVisible();
  expect(sent).toHaveLength(2);
  expect(sent[0]).toBe('POST /api/form-workflows');
  expect(sent[1]).toMatch(/^GET \/api\/form-workflows\/w-/);
});


test('conditional description restores the baseline and hidden save sends the declared empty value', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('아이디').fill('admin');
  await page.getByLabel('비밀번호').fill('password');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/products$/);
  await page.getByRole('link', { name: '작성 예제' }).click();
  const toggle = page.getByLabel('추가 설명 사용');
  const note = page.getByRole('textbox', { name: '추가 설명', exact: true });
  await expect(note).toHaveCount(0);
  await toggle.check();
  await note.fill('버릴 편집');
  await toggle.uncheck();
  await toggle.check();
  await expect(note).toHaveValue('');
  await toggle.uncheck();
  await page.getByRole('link', { name: '상품', exact: true }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('link', { name: '작성 예제' }).click();
  await page.getByRole('textbox', { name: '제목', exact: true }).fill('조건부 저장');
  await toggle.check();
  await note.fill('저장할 값');
  await page.getByRole('button', { name: '임시 저장' }).click();
  await expect(page.getByText('임시 저장했습니다.', { exact: true })).toBeVisible();
  await note.fill('저장 뒤 편집');
  await toggle.uncheck();
  await toggle.check();
  await expect(note).toHaveValue('저장할 값');
  await toggle.uncheck();
  const request = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/form-workflows'));
  await page.getByRole('button', { name: '게시', exact: true }).click();
  expect((await request).postDataJSON().values).toMatchObject({ hasNote: false, note: '' });
  await expect(page.getByText('게시했습니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
