// 파일 책임: 세션 변화(ended·replaced)를 화면 이동으로 바꾼다. 세션 판정(세대·종료 사유)은 web-kit 세션이 하고, 여기서는 어디로 갈지만 정한다.
// 로그인 성립은 auth feature의 로그인 flow가, 직접 로그아웃은 앱 골격이 runtime 세션에 바로 요청한다.
import type { AnyRouter } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import type { SessionChange } from '@boosterlab/web-kit/session';
import { session } from '@/runtime/web-kit';

/** 세션 종료 사유(by)별 이동. 서버 종료·유휴 만료는 같은 만료 안내로 보내고 보던 화면을 돌아올 곳으로 남긴다. */
function routeAfterEnd(router: AnyRouter, by: Extract<SessionChange, { kind: 'ended' }>['by']) {
  const here = router.state.location;
  const search =
    by === 'local'
      ? {}
      : by === 'other-tab'
        ? { reason: 'other-tab' as const }
        : { reason: 'server' as const, redirect: here.pathname === '/login' ? undefined : here.href };
  void router.navigate({ to: '/login', search, replace: true, ignoreBlocker: true });
}

/** 세션 구독을 앱 수명 동안 둔다. router는 이동에만 쓴다. */
export function SessionNavigation({ router, children }: { readonly router: AnyRouter; readonly children: ReactNode }) {
  useEffect(
    () =>
      session.subscribe((change) => {
        if (change.kind === 'ended') routeAfterEnd(router, change.by);
        // 다른 탭에서 다른 계정으로 바뀌었다. 이전 화면 데이터는 web-kit QueryClient가 이미 비웠다.
        else if (change.kind === 'replaced') void router.navigate({ to: '/', replace: true, ignoreBlocker: true });
      }),
    [router],
  );
  return children;
}
