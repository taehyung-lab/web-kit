// 파일 책임: 업무 화면 없이도 지켜야 하는 앱 골격의 실제 브라우저 검사 — 로그인 폼의 이탈 질문 없음, 한 탭의 로그아웃 → 다른 탭 세션 종료.
// 예시 업무를 쓰지 않으므로 pnpm starter:create로 만든 새 프로젝트에도 남는다.
import { expect, test, type Page } from '@playwright/test';

/** mock 계정으로 로그인하고 앱 골격(로그아웃 버튼)이 보일 때까지 기다린다. 첫 화면은 프로젝트가 정한다. */
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('아이디').fill('admin');
  await page.getByLabel('비밀번호').fill('password');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();
}

test('the login form leaves without a dirty-input question', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('아이디').fill('작성 중인 아이디');
  let questions = 0;
  page.on('dialog', async (dialog) => { questions += 1; await dialog.accept(); });
  await page.reload();
  await expect(page.getByLabel('아이디')).toHaveValue('');
  expect(questions).toBe(0);
});

test('signing out in one tab ends the session in the other tab', async ({ context }) => {
  const first = await context.newPage();
  await signIn(first);
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('button', { name: '로그아웃' })).toBeVisible();

  await first.getByRole('button', { name: '로그아웃' }).click();

  await expect(second).toHaveURL(/\/login\?reason=other-tab/);
  await expect(second.getByText('다른 탭에서 로그아웃했습니다.')).toBeVisible();
});
