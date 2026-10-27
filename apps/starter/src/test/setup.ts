// 파일 책임: 테스트 공통 준비. msw server를 켜고, 테스트마다 화면·mock 상태·세션·캐시·언어를 처음으로 되돌린다.
import { i18n } from '@/app/i18n';
import { notices } from '@/app/notices';
import { queryClient, session } from '@/app/web-kit';
import { mockDb } from '@/mocks/db';
import { server } from '@/mocks/server';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

// jsdom에는 스크롤이 없다. router의 scroll 복원이 남기는 경고만 막는다.
window.scrollTo = () => undefined;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
  session.end();
  queryClient.clear();
  notices.clear();
  mockDb.reset();
  localStorage.clear();
  await i18n.changeLanguage('ko');
});

afterAll(() => server.close());
