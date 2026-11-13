// 파일 책임: 앱 맨 위 한 곳에서 키트 폼·대화창·목록·상세의 기본 문구(현재 언어 번역)·칸 오류 해소·실패 문구를 공급한다.
// 화면의 <Form>·대화창·<List>·<Record>는 공용 문구 prop 없이 이 값을 쓰고, 화면이 준 값은 그 화면에서만 앞선다.
import { FormRejection } from '@boosterlab/web-kit/form';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { useFieldMessage } from '@/shared/lib/form-messages';
import { RecordDefaults } from '@/shared/ui/web-kit/detail-ui';
import { FormDefaults } from '@/shared/ui/web-kit/form/ui';
import { ListDefaults } from '@/shared/ui/web-kit/list-ui';
import { DialogDefaults } from '@/shared/ui/web-kit/ui/dialog';

/** 대화창 버튼 문구와 폼·목록·상세 기본값을 현재 언어로 공급한다. 언어를 바꾸면 열린 화면의 문구도 함께 바뀐다. */
export function AppCopyDefaults({ children }: { readonly children: ReactNode }) {
  const { t } = useTranslation();
  const formatError = useFieldMessage();
  return (
    <DialogDefaults labels={{ close: t('common.close'), confirm: t('common.confirm'), cancel: t('common.cancel'), pending: t('common.processing') }}>
      <FormDefaults
        messages={{
          saveFailed: t('failure.unknown'),
          completionFailed: t('common.completionFailed'),
          retry: t('common.retry'),
          loading: t('common.loading'),
          optionsFailed: t('common.optionsFailed'),
          choose: t('common.choose'),
          submit: t('common.save'),
          cancel: t('common.cancel'),
          confirmTitle: t('common.saveTitle'),
          confirm: t('common.save'),
          savedTitle: t('common.savedTitle'),
          savedConfirm: t('common.confirm'),
          saving: t('common.saving'),
          removeFile: t('common.removeFile'),
          count: (current, max) => t('common.count', { current, max }),
          sectionErrors: (count) => t('common.sectionErrors', { count }),
          referenceTitle: (count) => t('common.referenceTitle', { count }),
          referenceConfirm: t('common.referenceConfirm'),
        }}
        formatError={formatError}
        // 완료 처리 실패와 화면 절차가 정한 폼 한 줄(FormRejection root)은 키트 문구·그 문구를 그대로 쓰고, 그 밖의 저장 실패는 실패 종류별 문구로 바꾼다.
        renderFailure={(failure, place) =>
          place === 'completion' || (failure instanceof FormRejection && failure.root !== undefined) ? undefined : t(failureCopyKey(failure))
        }
      >
        <ListDefaults
          messages={{
            retry: t('common.retry'),
            loading: t('common.loading'),
            refreshFailed: t('common.refreshFailed'),
            selectPage: t('common.selectPage'),
            selectRow: t('common.selectRow'),
            confirm: t('common.confirm'),
            cancel: t('common.cancel'),
            chooseValue: t('common.chooseValue'),
          }}
          // 이전 결과를 보이는 중의 실패는 원인 없이 안내(refreshFailed)만 보이고, 그 밖의 실패는 실패 종류별 문구로 바꾼다.
          renderFailure={(failure, place) => (place === 'refresh' ? '' : t(failureCopyKey(failure)))}
        >
          <RecordDefaults
            messages={{ loading: t('common.loading'), retry: t('common.retry'), refreshFailed: t('common.refreshFailed'), empty: t('common.empty') }}
            renderFailure={(failure) => t(failureCopyKey(failure))}
          >
            {children}
          </RecordDefaults>
        </ListDefaults>
      </FormDefaults>
    </DialogDefaults>
  );
}
