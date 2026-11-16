// 파일 책임: 회원 목록 흐름. URL 검색·조회·선택·일괄 상태 변경을 조립하고 화면이 쓸 목록 상태와 동작을 돌려준다.
import { useList } from '@boosterlab/web-kit/list';
import type { UrlSearch } from '@boosterlab/web-kit/search';
import { memberListQuery, useChangeMemberStatus } from '../api/members';
import type { MemberAccountStatus } from '../member';
import { memberListSearch, toMemberListParams } from '../search/member-list-search';

/** search·navigate는 route가 URL에서 읽어 넘긴다. 진입만으로는 조회하지 않고 검색을 눌러야 조회한다. */
export function useMemberList({
  search,
  navigate,
}: {
  readonly search: UrlSearch;
  readonly navigate: (next: UrlSearch, options: { readonly replace: boolean }) => void;
}) {
  const list = useList({
    definition: memberListSearch,
    search,
    navigate,
    progress: 'page',
    query: (full) => memberListQuery(toMemberListParams(full)),
    rowId: (row) => row.id,
  });
  const change = useChangeMemberStatus();
  /** 확인한 선택을 확인한 상태로 바꾼다. 서버가 모두 바꿨을 때만 키트의 선택에서 뺀다(일부만 되면 다시 볼 수 있게 남긴다). */
  async function changeStatus(ids: readonly string[], status: MemberAccountStatus) {
    const count = await change.mutateAsync({ ids, status });
    return { completedIds: count === ids.length ? ids : [], value: count };
  }
  return { list, changeStatus };
}
