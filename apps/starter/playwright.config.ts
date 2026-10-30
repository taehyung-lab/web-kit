// 파일 책임: 실제 브라우저 검사 설정. mock 모드 개발 서버(msw worker)를 띄우고 tests/e2e를 chromium으로 돌린다.
import { defineConfig } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT ?? '4180';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: true,
  reporter: [['list'], ['json', { outputFile: '.web-kit-results/browser.json' }]],
  use: { baseURL, trace: 'retain-on-failure', locale: 'ko-KR' },
  webServer: {
    command: `pnpm dev:mock --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
  },
});
