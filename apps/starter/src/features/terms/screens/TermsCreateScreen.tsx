// 파일 책임: 약관 등록 화면(레퍼런스 11.2.3 재현). 검증 → 저장 확인 → 저장 → 저장 완료 확인 → 새 약관 상세. 취소는 상품 목록으로 간다.
// 흐름(확인·완료 확인·이탈 보호·오류 위치)은 키트 값(confirm·acknowledge)으로만 켠다.
import { useSaveForm } from '@boosterlab/web-kit/form';
import { Form } from '@boosterlab/web-kit/form/ui';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useFormCopy } from '@/shared/lib/form-messages';
import { useCreateTerms } from '../api/terms';
import { EMPTY_TERMS_FORM, TERMS_STATUSES, termsFieldError, termsFormSchema, type TermsFormInput } from '../model/terms';

const F = Form.of<TermsFormInput>();
const SOURCE = { id: 'new', values: EMPTY_TERMS_FORM } as const;

/** 약관 등록. */
export function TermsCreateScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateTerms();
  const copy = useFormCopy();
  const editor = useSaveForm({
    schema: termsFormSchema,
    source: SOURCE,
    confirm: true,
    acknowledge: true,
    fieldError: termsFieldError,
    save: async (values) => ({ id: (await create.mutateAsync(values)).termsId }),
    onSaved: (result) => navigate({ to: '/terms/$termsId', params: { termsId: result.id } }),
  });
  return (
    <div className="flex flex-col gap-5">
      <h1>{t('terms.createTitle')}</h1>
      <F editor={editor} {...copy}>
        <F.Failure />
        <F.Section title={t('terms.section')}>
          <div className="grid gap-5 md:grid-cols-2">
            <F.Text name="version" label={t('terms.fields.version')} maxLength={10} />
            <F.Text name="effectiveAt" type="date" label={t('terms.fields.effectiveAt')} />
            <F.Select
              name="status"
              label={t('terms.fields.status')}
              options={TERMS_STATUSES.map((value) => ({ value, label: t(`terms.status.${value}`) }))}
            />
            <F.Text name="publishedAt" type="date" label={t('terms.fields.publishedAt')} />
          </div>
          <F.TextArea name="body" label={t('terms.fields.body')} rows={10} />
        </F.Section>
        <div className="wk-actions">
          <F.Submit />
          <F.Cancel to={{ to: '/products' }} />
        </div>
        <F.Confirm>{() => <p>{t('terms.confirmBody')}</p>}</F.Confirm>
        <F.Saved>{t('terms.savedBody')}</F.Saved>
      </F>
    </div>
  );
}
