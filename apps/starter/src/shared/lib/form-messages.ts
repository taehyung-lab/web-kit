// 파일 책임: 폼 검증·서버 필드 오류 문구를 번역 참조로 저장하고 렌더할 때 현재 언어로 해소한다(web-kit createFormMessages).
// 키트 Form에 넘길 이 앱의 문구 값(useFormCopy)도 여기서 한 번 만든다.
import { createFormMessages, FormRejection } from '@boosterlab/web-kit/form';
import type { FormMessages, RenderFormFailure } from '@/shared/ui/web-kit/form/ui';
import { useTranslation } from 'react-i18next';
import { failureCopyKey } from './failure-copy';

export const formMessages = createFormMessages('i18n:');

/** 필드 오류 목록에서 첫 문구를 현재 언어로 돌려준다. */
export function useFieldMessage(): (errors: readonly unknown[]) => string | undefined {
  const { t } = useTranslation();
  return (errors) => (errors[0] === undefined ? undefined : formMessages.resolve(errors[0], (key, values) => t(key, values)));
}

/** 이 앱의 폼 문구·오류 해소·실패 문구. 모든 `<Form>`에 같은 값을 넘긴다. */
export function useFormCopy(): {
  readonly messages: Partial<FormMessages>;
  readonly formatError: (errors: readonly unknown[]) => string | undefined;
  readonly renderFailure: RenderFormFailure;
} {
  const { t } = useTranslation();
  const formatError = useFieldMessage();
  return {
    messages: {
      saveFailed: t('failure.unknown'),
      completionFailed: t('common.completionFailed'),
      retry: t('common.retry'),
      loading: t('common.loading'),
      submit: t('common.save'),
      cancel: t('common.cancel'),
      confirmTitle: t('common.saveTitle'),
      confirm: t('common.save'),
      savedTitle: t('common.savedTitle'),
      savedConfirm: t('common.confirm'),
      saving: t('common.saving'),
      removeFile: t('common.removeFile'),
      sectionErrors: (count: number) => t('common.sectionErrors', { count }),
    },
    formatError,
    renderFailure: (failure, place) =>
      place === 'completion' || (failure instanceof FormRejection && failure.root !== undefined) ? undefined : t(failureCopyKey(failure)),
  };
}
