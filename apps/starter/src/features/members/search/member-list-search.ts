// 파일 책임: 회원 목록 URL 검색 선언과 확정 검색 → 요청 변환. "검색을 눌러야 조회"(gated)·기간 기준·키워드·다중 선택을 값으로만 정한다.
// 화면을 오가며 유지할 URL 검색 조건은 search에 둔다. 요청 모양(MemberListParams)은 api가 소유한다.
import { defineSearch, type FullSearch } from '@boosterlab/web-kit/search';
import { z } from 'zod';
import type { MemberListParams } from '../api/members';
import { MEMBER_ACCOUNT_STATUSES, MEMBER_KEYWORD_FIELDS, MEMBER_PERIOD_TYPES, MEMBER_SIGNUP_METHODS } from '../member';
import { MEMBER_PAGE_SIZES, MEMBER_SORT_KEYS } from '../rules/member-list-policy';

const isoDate = z.iso.date();
const periodFields = ['startDate', 'endDate'] as const;

/**
 * 회원 목록 예시의 값: 진입 시 조회하지 않고 검색을 눌러야 조회, 페이지 크기 100, 가입일 내림차순, 기간 기준 가입일,
 * 배열 필터의 빈 값은 전체. 기간은 함께 맞아야 하는 묶음이다.
 */
export const memberListSearch = defineSearch({
  fields: {
    page: { schema: z.number().int().min(1), default: 1 },
    pageSize: { schema: z.literal(MEMBER_PAGE_SIZES), default: 100 as (typeof MEMBER_PAGE_SIZES)[number] },
    sortType: { schema: z.enum(MEMBER_SORT_KEYS), default: 'joinedAt' as (typeof MEMBER_SORT_KEYS)[number] },
    sortDirection: { schema: z.enum(['asc', 'desc']), default: 'desc' as 'asc' | 'desc' },
    periodType: { schema: z.enum(MEMBER_PERIOD_TYPES), default: 'joinedAt' as (typeof MEMBER_PERIOD_TYPES)[number] },
    startDate: { schema: isoDate, default: undefined },
    endDate: { schema: isoDate, default: undefined },
    keywords: {
      schema: z.array(z.object({ field: z.enum(MEMBER_KEYWORD_FIELDS), value: z.string().trim().min(1) })),
      default: [] as readonly { field: (typeof MEMBER_KEYWORD_FIELDS)[number]; value: string }[],
    },
    signupMethods: { schema: z.array(z.enum(MEMBER_SIGNUP_METHODS)), default: [] as readonly (typeof MEMBER_SIGNUP_METHODS)[number][] },
    accountStatuses: { schema: z.array(z.enum(MEMBER_ACCOUNT_STATUSES)), default: [] as readonly (typeof MEMBER_ACCOUNT_STATUSES)[number][] },
  },
  periods: [periodFields],
  groups: [{ fields: periodFields, valid: ({ startDate, endDate }) => (startDate === undefined) === (endDate === undefined) && (startDate === undefined || String(startDate) <= String(endDate)) }],
  gated: true,
  view: { size: 'pageSize', sort: 'sortType', order: 'sortDirection' },
  sortFirst: 'desc',
});

export type MemberListSearch = FullSearch<typeof memberListSearch.fields>;

/** 확정 검색 → 서버 요청. 빈 배열은 조건 없음이라 보내지 않는다. 키워드는 `대상:값` 반복 키다. */
export function toMemberListParams(search: MemberListSearch): MemberListParams {
  return {
    page: search.page - 1,
    size: search.pageSize,
    sort: `${search.sortType},${search.sortDirection}`,
    periodType: search.periodType,
    from: search.startDate,
    to: search.endDate,
    keyword: search.keywords.length === 0 ? undefined : search.keywords.map((item) => `${item.field}:${item.value}`),
    signupMethod: search.signupMethods.length === 0 ? undefined : [...search.signupMethods],
    accountStatus: search.accountStatuses.length === 0 ? undefined : [...search.accountStatuses],
  };
}
