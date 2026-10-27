// 파일 책임: 단위·화면 테스트 설정. jsdom 위에서 msw(node)로 API를 대신한다.
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
    env: { VITE_API_BASE_URL: '', VITE_API_TIMEOUT_MS: '5000' },
    // Node 25+ 기본 Web Storage 전역이 jsdom localStorage를 가린다. Node 24(CI 기준)에서도 같은 조건으로 끈다.
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
