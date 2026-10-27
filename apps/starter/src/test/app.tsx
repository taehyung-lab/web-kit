// 파일 책임: 화면 테스트 도우미. 실제 앱 조립(App·router·web-kit 연결)을 memory history로 띄우고, 보낸 요청을 기록한다.
import { App } from '@/app/App';
import { createAppRouter } from '@/app/router';
import { session } from '@/app/web-kit';
import { mockDb } from '@/mocks/db';
import { server } from '@/mocks/server';
import { createMemoryHistory } from '@tanstack/react-router';
import { render } from '@testing-library/react';

/** 보낸 요청 하나: "METHOD /path?query"와 Authorization 헤더. */
export interface SentRequest {
  readonly line: string;
  readonly authorization: string | null;
}

/** 지금부터 보내는 요청을 기록한다. */
export function recordRequests(): SentRequest[] {
  const sent: SentRequest[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    sent.push({ line: `${request.method} ${url.pathname}${decodeURIComponent(url.search)}`, authorization: request.headers.get('Authorization') });
  });
  return sent;
}

/** url에서 앱을 띄운다. signedIn이면 mock 서버가 아는 토큰으로 세션을 먼저 연다. */
export function renderApp(url: string, { signedIn = true }: { readonly signedIn?: boolean } = {}) {
  if (signedIn) session.start({ accessToken: mockDb.issueToken() });
  const history = createMemoryHistory({ initialEntries: [url] });
  const router = createAppRouter(history);
  const requests = recordRequests();
  const view = render(<App router={router} />);
  return { router, history, requests, ...view };
}
