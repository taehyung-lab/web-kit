// 파일 책임: pnpm dev:mock 에서 브라우저 service worker로 mock API를 켠다.
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** mock worker를 시작한다. 처리하지 않는 요청(정적 파일 등)은 그대로 통과시킨다. */
export async function startMockWorker() {
  await setupWorker(...handlers).start({ onUnhandledRequest: 'bypass' });
}
