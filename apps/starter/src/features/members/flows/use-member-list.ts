// 파일 책임: 회원 목록 흐름. URL 검색·조회를 조립하고 화면이 쓸 목록 상태를 돌려준다. 상태 조립은 상품 목록과 같고 값(gated 등)만 다르다.
import { useList } from '@boosterlab/web-kit/list';
import type { UrlSearch } from '@boosterlab/web-kit/search';
import { memberListQuery } from '../api/members';
import { MEMBER_LIST_PERIODS, memberListSearch, toMemberListParams } from '../state/member-list-search';

/** search·navigate는 route가 URL에서 읽어 넘긴다. 진입만으로는 조회하지 않고 검색을 눌러야 조회한다. */
export function useMemberList({
  search,
  navigate,
}: {
  readonly search: UrlSearch;
  readonly navigate: (next: UrlSearch, options: { readonly replace: boolean }) => void;
}) {
  return useList({
    definition: memberListSearch,
    search,
    navigate,
    progress: 'page',
    query: (full) => memberListQuery(toMemberListParams(full)),
    rowId: (row) => row.id,
    periods: MEMBER_LIST_PERIODS,
  });
}
