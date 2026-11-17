// 파일 책임: 상품 목록의 표시 정책 값(예시 제품 값). 검색 선언·화면이 같은 값을 쓴다.
/** 고를 수 있는 페이지당 개수. */
export const PAGE_SIZES = [10, 20, 50] as const;
/** 정렬할 수 있는 열(서버가 받는 정렬 키). */
export const SORT_KEYS = ['createdAt', 'name', 'price'] as const;
