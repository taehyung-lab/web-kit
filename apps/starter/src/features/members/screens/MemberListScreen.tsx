// 파일 책임: 회원 목록 화면. 필터를 왼쪽에 두는 배치와 값 하나를 골라 바꾸는 일괄 작업 예시다. 목록 상태 조립은 회원 목록 flow가 맡는다.
import { ListProvider, ResultTotal, SortSelect, PageSize, ListResult, ResultTable, Pagination, BulkSelectAction } from '@/shared/ui/web-kit/list';
import type { UrlSearch } from '@boosterlab/web-kit/search';
import { useTranslation } from 'react-i18next';
import { useMemberList } from '../flows/use-member-list';
import { MEMBER_ACCOUNT_STATUSES } from '../model/member';
import { MEMBER_PAGE_SIZES, MEMBER_SORT_KEYS } from '../model/rules/member-list-policy';
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
  const { list, changeStatus } = useMemberList({ search, navigate });
  const columns = useMemberColumns();
  return (
    <div className="flex flex-col gap-5">
      <h1>{t('members.title')}</h1>
      {/* 공용 문구·실패 문구는 앱 ListDefaults가 준다. 여기에는 이 목록만의 문구를 둔다. */}
      <ListProvider model={list} messages={{ notSearched: t('members.list.notSearched'), empty: t('members.list.empty') }}>
        <div className="flex items-start gap-6">
          <aside className="w-72 shrink-0">
            <MemberFilters />
          </aside>
          <section className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <ResultTotal />
              <SortSelect options={MEMBER_SORT_KEYS.map((value) => ({ value, label: t(`members.sort.${value}`) }))} />
              <PageSize sizes={MEMBER_PAGE_SIZES} />
              <BulkSelectAction
                className="ml-auto"
                label={t('members.bulk.change')}
                selectLabel={t('members.bulk.status')}
                placeholder={t('members.bulk.choose')}
                title={t('members.bulk.title')}
                options={MEMBER_ACCOUNT_STATUSES.map((value) => ({ value, label: t(`members.accountStatus.${value}`) }))}
                describe={(ids, status) => t('members.bulk.body', { count: ids.length, status: t(`members.accountStatus.${status}`) })}
                run={changeStatus}
              />
            </div>
            <ListResult>
              {/* 머리글 표면은 일반·가상화(50행 이상) 표가 같다. 가상화 중에는 고정되므로 불투명한 색을 준다. */}
              <ResultTable columns={columns} rowId={(row) => row.id} rowLabel={(row) => row.name} selectable headerClassName="bg-muted" />
            </ListResult>
            <Pagination />
          </section>
        </div>
      </ListProvider>
    </div>
  );
}
