// 파일 책임: 공연 예시(배열·파일·하위 폼 연결)를 실제 브라우저에서 관찰한다 — 회차 서버 오류 위치·이동 뒤 위치,
// 대화창 하위 폼 Enter 제출 격리, 일반 칸 Enter = 제출, 저장 실패 뒤 좌석도 파일 보존과 재업로드(multipart), 저장 중 화면 전체 덮개와 실패 뒤 포커스 복원.
import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('아이디').fill('admin');
  await page.getByLabel('비밀번호').fill('password');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/products$/);
  await page.getByRole('link', { name: '공연 예시' }).click();
}

test('show example keeps errors on their round, isolates the dialog, keeps the file and covers the page while saving', async ({ page }) => {
  await signIn(page);
  const api: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname.startsWith('/api/')) api.push(`${url.pathname} ${request.headers()['content-type'] ?? ''}`);
  });

  // 대화창: Enter는 하위 폼만 제출한다(바깥 공연명은 비어 있어도 검증·요청 없음).
  await page.getByRole('button', { name: '판매처 키 입력' }).click();
  const dialog = page.getByRole('dialog', { name: '판매처 키 입력' });
  await dialog.getByLabel(/판매처 키 1/).fill('YES24-K1');
  await dialog.getByLabel(/판매처 키 1/).press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.getByText('YES24-K1')).toBeVisible();
  await expect(page.getByLabel(/공연명/)).not.toHaveAttribute('aria-invalid', 'true');
  expect(api).toEqual([]);

  // 일반 칸의 Enter는 제출(저장 버튼 클릭)이다: 공연명이 비어 있어 검증이 돌고 요청은 없다.
  await page.getByLabel(/^1회차 날짜/).press('Enter');
  await expect(page.getByLabel(/공연명/)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel(/공연명/)).toBeFocused();
  expect(api).toEqual([]);

  await page.getByLabel(/공연명/).fill('E2E-실패 공연');
  await page.getByLabel(/^1회차 날짜/).fill('2026-11-01');
  await page.getByLabel(/^1회차 시각/).fill('19:00');
  await page.getByRole('button', { name: '회차 추가' }).click();
  await page.getByLabel(/^2회차 날짜/).fill('2026-11-01');
  await page.getByLabel(/^2회차 시각/).fill('19:00');
  await page.getByLabel(/좌석배치도/).setInputFiles({ name: 'seat-map.png', mimeType: 'image/png', buffer: Buffer.from('png') });

  // 저장 실패(500): 저장 중 화면 전체 덮개(등록 문구)·버튼 잠금, 버튼 옆 진행 표시는 없다. 실패 뒤 덮개가 닫히고
  // inert가 밀어낸 포커스는 저장 버튼으로 돌아오며, 파일은 남는다.
  const save = page.getByRole('button', { name: '저장', exact: true });
  await save.click();
  await expect(page.locator('.wk-blocking').getByText('등록 중입니다.')).toBeVisible();
  await expect(save).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.wk-blocking-root .wk-spinner')).toHaveCount(0);
  await expect(page.getByText('서버에서 오류가 발생했습니다. 잠시 뒤 다시 시도하세요.')).toBeVisible();
  await expect(page.locator('.wk-blocking')).toHaveCount(0);
  await expect(save).toBeFocused();
  await expect(page.getByText('seat-map.png')).toBeVisible();

  // 같은 일시 회차 → 서버 필드 오류가 2회차 시각 칸에, 위로 옮기면 그 줄(1회차)을 따라간다.
  // 회차 구역을 닫아 두고 저장하면, 서버 오류가 온 뒤 구역이 펼쳐지고 머리글에 오류 표시, 그 칸에 포커스한다.
  await page.getByLabel(/공연명/).fill('E2E-회차 중복');
  const roundsHeader = page.getByRole('button', { name: /^회차( 오류 \d+개)?$/ });
  await roundsHeader.click();
  await expect(roundsHeader).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByLabel(/^2회차 시각/)).toHaveAttribute('aria-invalid', 'true');
  await expect(roundsHeader).toHaveAttribute('aria-expanded', 'true');
  await expect(roundsHeader).toContainText('오류 1개');
  await expect(page.getByLabel(/^2회차 시각/)).toBeFocused();
  await expect(page.getByLabel(/^1회차 시각/)).not.toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel(/^2회차 날짜/).fill('2026-11-02');
  await page.getByRole('button', { name: '2회차 위로' }).click();
  await expect(page.getByLabel(/^1회차 날짜/)).toHaveValue('2026-11-02');
  await expect(page.getByLabel(/^1회차 시각/)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel(/^2회차 시각/)).not.toHaveAttribute('aria-invalid', 'true');

  // 고친 뒤 저장: 같은 파일을 multipart로 다시 올리고 등록한다.
  await page.getByLabel(/^1회차 시각/).fill('21:00');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.getByRole('alertdialog', { name: '저장되었습니다.' }).getByRole('button', { name: '확인' }).click();
  await expect(page).toHaveURL(/\/products$/);
  const uploads = api.filter((line) => line.startsWith('/api/files'));
  expect(uploads).toHaveLength(3);
  for (const line of uploads) expect(line).toContain('multipart/form-data');
  expect(api.filter((line) => line.startsWith('/api/shows'))).toHaveLength(3);
});
