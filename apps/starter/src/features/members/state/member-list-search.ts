// 파일 책임: 회원 목록 URL 검색 선언과 확정 검색 → 요청 변환. "검색을 눌러야 조회"(gated)·기간 기준·키워드·다중 선택을 값으로만 정한다.
import { defineSearch, type FullSearch } from '@boosterlab/web-kit/search';
import { z } from 'zod';
import {
  MEMBER_ACCOUNT_STATUSES,
  MEMBER_KEYWORD_FIELDS,
  MEMBER_PAGE_SIZES,
  MEMBER_PERIOD_TYPES,
  MEMBER_SIGNUP_METHODS,
  MEMBER_SORT_KEYS,
} from './member';

const isoDate = z.iso.date();

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
  groups: [{ fields: ['startDate', 'endDate'], valid: ({ startDate, endDate }) => (startDate === undefined) === (endDate === undefined) && (startDate === undefined || String(startDate) <= String(endDate)) }],
  gated: true,
  view: { size: 'pageSize', sort: 'sortType', order: 'sortDirection' },
  sortFirst: 'desc',
});

/** 직접 입력하는 기간 쌍. */
export const MEMBER_LIST_PERIODS = [['startDate', 'endDate']] as const;

export type MemberListSearch = FullSearch<typeof memberListSearch.fields>;

/** 확정 검색 → 서버 요청. 빈 배열은 조건 없음이라 보내지 않는다. 키워드는 `대상:값` 반복 키다. */
export function toMemberListParams(search: MemberListSearch) {
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
export type MemberListParams = ReturnType<typeof toMemberListParams>;
