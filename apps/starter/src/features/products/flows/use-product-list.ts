// 파일 책임: 상품 목록 흐름. URL 검색·조회·선택·일괄 판매 중지를 조립하고 화면이 쓸 상태와 동작만 돌려준다.
import { useList } from '@boosterlab/web-kit/list';
import type { UrlSearch } from '@boosterlab/web-kit/search';
import { useState } from 'react';
import { productListQuery, useDeactivateProducts } from '../api/products';
import { PRODUCT_LIST_PERIODS, productListSearch, toListProductsParams } from '../state/product-list-search';
import { useCategoryOptions } from './use-category-options';

/** search·navigate는 route가 URL에서 읽어 넘긴다. */
export function useProductList({
  search,
  navigate,
}: {
  readonly search: UrlSearch;
  readonly navigate: (next: UrlSearch, options: { readonly replace: boolean }) => void;
}) {
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
  const categories = useCategoryOptions();
  const deactivate = useDeactivateProducts();
  const [deactivated, setDeactivated] = useState<number>();
  /** 확정된 선택을 판매 중지한다. 서버가 완료한 선택만 키트의 선택 상태에서 제거한다. */
  async function deactivateSelected(ids: readonly string[]) {
    const count = await deactivate.mutateAsync(ids);
    setDeactivated(count);
    return { completedIds: count === ids.length ? ids : [], value: count };
  }
  return { list, categoryName: categories.nameOf, deactivateSelected, deactivated };
}
