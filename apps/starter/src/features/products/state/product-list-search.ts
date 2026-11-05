// 파일 책임: 상품 목록 URL 검색 선언(web-kit defineSearch)과, 확정 검색 → 목록 요청 변환.
import type { ListProductsParams } from '@/api/generated/models';
import { validateDateRange } from '@boosterlab/web-kit';
import { defineSearch, type FullSearch } from '@boosterlab/web-kit/search';
import { z } from 'zod';
import { categoryOptionsQuery } from '../api/categories';
import { PRODUCT_STATUSES, type Category, type ProductStatus } from './product';

export const PAGE_SIZES = [10, 20, 50] as const;
export const SORT_KEYS = ['createdAt', 'name', 'price'] as const;

/** URL의 쉼표 목록 → 상태 배열. 중복을 없애고 서버 enum 순서로 맞춰 정규 URL이 하나가 되게 한다. */
const statusList = z
  .string()
  .transform((value) => value.split(','))
  .pipe(z.array(z.enum(PRODUCT_STATUSES)).min(1))
  .transform((values) => PRODUCT_STATUSES.filter((status) => values.includes(status)));

const isoDate = z.iso.date();

/**
 * 상품 목록 검색. 기본값은 예시 제품 값이다(진입 즉시 조회, 최신 등록순, 20개).
 * statuses는 URL에 쉼표 목록으로 쓰고, 기간(from·to)은 함께 맞아야 하는 묶음이다.
 * 고정 목록(상태·정렬·크기)은 schema가, 서버 선택지(분류)는 check가 없는 값을 기본값으로 돌린다.
 */
export const productListSearch = defineSearch({
  fields: {
    keyword: { schema: z.string().trim().min(1), default: undefined },
    statuses: {
      schema: statusList,
      default: [] as readonly ProductStatus[],
      encode: (values: readonly ProductStatus[]) => values.join(','),
    },
    categoryId: {
      schema: z.string().min(1),
      default: undefined,
      check: { options: () => categoryOptionsQuery(), allowed: (categories: readonly Category[]) => categories.map((category) => category.id), tree: (categories: readonly Category[]) => categories.map((category) => ({value: category.id, label: category.name})) },
    },
    from: { schema: isoDate, default: undefined },
    to: { schema: isoDate, default: undefined },
    page: { schema: z.number().int().min(1), default: 1 },
    pageSize: { schema: z.literal(PAGE_SIZES), default: 20 as (typeof PAGE_SIZES)[number] },
    sort: { schema: z.enum(SORT_KEYS), default: 'createdAt' as (typeof SORT_KEYS)[number] },
    order: { schema: z.enum(['asc', 'desc']), default: 'desc' as 'asc' | 'desc' },
  },
  groups: [{ fields: ['from', 'to'], valid: ({ from, to }) => validateDateRange(from as string | undefined, to as string | undefined) !== 'reversed' }],
  view: { size: 'pageSize' },
  sortFirst: 'desc',
});

export type ProductListSearch = FullSearch<typeof productListSearch.fields>;

/** 상품 목록은 직접 입력한 기간이 반쯤 비었거나 역순이면 그 쌍만 기본값으로 돌리고 나머지 조건으로 검색한다(useList periods). */
export const PRODUCT_LIST_PERIODS = [['from', 'to']] as const;

/** 확정 검색 → 서버 요청. 서버 page는 0부터, 정렬은 Spring "필드,방향" 형식이다. */
export function toListProductsParams(search: ProductListSearch): ListProductsParams {
  return {
    keyword: search.keyword,
    status: search.statuses.length === 0 ? undefined : [...search.statuses],
    categoryId: search.categoryId,
    createdFrom: search.from,
    createdTo: search.to,
    page: search.page - 1,
    size: search.pageSize,
    sort: `${search.sort},${search.order}`,
  };
}
