// 파일 책임: 상품 목록의 제목·필터·작업·결과를 배치하고 경로 이동을 연결한다.
import { ListProvider, ListResult, ResultTable, Pagination } from '@boosterlab/web-kit/list/ui';
import { useList } from '@boosterlab/web-kit/list';
import type { UrlSearch } from '@boosterlab/web-kit/search';
import { useTranslation } from 'react-i18next';
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { productListQuery } from '../api/products';
import { PRODUCT_LIST_PERIODS, productListSearch, toListProductsParams } from '../model/list-search';
import { ProductFilters } from './ProductFilters';
import { ProductActions } from './ProductActions';
import { useProductColumns } from './product-columns';
/** 같은 목록 상태를 필터·표·페이지·확인 작업에 전달한다. */
export function ProductListScreen({
  search,
  navigate,
  onOpen,
  onCreate,
}: {
  readonly search: UrlSearch;
  readonly navigate: (next: UrlSearch, options: { readonly replace: boolean }) => void;
  readonly onOpen: (id: string) => void;
  readonly onCreate: () => void;
}) {
  const { t } = useTranslation();
  const columns = useProductColumns();
  const list = useList({
    definition: productListSearch,
    search,
    navigate,
    progress: 'page',
    query: (full) => productListQuery(toListProductsParams(full)),
    rowId: (row) => row.id,
    selectable: (row) => row.status !== 'INACTIVE',
    periods: PRODUCT_LIST_PERIODS,
  });
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1>{t('products.title')}</h1>
        <button className="wk-button" onClick={onCreate}>
          {t('products.create')}
        </button>
      </header>
      <ListProvider
        model={list}
        renderFailure={(failure, place) => (place === 'refresh' ? '' : t(failureCopyKey(failure)))}
        messages={{
          search: t('products.filter.submit'),
          reset: t('products.filter.reset'),
          retry: t('common.retry'),
          optionsFailed: t('products.list.optionsFailed'),
          refreshFailed: t('common.refreshFailed'),
          selectPage: t('common.selectPage'),
          selectRow: t('common.selectRow'),
          loading: t('common.loading'),
          empty: t('products.list.empty'),
          size: t('products.list.pageSize'),
          cancel: t('common.cancel'),
        }}
      >
        <ProductFilters />
        <ProductActions total={list.total} selectedCount={list.selection.selectedIds.length} />
        <ListResult>
          <ResultTable columns={columns} rowId={(row) => row.id} selectable onOpen={(row) => onOpen(row.id)} />
        </ListResult>
        <Pagination />
      </ListProvider>
    </div>
  );
}
