// 파일 책임: 상품 결과 열의 제목·표시·정렬 연결을 선언한다.
import type { ListColumn } from '@boosterlab/web-kit/list/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { categoryOptionsQuery } from '../api/categories';
import type { ProductSummary } from '../model/product';
import { formatDate, formatPrice } from './format';
import { StatusBadge } from './StatusBadge';
/** 화면 언어와 선택지 이름을 결과 열에 적용한다. */
export function useProductColumns() {
  const { t, i18n } = useTranslation();
  const categories = useQuery(categoryOptionsQuery());
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
    {
      key: 'createdAt',
      header: t('products.fields.createdAt'),
      sort: 'createdAt',
      cell: (row) => formatDate(row.createdAt, i18n.language),
    },
  ];
  return columns;
}
