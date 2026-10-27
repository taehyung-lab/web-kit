// 파일 책임: route 트리의 뿌리. router context(QueryClient) 타입을 선언한다. 오류·없음 화면은 router 기본값이 맡는다.
import { FormNavigation } from '@boosterlab/web-kit/form/ui';
import { useTranslation } from 'react-i18next';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';

export interface RouterContext {
  readonly queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Root,
});

/** 앱 전체는 한 이탈 소유자를 사용하고 로그인은 제품 예외를 명시한다. */
function Root() {
  const { t } = useTranslation();
  return (
    <FormNavigation
      messages={{
        leaveTitle: t('common.unsavedTitle'),
        leaveDescription: t('common.unsavedBody'),
        leaveConfirm: t('common.leave'),
        keep: t('common.stay'),
        saveConfirm: t('common.save'),
        saveTitle: t('common.saveTitle'),
        navigationFailed: t('common.navigationFailed'),
        completionFailed: t('common.completionFailed'),
        unattached: t('failure.unattached'),
        cancel: t('common.cancel'),
      }}
    >
      <Outlet />
    </FormNavigation>
  );
}
