// 파일 책임: 앱 router를 만든다. 파일 route 트리와 기본 오류·없음 화면을 연결한다.
// route에는 기본 loader를 두지 않는다. 조회 상태 판정은 화면 flow(useList·useRecord)가 한 곳에서 한다.
import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';
import { RouteError, RouteNotFound } from './errors';

/** router 하나. 테스트는 memory history를 넘긴다. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    defaultPreload: 'intent',
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
