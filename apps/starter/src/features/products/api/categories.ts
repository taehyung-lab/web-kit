// 파일 책임: 상품 분류 선택지 조회. 목록 필터·URL 확인(check)·등록·수정 폼이 같은 queryOptions(같은 캐시)를 쓴다.
import { listCategories } from '@/api/generated/categories/categories';
import { queryOptions } from '@tanstack/react-query';
import type { Category } from '../model/product';

/** 분류 선택지. 자주 바뀌지 않으므로 5분 동안 다시 받지 않는다. */
export function categoryOptionsQuery() {
  return queryOptions({
    queryKey: ['categories'] as const,
    queryFn: async ({ signal }): Promise<readonly Category[]> =>
      (await listCategories({ signal })).map((dto) => ({ id: dto.categoryId, name: dto.name })),
    staleTime: 5 * 60_000,
  });
}
