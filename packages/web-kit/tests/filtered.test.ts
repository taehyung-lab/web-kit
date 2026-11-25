// 파일 책임: 빈 결과의 filtered(확정 조건에 실제로 거르는 값이 있는가) 판단을 칸 종류별로 검사한다.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { isFiltered } from '../src/list/filtered';
import { connectSearch, defineSearch } from '../src/search/fields';
import { arrayKeywordCodec, choices, dateRange, definePolicy, keywords, listSearch, paging, serverChoices, sort } from '../src/search/list-search';

const policy = definePolicy({
  keys: { page: 'page', pageSize: 'size', sort: 'sort', order: 'order' },
  paging: { sizes: [20, 50], defaultSize: 20 },
  sortFirst: 'desc',
  keywords: { codec: arrayKeywordCodec, pending: 'exclude' },
  choices: { format: 'array' },
  dateRange: { entry: 'allow-open', keys: { type: 'dateType', from: 'from', to: 'to' } },
});
const groupField = { schema: z.array(z.string()), default: [] as readonly string[] };
const definition = connectSearch(
  listSearch({
    policy,
    fields: {
      words: keywords({ targets: ['name'] }),
      states: choices({ values: ['on', 'off'], multiple: true }),
      kind: choices({ values: ['a', 'b'] }),
      groups: serverChoices(groupField, { multiple: true }),
      period: dateRange({ types: ['created', 'updated'], defaultType: 'created' }),
      memo: { schema: z.string(), default: '' },
      paging: paging(),
      sorting: sort({ values: ['name', 'created'], default: 'created' }),
    },
  }),
  { checks: { groups: { options: () => ({ queryKey: ['groups'], queryFn: async () => [] }), allowed: (data: readonly string[]) => data } } },
);
const base = definition.defaults as Record<string, unknown>;
const filtered = (patch: Record<string, unknown>) => isFiltered(definition, { ...base, ...patch });

describe('listSearch 칸 종류로 판단한다', () => {
  it('기본값만 있으면(기간 기준 type 포함) 거르는 조건이 없다', () => {
    expect(base['dateType']).toBe('created');
    expect(filtered({})).toBe(false);
    expect(filtered({ dateType: 'updated' })).toBe(false);
  });
  it('페이지·보기 수·정렬은 거르는 조건이 아니다', () => {
    expect(filtered({ page: 3, size: 50, sort: 'name', order: 'asc' })).toBe(false);
  });
  it('검색어는 비어 있지 않으면 건다', () => {
    expect(filtered({ words: [{ field: 'name', value: 'A' }] })).toBe(true);
  });
  it('다중 선택은 일부만 고르면 걸고, 비었거나 전부 고르면 조건 없음이다', () => {
    expect(filtered({ states: ['on'] })).toBe(true);
    expect(filtered({ states: [] })).toBe(false);
    expect(filtered({ states: ['off', 'on'] })).toBe(false);
  });
  it('단일 선택은 값이 있으면 건다', () => {
    expect(filtered({ kind: 'a' })).toBe(true);
  });
  it('서버 선택지는 비어 있지 않으면 건다(전체 선택지를 모르므로 전부 선택을 따지지 않는다)', () => {
    expect(filtered({ groups: ['g1'] })).toBe(true);
  });
  it('기간은 시작·끝 중 하나라도 있으면 건다. 기본 기간이 걸린 목록도 filtered다', () => {
    expect(filtered({ from: '2026-01-01' })).toBe(true);
    expect(filtered({ to: '2026-01-31' })).toBe(true);
    const withDefaultPeriod = connectSearch(
      listSearch({ policy, fields: { period: dateRange({}), paging: paging() } }),
    );
    const defaults = { ...withDefaultPeriod.defaults, from: '2026-01-01', to: '2026-01-31' };
    expect(isFiltered({ ...withDefaultPeriod, defaults }, defaults)).toBe(true);
  });
  it('listSearch에 직접 넣은 칸은 기본값과 다를 때 건다', () => {
    expect(filtered({ memo: 'x' })).toBe(true);
  });
});

describe('종류 정보가 없는 defineSearch는 보기 값을 뺀 필터 부분이 기본값과 다른지로 판단한다', () => {
  const plain = defineSearch({
    fields: {
      page: { schema: z.number(), default: 1 },
      size: { schema: z.number(), default: 20 },
      q: { schema: z.string(), default: '' },
      status: { schema: z.enum(['open', 'closed']), default: 'open' },
    },
    view: { page: 'page', size: 'size' },
  });
  const values = plain.defaults as Record<string, unknown>;
  it('기본값 그대로면 조건 없음, 페이지를 바꿔도 조건 없음', () => {
    expect(isFiltered(plain, values)).toBe(false);
    expect(isFiltered(plain, { ...values, page: 2 })).toBe(false);
  });
  it('필터 칸이 기본값과 다르면 건다', () => {
    expect(isFiltered(plain, { ...values, q: 'x' })).toBe(true);
    expect(isFiltered(plain, { ...values, status: 'closed' })).toBe(true);
  });
});
