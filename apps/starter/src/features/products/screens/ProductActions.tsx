// 파일 책임: 상품 목록의 보기 크기와 일괄 판매 중지 확인을 배치한다. 실행은 목록 flow가 넘긴 동작이 맡는다.
import { PageSize, ListActions, BulkAction } from '@/shared/ui/web-kit/list-ui';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZES } from '../model/rules/product-list-policy';

/** 확정된 선택에 일괄 작업을 실행하고 완료 건수를 알린다. */
export function ProductActions({
  total,
  selectedCount,
  deactivateSelected,
  done,
}: {
  readonly total: number;
  readonly selectedCount: number;
  readonly deactivateSelected: (ids: readonly string[]) => Promise<{ readonly completedIds: readonly string[]; readonly value: number }>;
  readonly done: number | undefined;
}) {
  const { t } = useTranslation();
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
