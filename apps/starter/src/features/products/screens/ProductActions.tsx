// 파일 책임: 상품 목록의 보기 크기와 일괄 비활성화 업무를 연결한다.
import { PageSize, ListActions, BulkAction } from '@boosterlab/web-kit/list/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeactivateProducts } from '../api/products';
import { PAGE_SIZES } from '../model/list-search';
/** 확정된 선택에 일괄 작업을 실행하고 완료 건수를 알린다. */
export function ProductActions({ total, selectedCount }: { readonly total: number; readonly selectedCount: number }) {
  const { t } = useTranslation();
  const deactivate = useDeactivateProducts();
  const [done, setDone] = useState<number>();
  /** 서버가 완료한 선택만 키트의 선택 상태에서 제거한다. */
  async function deactivateSelected(ids: readonly string[]) {
    const count = await deactivate.mutateAsync(ids);
    setDone(count);
    return { completedIds: count === ids.length ? ids : [], value: count };
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div>{t('products.list.total', { count: total })}</div>
        <PageSize sizes={PAGE_SIZES} />
        <ListActions>
          <BulkAction
            label={t('products.bulk.deactivate', { count: selectedCount })}
            title={t('products.bulk.title')}
            confirmLabel={t('products.bulk.confirm')}
            describe={(ids) => t('products.bulk.body', { count: ids.length })}
            run={deactivateSelected}
          />
        </ListActions>
      </div>
      {done !== undefined && <p role="status">{t('products.bulk.done', { count: done })}</p>}
    </>
  );
}
