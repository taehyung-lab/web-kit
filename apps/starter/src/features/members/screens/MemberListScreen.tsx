// 파일 책임: 회원 목록 화면. 필터를 왼쪽에 두는 배치 예시이며, 상태 조립(useList)은 상품 목록과 같고 배치만 다르다.
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { useList } from '@boosterlab/web-kit/list';
import { List, type ListColumn } from '@boosterlab/web-kit/list/ui';
import type { UrlSearch } from '@boosterlab/web-kit/search';
import { useTranslation } from 'react-i18next';
import { memberListQuery } from '../api/members';
import { MEMBER_LIST_PERIODS, memberListSearch, toMemberListParams } from '../model/list-search';
import {
  MEMBER_ACCOUNT_STATUSES,
  MEMBER_KEYWORD_FIELDS,
  MEMBER_PAGE_SIZES,
  MEMBER_PERIOD_TYPES,
  MEMBER_SIGNUP_METHODS,
  MEMBER_SORT_KEYS,
  type MemberSummary,
} from '../model/member';

/** 회원 목록을 그린다. 진입만으로는 조회하지 않고 검색을 눌러야 조회한다. */
export function MemberListScreen({
  search,
  navigate,
}: {
  readonly search: UrlSearch;
  readonly navigate: (next: UrlSearch, options: { readonly replace: boolean }) => void;
}) {
  const { t, i18n } = useTranslation();
  const list = useList({
    definition: memberListSearch,
    search,
    navigate,
    query: (full) => memberListQuery(toMemberListParams(full)),
    rowId: (row) => row.id,
    periods: MEMBER_LIST_PERIODS,
  });
  const date = (value: string) => new Intl.DateTimeFormat(i18n.language, { timeZone: 'Asia/Seoul', dateStyle: 'medium' }).format(new Date(value));
  const columns: readonly ListColumn<MemberSummary>[] = [
    { key: 'name', header: t('members.fields.name'), sort: 'name', cell: (row) => row.name },
    { key: 'email', header: t('members.fields.email'), cell: (row) => row.email },
    { key: 'signupMethod', header: t('members.fields.signupMethod'), cell: (row) => t(`members.signupMethod.${row.signupMethod}`) },
    { key: 'accountStatus', header: t('members.fields.accountStatus'), cell: (row) => t(`members.accountStatus.${row.accountStatus}`) },
    { key: 'joinedAt', header: t('members.fields.joinedAt'), sort: 'joinedAt', cell: (row) => date(row.joinedAt) },
    { key: 'lastLoginAt', header: t('members.fields.lastLoginAt'), sort: 'lastLoginAt', cell: (row) => date(row.lastLoginAt) },
  ];
  return (
    <div className="flex flex-col gap-5">
      <h1>{t('members.title')}</h1>
      <List
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
            <List.Filter>
              <List.Period
                from="startDate"
                to="endDate"
                label={t('members.filter.period')}
                timeZone="Asia/Seoul"
                now={() => new Date()}
                type={{ name: 'periodType', options: MEMBER_PERIOD_TYPES.map((value) => ({ value, label: t(`members.periodType.${value}`) })) }}
                presets={[
                  { label: t('members.filter.lastWeek'), value: { unit: 'day', amount: -7 } },
                  { label: t('members.filter.lastMonth'), value: { unit: 'month', amount: -1 } },
                ]}
              />
              <List.Keywords
                name="keywords"
                label={t('members.filter.keyword')}
                choices={MEMBER_KEYWORD_FIELDS.map((value) => ({ value, label: t(`members.keywordField.${value}`) }))}
              />
              <List.MultiSelect
                name="signupMethods"
                label={t('members.fields.signupMethod')}
                allLabel={t('members.filter.all')}
                options={MEMBER_SIGNUP_METHODS.map((value) => ({ value, label: t(`members.signupMethod.${value}`) }))}
              />
              <List.MultiSelect
                name="accountStatuses"
                label={t('members.fields.accountStatus')}
                allLabel={t('members.filter.all')}
                options={MEMBER_ACCOUNT_STATUSES.map((value) => ({ value, label: t(`members.accountStatus.${value}`) }))}
              />
              <List.FilterActions />
            </List.Filter>
          </aside>
          <section className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <List.Total />
              <List.SortSelect options={MEMBER_SORT_KEYS.map((value) => ({ value, label: t(`members.sort.${value}`) }))} />
              <List.PageSize sizes={MEMBER_PAGE_SIZES} />
            </div>
            <List.Result>
              <List.Table columns={columns} rowId={(row) => row.id} />
            </List.Result>
            <List.Pagination />
          </section>
        </div>
      </List>
    </div>
  );
}
