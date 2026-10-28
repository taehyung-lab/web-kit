// 파일 책임: 회원 목록 상태와 필터·결과 영역을 연결한다.
// 파일 책임: 회원 목록 화면. 필터를 왼쪽에 두는 배치 예시이며, 상태 조립(useList)은 상품 목록과 같고 배치만 다르다.
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { useList } from '@boosterlab/web-kit/list';
import { ListProvider, ResultTotal, SortSelect, PageSize, ListResult, ResultTable, Pagination } from '@boosterlab/web-kit/list/ui';
import type { UrlSearch } from '@boosterlab/web-kit/search';
import { useTranslation } from 'react-i18next';
import { memberListQuery } from '../api/members';
import { MEMBER_LIST_PERIODS, memberListSearch, toMemberListParams } from '../model/list-search';
import { MEMBER_PAGE_SIZES, MEMBER_SORT_KEYS } from '../model/member';
import { MemberFilters } from './MemberFilters';
import { useMemberColumns } from './member-columns';

/** 회원 목록을 그린다. 진입만으로는 조회하지 않고 검색을 눌러야 조회한다. */
export function MemberListScreen({
  search,
  navigate,
}: {
  readonly search: UrlSearch;
  readonly navigate: (next: UrlSearch, options: { readonly replace: boolean }) => void;
}) {
  const { t } = useTranslation();
  const list = useList({
    definition: memberListSearch,
    search,
    navigate,
    progress: 'page',
    query: (full) => memberListQuery(toMemberListParams(full)),
    rowId: (row) => row.id,
    periods: MEMBER_LIST_PERIODS,
  });
  const columns = useMemberColumns();
  return (
    <div className="flex flex-col gap-5">
      <h1>{t('members.title')}</h1>
      <ListProvider
        model={list}
        renderFailure={(failure, place) => (place === 'refresh' ? '' : t(failureCopyKey(failure)))}
        messages={{
          notSearched: t('members.list.notSearched'),
          empty: t('members.list.empty'),
          loading: t('common.loading'),
          retry: t('common.retry'),
          refreshFailed: t('common.refreshFailed'),
        }}
      >
        <div className="flex items-start gap-6">
          <aside className="w-72 shrink-0">
            <MemberFilters />
          </aside>
          <section className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <ResultTotal />
              <SortSelect options={MEMBER_SORT_KEYS.map((value) => ({ value, label: t(`members.sort.${value}`) }))} />
              <PageSize sizes={MEMBER_PAGE_SIZES} />
            </div>
            <ListResult>
              <ResultTable columns={columns} rowId={(row) => row.id} />
            </ListResult>
            <Pagination />
          </section>
        </div>
      </ListProvider>
    </div>
  );
}
