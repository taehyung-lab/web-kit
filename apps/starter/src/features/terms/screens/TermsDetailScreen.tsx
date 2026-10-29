// 파일 책임: 약관 상세. 단건 상태 판정은 web-kit useRecord가 하고, 여기서는 항목 배치만 정한다.
import { Record } from '@/shared/ui/web-kit/detail-ui';
import { useRecord } from '@boosterlab/web-kit/record';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { termsQuery } from '../api/terms';

/** 약관 하나의 상세. */
export function TermsDetailScreen({ termsId }: { readonly termsId: string }) {
  const { t } = useTranslation();
  const state = useRecord(termsQuery(termsId), termsId, { progress: 'page' });
  return (
    <div className="flex flex-col gap-5">
      <h1>{t('terms.detailTitle')}</h1>
      <Record
        state={state}
        messages={{ loading: t('common.loading'), retry: t('common.retry'), refreshFailed: t('common.refreshFailed'), empty: t('common.empty') }}
        renderFailure={(failure) => t(failureCopyKey(failure))}
        missing={
          <>
            <p>{t('terms.notFound')}</p>
            <Link to="/terms/new">{t('terms.backToCreate')}</Link>
          </>
        }
      >
        {(terms) => (
          <Record.Fields>
            <Record.Field label={t('terms.fields.version')}>{terms.version}</Record.Field>
            <Record.Field label={t('terms.fields.effectiveAt')}>{terms.effectiveAt}</Record.Field>
            <Record.Field label={t('terms.fields.status')}>{t(`terms.status.${terms.status}`)}</Record.Field>
            <Record.Field label={t('terms.fields.publishedAt')}>{terms.publishedAt}</Record.Field>
            <Record.Field label={t('terms.fields.body')}>{terms.body}</Record.Field>
          </Record.Fields>
        )}
      </Record>
    </div>
  );
}
