// 파일 책임: 회원 목록(60명, 가상화 기준 50행 이상)의 고정 머리글을 실제 브라우저에서 관찰한다 — 스크롤해도 머리글이 위에 남고,
// 앱이 준 불투명한 머리글 표면이 지나가는 행을 가리며, 값 고르는 일괄 변경이 확인한 값으로 한 번 실행된다.
import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('아이디').fill('admin');
  await page.getByLabel('비밀번호').fill('password');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/products$/);
}

test('virtualized member table keeps an opaque header on top while rows scroll under it', async ({ page }) => {
  await signIn(page);
  await page.goto('/members?searched=true');
  const viewport = page.locator('[data-virtual]');
  await expect(viewport).toBeVisible();
  await expect(page.getByRole('cell', { name: 'member60@example.com' })).toBeVisible();
  const header = viewport.locator('thead');

  // 머리글 표면: 앱이 준 bg-muted가 키트 기본 배경을 이기고, 완전히 불투명하다.
  const background = await header.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
  expect(background).not.toMatch(/rgba\(.*,\s*0(\.\d+)?\)$/);
  expect(await header.evaluate((node) => getComputedStyle(node).position)).toBe('sticky');

  await viewport.evaluate((node) => node.scrollBy(0, 600));
  await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  const [viewBox, headBox] = await Promise.all([viewport.boundingBox(), header.boundingBox()]);
  // 스크롤한 뒤에도 머리글이 스크롤 영역 맨 위(테두리 1px 안쪽)에 붙어 있다.
  expect(Math.abs(headBox!.y - viewBox!.y)).toBeLessThanOrEqual(2);
  // 머리글 자리에서 맨 위 요소는 머리글이다(행이 위로 비치거나 덮지 않는다).
  const topmost = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('thead, tbody')?.tagName, { x: headBox!.x + headBox!.width / 2, y: headBox!.y + headBox!.height / 2 });
  expect(topmost).toBe('THEAD');
});

test('bulk status change runs once with the value fixed at confirmation and keeps the choice', async ({ page }) => {
  await signIn(page);
  await page.goto('/members?searched=true&accountStatuses=%5B%22DORMANT%22%5D');
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/members/status') posts.push(request.postData() ?? '');
  });
  const first = page.getByRole('checkbox', { name: /\d$/ }).first();
  await first.click();
  await page.getByRole('combobox', { name: '바꿀 계정 상태' }).click();
  await page.getByRole('option', { name: '정지' }).click();
  await page.getByRole('button', { name: '상태 변경' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('1명을 정지(으)로 바꿉니다.');
  await dialog.getByRole('button', { name: '확인' }).click();
  await expect(dialog).toBeHidden();
  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0]!)).toMatchObject({ accountStatus: 'BLOCKED' });
  await expect(page.getByRole('combobox', { name: '바꿀 계정 상태' })).toContainText('정지');
});
