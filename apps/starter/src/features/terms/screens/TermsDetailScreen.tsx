// 파일 책임: 약관 상세. 단건 상태 판정은 상세 flow(useRecord)가 하고, 여기서는 항목 배치만 정한다.
import { Detail } from '@/shared/ui/web-kit/detail';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useTermsDetail } from '../flows/use-terms-detail';

/** 약관 하나의 상세. */
export function TermsDetailScreen({ termsId }: { readonly termsId: string }) {
  const { t } = useTranslation();
  const state = useTermsDetail(termsId);
  return (
    <div className="flex flex-col gap-5">
      <h1>{t('terms.detailTitle')}</h1>
      <Detail
        state={state}
        missing={
          <>
            <p>{t('terms.notFound')}</p>
            <Link to="/terms/new">{t('terms.backToCreate')}</Link>
          </>
        }
      >
        {(terms) => (
          <Detail.Fields>
            <Detail.Field label={t('terms.fields.version')}>{terms.version}</Detail.Field>
            <Detail.Field label={t('terms.fields.effectiveAt')}>{terms.effectiveAt}</Detail.Field>
            <Detail.Field label={t('terms.fields.status')}>{t(`terms.status.${terms.status}`)}</Detail.Field>
            <Detail.Field label={t('terms.fields.publishedAt')}>{terms.publishedAt}</Detail.Field>
            <Detail.Field label={t('terms.fields.body')}>{terms.body}</Detail.Field>
          </Detail.Fields>
        )}
      </Detail>
    </div>
  );
}
