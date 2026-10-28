// 파일 책임: 레퍼런스 약관 등록 재현(키트 값만으로 조립한 폼)을 실제 브라우저에서 관찰한다 — 저장 확인 → 저장 → 저장 완료 확인 → 상세, 확인창 포커스.
import { expect, test } from '@playwright/test';

test('terms create confirms, saves once, acknowledges and opens the detail', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('아이디').fill('admin');
  await page.getByLabel('비밀번호').fill('password');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/products$/);
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/terms') posts.push(request.url());
  });
  // 전체 새로 고침은 브라우저 mock 서버의 메모리를 비운다. 사용자처럼 메뉴로 이동한다.
  await page.getByRole('link', { name: '약관 등록' }).click();
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByLabel(/버전/)).toBeFocused();
  await page.getByLabel(/버전/).fill('9.1');
  await page.getByLabel(/시행일/).fill('2026-11-01');
  await page.getByLabel(/게시일/).fill('2026-10-28');
  await page.getByLabel(/본문/).fill('E2E-약관 본문');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await confirm.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  await confirm.getByRole('button', { name: '저장' }).click();
  const saved = page.getByRole('alertdialog', { name: '저장되었습니다.' });
  await expect(saved).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(saved).toBeVisible();
  await saved.getByRole('button', { name: '확인' }).click();
  await expect(page).toHaveURL(/\/terms\/t-\d+$/);
  await expect(page.getByText('E2E-약관 본문')).toBeVisible();
  expect(posts).toHaveLength(1);
});
