// 파일 책임: 상품의 조회·필터 필드·열·일괄 업무만 선언한다. 공통 목록 UI는 키트가 소유한다.
import { ListView } from '@boosterlab/web-kit/list/ui';
import { useList } from '@boosterlab/web-kit/list';
import type { UrlSearch } from '@boosterlab/web-kit/search';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { categoryOptionsQuery } from '../api/categories';
import { productListQuery, useDeactivateProducts } from '../api/products';
import { PAGE_SIZES, productListSearch, toListProductsParams, validateProductListDraft } from '../model/list-search';
import { PRODUCT_STATUSES } from '../model/product';
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
    query: (full) => productListQuery(toListProductsParams(full)),
    rowId: (row) => row.id,
    selectable: (row) => row.status !== 'INACTIVE',
    validateDraft: validateProductListDraft,
  });
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1>{t('products.title')}</h1>
        <button className="wk-button" onClick={onCreate}>
          {t('products.create')}
        </button>
      </header>
      <ListView
        model={list}
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
        }}
      >
        {(ui) => (
          <>
            <ui.Filter>
              <ui.Text name="keyword" label={t('products.filter.keyword')} />
              <ui.MultiSelect
                name="statuses"
                label={t('products.filter.statuses')}
                options={PRODUCT_STATUSES.map((value) => ({ value, label: t(`products.status.${value}`) }))}
              />
              <ui.Select
                name="categoryId"
                label={t('products.filter.category')}
                options={(categories.data ?? []).map((category) => ({ value: category.id, label: category.name }))}
              />
              <ui.Period from="from" to="to" label={t('products.filter.period')} timeZone="Asia/Seoul" now={() => new Date()} />
            </ui.Filter>
            <div>{t('products.list.total', { count: list.total })}</div>
            <ui.BulkAction
              label={t('products.bulk.deactivate', { count: list.selection.selectedIds.length })}
              title={t('products.bulk.title')}
              confirmLabel={t('products.bulk.confirm')}
              cancelLabel={t('common.cancel')}
              renderFailure={(failure) => t(failureCopyKey(failure))}
              run={async (ids) => {
                const count = await deactivate.mutateAsync(ids);
                setDone(count);
                return { completedIds: count === ids.length ? ids : [], value: count };
              }}
            />
            {done !== undefined && <p role="status">{t('products.bulk.done', { count: done })}</p>}
            <ui.Table
              rowId={(row) => row.id}
              selectable
              onOpen={(row) => onOpen(row.id)}
              columns={[
                { key: 'name', label: t('products.fields.name'), sortable: true, render: (row) => row.name },
                { key: 'code', label: t('products.fields.code'), render: (row) => row.code },
                { key: 'status', label: t('products.fields.status'), render: (row) => <StatusBadge status={row.status} /> },
                {
                  key: 'categoryId',
                  label: t('products.fields.category'),
                  render: (row) => categories.data?.find((category) => category.id === row.categoryId)?.name ?? t('common.empty'),
                },
                { key: 'price', label: t('products.fields.price'), sortable: true, render: (row) => formatPrice(row.price, i18n.language) },
                {
                  key: 'createdAt',
                  label: t('products.fields.createdAt'),
                  sortable: true,
                  render: (row) => formatDate(row.createdAt, i18n.language),
                },
              ]}
            />
            <ui.Pagination sizes={PAGE_SIZES} />
          </>
        )}
      </ListView>
    </div>
  );
}
