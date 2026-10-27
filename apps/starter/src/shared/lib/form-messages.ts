// 파일 책임: 폼 검증·서버 필드 오류 문구를 번역 참조로 저장하고 렌더할 때 현재 언어로 해소한다(web-kit createFormMessages).
import { createFormMessages } from '@boosterlab/web-kit/form';
import { useTranslation } from 'react-i18next';

export const formMessages = createFormMessages('i18n:');

/** 필드 오류 목록에서 첫 문구를 현재 언어로 돌려준다. */
export function useFieldMessage(): (errors: readonly unknown[]) => string | undefined {
  const { t } = useTranslation();
  return (errors) => (errors[0] === undefined ? undefined : formMessages.resolve(errors[0], (key, values) => t(key, values)));
}
