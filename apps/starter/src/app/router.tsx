// 파일 책임: 앱 router를 만든다. 파일 route 트리, QueryClient context, 기본 오류·없음 화면을 연결한다.
import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';
import { RouteError, RouteNotFound } from './errors';
import { queryClient } from './web-kit';

/** router 하나. 테스트는 memory history를 넘긴다. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultPreload: 'intent',
    // 목록·상세 데이터 판정은 화면(useList·useRecord)이 한다. route 캐시는 쓰지 않는다.
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
