// 파일 책임: 상품의 조회·필터 필드·열·일괄 업무와 배치만 선언한다. 공통 목록 동작과 UI는 키트(List.*)가 소유한다.
import { List, type ListColumn } from '@boosterlab/web-kit/list/ui';
import { useList } from '@boosterlab/web-kit/list';
import type { UrlSearch } from '@boosterlab/web-kit/search';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { categoryOptionsQuery } from '../api/categories';
import { productListQuery, useDeactivateProducts } from '../api/products';
import { PAGE_SIZES, PRODUCT_LIST_PERIODS, productListSearch, toListProductsParams } from '../model/list-search';
import { PRODUCT_STATUSES, type ProductSummary } from '../model/product';
import { formatDate, formatPrice } from './format';
import { StatusBadge } from './StatusBadge';
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
  const { t, i18n } = useTranslation();
  const categories = useQuery(categoryOptionsQuery());
  const deactivate = useDeactivateProducts();
  const [done, setDone] = useState<number>();
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
  const columns: readonly ListColumn<ProductSummary>[] = [
    { key: 'name', header: t('products.fields.name'), sort: 'name', cell: (row) => row.name },
    { key: 'code', header: t('products.fields.code'), cell: (row) => row.code },
    { key: 'status', header: t('products.fields.status'), cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'categoryId',
      header: t('products.fields.category'),
      cell: (row) => categories.data?.find((category) => category.id === row.categoryId)?.name ?? t('common.empty'),
    },
    { key: 'price', header: t('products.fields.price'), sort: 'price', cell: (row) => formatPrice(row.price, i18n.language) },
    { key: 'createdAt', header: t('products.fields.createdAt'), sort: 'createdAt', cell: (row) => formatDate(row.createdAt, i18n.language) },
  ];
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1>{t('products.title')}</h1>
        <button className="wk-button" onClick={onCreate}>
          {t('products.create')}
        </button>
      </header>
      <List
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
        <List.Filter>
          <List.Text name="keyword" label={t('products.filter.keyword')} />
          <List.MultiSelect
            name="statuses"
            label={t('products.filter.statuses')}
            options={PRODUCT_STATUSES.map((value) => ({ value, label: t(`products.status.${value}`) }))}
          />
          <List.Select
            name="categoryId"
            label={t('products.filter.category')}
            emptyLabel={t('products.filter.allCategories')}
            options={(categories.data ?? []).map((category) => ({ value: category.id, label: category.name }))}
          />
          <List.Period from="from" to="to" label={t('products.filter.period')} timeZone="Asia/Seoul" now={() => new Date()} />
          <List.FilterActions />
        </List.Filter>
        <div className="flex flex-wrap items-center gap-3">
          <div>{t('products.list.total', { count: list.total })}</div>
          <List.PageSize sizes={PAGE_SIZES} />
          <List.Actions>
            <List.BulkAction
              label={t('products.bulk.deactivate', { count: list.selection.selectedIds.length })}
              title={t('products.bulk.title')}
              confirmLabel={t('products.bulk.confirm')}
              describe={(ids) => t('products.bulk.body', { count: ids.length })}
              run={async (ids) => {
                const count = await deactivate.mutateAsync(ids);
                setDone(count);
                return { completedIds: count === ids.length ? ids : [], value: count };
              }}
            />
          </List.Actions>
        </div>
        {done !== undefined && <p role="status">{t('products.bulk.done', { count: done })}</p>}
        <List.Result>
          <List.Table columns={columns} rowId={(row) => row.id} selectable onOpen={(row) => onOpen(row.id)} />
        </List.Result>
        <List.Pagination />
      </List>
    </div>
  );
}
