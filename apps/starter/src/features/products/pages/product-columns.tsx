// 파일 책임: 상품 결과 열의 제목·표시·정렬 연결을 선언한다.
import type { ListColumn } from '@/shared/ui/web-kit/list';
import { useTranslation } from 'react-i18next';
import type { ProductSummary } from '../product';
import { formatDate, formatPrice } from './format';
import { StatusBadge } from './StatusBadge';
/** 화면 언어와 분류 이름(목록 flow가 준 찾기 함수)을 결과 열에 적용한다. */
export function useProductColumns(categoryName: (id: string) => string | undefined) {
  const { t, i18n } = useTranslation();
  const columns: readonly ListColumn<ProductSummary>[] = [
    { key: 'name', header: t('products.fields.name'), sort: 'name', cell: (row) => row.name },
    { key: 'code', header: t('products.fields.code'), cell: (row) => row.code },
    { key: 'status', header: t('products.fields.status'), cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'categoryId',
      header: t('products.fields.category'),
      cell: (row) => categoryName(row.categoryId) ?? t('common.empty'),
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
