// 파일 책임: 약관 등록 흐름. 검증 → 저장 확인 → 저장 → 저장 완료 확인 → 새 약관 상세. 흐름(확인·완료 확인·이탈 보호·오류 위치)은 키트 값(confirm·acknowledge)으로만 켠다.
import { useSaveForm } from '@boosterlab/web-kit/form';
import { useNavigate } from '@tanstack/react-router';
import { useCreateTerms } from '../api/terms';
import { EMPTY_TERMS_FORM, termsFieldError, termsFormSchema, type TermsFormValues } from '../model/forms/terms-form';

const SOURCE = { id: 'new', values: EMPTY_TERMS_FORM } as const;

/** 등록 화면이 쓸 폼 상태. */
export function useTermsCreate() {
  const navigate = useNavigate();
  const create = useCreateTerms();
  /** 검증된 약관을 등록하고 상세 화면에 필요한 식별자를 돌려준다. */
  async function saveTerms(values: TermsFormValues) {
    return { id: (await create.mutateAsync(values)).termsId };
  }
  const editor = useSaveForm({
    schema: termsFormSchema,
    source: SOURCE,
    confirm: true,
    progress: 'create',
    acknowledge: true,
    fieldError: termsFieldError,
    save: saveTerms,
    onSaved: (result) => navigate({ to: '/terms/$termsId', params: { termsId: result.id } }),
  });
  return { editor };
}
