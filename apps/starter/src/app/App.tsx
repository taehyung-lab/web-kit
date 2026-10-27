// 파일 책임: provider 조립(QueryClient·i18n·인증)과 router 렌더. 실행 진입(main)과 화면 테스트가 같은 조립을 쓴다.
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { I18nextProvider } from 'react-i18next';
import { AuthProvider } from './auth';
import { AppErrorBoundary } from './errors';
import { i18n } from './i18n';
import { NoticeOutlet } from './NoticeOutlet';
import type { createAppRouter } from './router';
import { queryClient } from './web-kit';

/** 앱 전체. router는 호출부가 만든다(브라우저 history 또는 테스트 memory history). */
export function App({ router }: { readonly router: ReturnType<typeof createAppRouter> }) {
  return (
    <AppErrorBoundary fallback={<p className="p-8 text-center text-sm text-slate-600">{i18n.t('app.crashed')}</p>}>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <AuthProvider router={router}>
            <RouterProvider router={router} />
            <NoticeOutlet />
          </AuthProvider>
        </I18nextProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
