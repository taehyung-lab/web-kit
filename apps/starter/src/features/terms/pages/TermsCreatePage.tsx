// 파일 책임: 약관 등록 예시 화면. 칸 배치와 확인·완료 문구를 그린다. 저장 흐름은 등록 flow가 맡는다. 취소는 상품 목록으로 간다.
import { Form } from '@/shared/ui/web-kit/form/form';
import { useTranslation } from 'react-i18next';
import { useTermsCreate } from '../hooks/use-terms-create';
import { TERMS_STATUSES, type TermsFormInput } from '../forms/terms-form';

const F = Form.of<TermsFormInput>();

/** 약관 등록. */
export function TermsCreatePage() {
  const { t } = useTranslation();
  const { editor } = useTermsCreate();
  return (
    <div className="flex flex-col gap-5">
      <h1>{t('terms.createTitle')}</h1>
      <F editor={editor} confirm={{ body: () => <p>{t('terms.confirmBody')}</p> }} saved={{ body: t('terms.savedBody') }}>
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
        <div className="flex flex-wrap items-center gap-2">
          <F.Submit />
          <F.Cancel to={{ to: '/products' }} />
        </div>
      </F>
    </div>
  );
}
