// 파일 책임: 로그인 성립·직접 로그아웃을 web-kit 세션 진입점(start·end)에 연결하고, 세션 변화(ended·replaced)를 화면 이동으로 바꾼다.
// 세션 판정(세대·종료 사유)은 web-kit 세션이 하고, 여기서는 그 결과에 따라 어디로 갈지만 정한다.
import { signOut as signOutRequest } from '@/features/auth/api/auth';
import type { AnyRouter } from '@tanstack/react-router';
import { createContext, use, useEffect, type ReactNode } from 'react';
import { session } from './web-kit';

interface Auth {
  /** 로그인 성공. 새 세션 세대를 연다. */
  readonly signIn: (accessToken: string) => void;
  /** 이 탭의 로그아웃. */
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<Auth | undefined>(undefined);

/** 세션 종료 사유(by)별 이동. 서버 종료는 보던 화면을 돌아올 곳으로 남긴다. */
function routeAfterEnd(router: AnyRouter, by: 'local' | 'other-tab' | 'server') {
  const here = router.state.location;
  const search =
    by === 'local'
      ? {}
      : by === 'other-tab'
        ? { reason: 'other-tab' as const }
        : { reason: 'server' as const, redirect: here.pathname === '/login' ? undefined : here.href };
  void router.navigate({ to: '/login', search, replace: true, ignoreBlocker: true });
}

/** 세션 구독과 로그인·로그아웃 진입점을 제공한다. router는 이동에만 쓴다. */
export function AuthProvider({ router, children }: { readonly router: AnyRouter; readonly children: ReactNode }) {
  useEffect(
    () =>
      session.subscribe((change) => {
        if (change.kind === 'ended') routeAfterEnd(router, change.by);
        // 다른 탭에서 다른 계정으로 바뀌었다. 이전 화면 데이터는 web-kit QueryClient가 이미 비웠다.
        else if (change.kind === 'replaced') void router.navigate({ to: '/', replace: true, ignoreBlocker: true });
      }),
    [router],
  );

  const auth: Auth = {
    signIn: (accessToken) => session.start({ accessToken }),
    // 토큰 캡처 → 로컬 종료(→ 로그인 이동) → 캡처한 토큰으로 sign-out 한 번. 서버 실패는 로컬 종료를 되돌리지 않는다.
    signOut: async () => {
      const accessToken = session.current()?.credentials.accessToken;
      session.end();
      if (accessToken === undefined) return;
      await signOutRequest(accessToken).catch(() => undefined);
    },
  };
  return <AuthContext value={auth}>{children}</AuthContext>;
}

/** 로그인·로그아웃 진입점. */
export function useAuth(): Auth {
  const auth = use(AuthContext);
  if (auth === undefined) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}
