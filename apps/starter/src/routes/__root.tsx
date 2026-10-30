// 파일 책임: route 트리의 뿌리. router context(QueryClient) 타입을 선언한다. 오류·없음 화면은 router 기본값이 맡는다.
import { FormGuard } from '@/shared/ui/web-kit/form/ui';
import { useTranslation } from 'react-i18next';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';

export interface RouterContext {
  readonly queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Root,
});

/** 앱 전체는 이탈 보호 하나를 쓰고, 로그인은 제품 예외(protect={false})를 명시한다. */
function Root() {
  const { t } = useTranslation();
  const leave = { title: t('common.unsavedTitle'), description: t('common.unsavedBody'), confirm: t('common.leave'), keep: t('common.stay') };
  return (
    <FormGuard messages={{ navigate: leave, cancel: leave, navigationFailed: t('common.navigationFailed') }}>
      <Outlet />
    </FormGuard>
  );
}
