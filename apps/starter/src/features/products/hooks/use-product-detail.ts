// 파일 책임: 상품 상세 흐름. 단건 상태 판정(useRecord)을 이 한 곳에서 한다.
// 분류 이름은 내용이 준비된 뒤에만 필요하므로 화면의 준비된 부분이 use-category-options를 따로 쓴다(없는 상품이면 분류를 조회하지 않는다).
import { useRecord } from '@boosterlab/web-kit/record';
import { productQuery } from '../api/products';

/** 상세 화면이 쓸 단건 상태. */
export function useProductDetail(productId: string) {
  return useRecord(productQuery(productId), productId, { progress: 'page' });
}
