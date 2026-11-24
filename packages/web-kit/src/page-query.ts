// 파일 책임: 화면 본문 조회 표시. `progress: 'page'`로 선언한 useList·useRecord가 조회 meta에 붙이고, 실행 수명(lifetime.ts)이
// 실패가 난 자리를 구분할 때 읽는다. 키트 안에서만 쓰는 약속이라 패키지 입구로 공개하지 않는다.
export const PAGE_QUERY_META = { lifetimePlace: 'page' } as const;
