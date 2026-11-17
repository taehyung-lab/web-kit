// 파일 책임: 회원 목록의 표시 정책 값(예시 제품 값). 검색 선언·화면이 같은 값을 쓴다.
/** 정렬할 수 있는 열(서버가 받는 정렬 키). */
export const MEMBER_SORT_KEYS = ['joinedAt', 'name', 'lastLoginAt'] as const;
/** 고를 수 있는 페이지당 개수. */
export const MEMBER_PAGE_SIZES = [20, 50, 100] as const;
