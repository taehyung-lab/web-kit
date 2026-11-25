import { expect, test } from '@playwright/test';
// 파일 책임: 설치한 브라우저 검사 화면을 키트 Playwright 적합성 검사에 연결한다.
import { checkDialogBrowser } from '@boosterlab/web-kit/testing/browser';
import installation from '../../../registry-installation.json' with { type: 'json' };
checkDialogBrowser({
  url: '/web-kit-checks/dialog.html',
  target: { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit },
});

test('hands keyboard focus from the running confirmation to its result and back', async ({
  page,
}) => {
  await page.goto('/web-kit-checks/dialog.html');
  const start = page.getByRole('button', { name: 'Start bulk action' });
  await start.focus();
  await page.keyboard.press('Enter');
  const confirm = page.getByRole('alertdialog', { name: 'Apply to selected rows?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: '확인' }).press('Enter');

  const result = page.getByRole('alertdialog', { name: 'Bulk action results' });
  await expect(page.getByRole('alertdialog')).toHaveCount(1);
  await expect(result.getByText('1 processed · 1 not processed')).toBeVisible();
  const acknowledge = result.getByRole('button', { name: '확인' });
  await expect(acknowledge).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(result).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(acknowledge).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(result).toBeHidden();
  await expect(start).toBeFocused();
});
