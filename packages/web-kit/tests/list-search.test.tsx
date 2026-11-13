// @vitest-environment jsdom
// 파일 책임: 칸 종류 선언(listSearch)이 주소 복구·제출 정리·정책(키·표현·미추가 검색어)·route 순서를 한 선언에서 지키는지 검사한다.
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isRedirect } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { connectSearch } from '../src/search/fields';
import {
  arrayKeywordCodec,
  choices,
  dateRange,
  definePolicy,
  keywords,
  listSearch,
  paging,
  sort,
  type KeywordCodec,
} from '../src/search/list-search';
import { useList } from '../src/list/use-list';

/** 시험용 문자열 표현: `field:value|field:value`. */
const pipeCodec: KeywordCodec = {
  parse: (raw) =>
    typeof raw === 'string'
      ? raw.split('|').flatMap((part) => {
          const at = part.indexOf(':');
          return at < 0 ? [] : [{ field: part.slice(0, at), value: part.slice(at + 1) }];
        })
      : undefined,
  format: (items) => items.map((item) => `${item.field}:${item.value}`).join('|'),
};
const policy = definePolicy({
  keys: { page: 'page', pageSize: 'pageSize', sort: 'sort', order: 'order' },
  paging: { sizes: [20, 50, 100], defaultSize: 100 },
  sortFirst: 'desc',
  keywords: { codec: pipeCodec, split: ';', pending: 'include' },
  choices: { format: 'comma', allToken: 'all' },
  dateRange: { entry: 'paired', keys: { type: 'dateType', from: 'startDate', to: 'endDate' } },
});
const declaration = listSearch({
  policy,
  fields: {
    search: keywords({ targets: ['name', 'code'] }),
    statuses: choices({ values: ['active', 'inactive'], multiple: true }),
    kind: choices({ values: ['a', 'b'] }),
    period: dateRange({ types: ['createdAt', 'updatedAt'], defaultType: 'createdAt' }),
    paging: paging({ sizes: [20, 50], defaultSize: 20 }),
    sorting: sort({ values: ['createdAt', 'name'], default: 'createdAt' }),
  },
});
const search = connectSearch(declaration);

afterEach(cleanup);

describe('listSearch 주소 읽기', () => {
  it('종류마다 주소 키를 만든다(기간·페이지·정렬은 정책 키)', () => {
    expect(Object.keys(search.fields).sort()).toEqual(
      ['dateType', 'endDate', 'kind', 'order', 'page', 'pageSize', 'search', 'sort', 'startDate', 'statuses'].sort(),
    );
    expect(search.view).toMatchObject({ page: 'page', size: 'pageSize', sort: 'sort', order: 'order' });
    expect(search.sortFirst).toBe('desc');
    expect(search.defaults).toMatchObject({ pageSize: 20, sort: 'createdAt', order: 'desc', dateType: 'createdAt', search: [], statuses: [] });
  });

  it('검색어는 허용 대상·빈 값이 아닌 항목만 남기고 표현은 정책 codec을 쓴다', () => {
    expect(search.read({ search: 'name: A |other:x|code:|nocolon|code:B' }).search).toEqual([
      { field: 'name', value: 'A' },
      { field: 'code', value: 'B' },
    ]);
    expect(search.canonical({ ...search.defaults, search: [{ field: 'name', value: 'A' }] })).toEqual({ search: 'name:A' });
  });

  it('다중 선택은 맞는 값만 남기고 all·전체 선택은 조건 없음, 단일 선택은 틀리면 기본값', () => {
    expect(search.read({ statuses: 'inactive,unknown' }).statuses).toEqual(['inactive']);
    expect(search.read({ statuses: 'all' }).statuses).toEqual([]);
    expect(search.read({ statuses: 'active,inactive' }).statuses).toEqual([]);
    expect(search.read({ kind: 'c' })).toEqual({});
    expect(search.read({ kind: 'b' })).toEqual({ kind: 'b' });
  });

  it('paired 기간은 한쪽만·역순·형식 오류면 두 날짜만 함께 지우고 기간 기준은 둔다', () => {
    for (const raw of [{ startDate: '2026-10-02' }, { startDate: '2026-10-02', endDate: '2026-10-01' }, { startDate: '2026-02-30', endDate: '2026-10-01' }])
      expect(search.read({ ...raw, dateType: 'updatedAt' })).toEqual({ dateType: 'updatedAt' });
    expect(search.read({ startDate: '2026-10-01', endDate: '2026-10-02' })).toEqual({ startDate: '2026-10-01', endDate: '2026-10-02' });
    expect(search.periods).toEqual([['startDate', 'endDate']]);
  });

  it('allow-open 정책은 주소의 한쪽 날짜를 두되 역순은 지운다', () => {
    const open = connectSearch(
      listSearch({ policy: { ...policy, dateRange: { ...policy.dateRange, entry: 'allow-open' } }, fields: { period: dateRange() } }),
    );
    expect(open.read({ startDate: '2026-10-02' })).toEqual({ startDate: '2026-10-02' });
    expect(open.read({ startDate: '2026-10-02', endDate: '2026-10-01' })).toEqual({});
    expect(Object.keys(open.fields)).toEqual(['startDate', 'endDate']);
  });

  it('보기 수는 선택지 밖이면 기본값, 인자가 없으면 정책 보기 수', () => {
    expect(search.read({ pageSize: 13 })).toEqual({});
    expect(search.read({ pageSize: 50, page: 2 })).toEqual({ pageSize: 50, page: 2 });
    const common = connectSearch(listSearch({ policy, fields: { paging: paging() } }));
    expect(common.defaults.pageSize).toBe(100);
    expect(common.read({ pageSize: 50 })).toEqual({ pageSize: 50 });
  });

  it('주소 키가 겹치거나 기본값이 선택지 밖이면 선언할 때 오류', () => {
    expect(() => listSearch({ policy, fields: { a: dateRange(), b: dateRange() } })).toThrow(/duplicate search key "startDate"/);
    expect(() => paging({ sizes: [20], defaultSize: 30 as 20 })).toThrow();
    expect(() => dateRange({ types: ['a'], defaultType: 'b' as 'a' })).toThrow();
    expect(() => definePolicy({ ...policy, paging: { sizes: [20], defaultSize: 30 } })).toThrow();
  });

  it('기간 둘은 키를 바꿔 각자 정리한다', () => {
    const two = connectSearch(
      listSearch({
        policy,
        fields: { booked: dateRange(), visited: dateRange({ keys: { from: 'visitFrom', to: 'visitTo' } }) },
      }),
    );
    expect(two.read({ startDate: '2026-01-02', endDate: '2026-01-01', visitFrom: '2026-01-01', visitTo: '2026-01-02' })).toEqual({
      visitFrom: '2026-01-01',
      visitTo: '2026-01-02',
    });
    expect(two.meta['visited']).toEqual({ kind: 'dateRange', keys: { type: 'dateType', from: 'visitFrom', to: 'visitTo' }, types: [] });
  });

  it('배열 표현 codec과 기존 SearchField를 함께 쓸 수 있다', () => {
    const plain = connectSearch(
      listSearch({
        policy: { ...policy, keywords: { codec: arrayKeywordCodec, pending: 'exclude' }, choices: { format: 'array' } },
        fields: {
          search: keywords({ targets: ['name'] }),
          tags: choices({ values: ['x', 'y', 'z'], multiple: true }),
          q: { schema: { '~standard': { validate: (raw: unknown) => (typeof raw === 'string' ? { value: raw } : { issues: [1] }) } }, default: '' },
        },
      }),
    );
    expect(plain.read({ search: [{ field: 'name', value: 'A' }], tags: ['x', 'q'], q: 'free' })).toEqual({
      search: [{ field: 'name', value: 'A' }],
      tags: ['x'],
      q: 'free',
    });
    expect(plain.canonical({ ...plain.defaults, tags: ['x', 'y'] })).toEqual({ tags: ['x', 'y'] });
  });
});

describe('route 연결', () => {
  it('guard를 주소 교정보다 먼저 실행해 거부된 진입에서 주소를 바꾸지 않는다', () => {
    const calls: string[] = [];
    const route = search.route({
      guard: () => {
        calls.push('guard');
        throw new Error('denied');
      },
    });
    expect(() => route.beforeLoad({ location: { pathname: '/list', search: { pageSize: 13 } } })).toThrow('denied');
    expect(calls).toEqual(['guard']);
    let redirect: unknown;
    try {
      search.route().beforeLoad({ location: { pathname: '/list', search: { pageSize: 13 } } });
    } catch (error) {
      redirect = error;
    }
    expect(isRedirect(redirect)).toBe(true);
    expect(search.route().validateSearch({ pageSize: 13, statuses: 'inactive' })).toEqual({ statuses: 'inactive' });
  });

  it('없는 칸에 서버 선택지 확인을 붙이면 오류', () => {
    expect(() =>
      connectSearch(declaration, {
        checks: { missing: { options: () => ({ queryKey: ['x'], queryFn: () => [] }), allowed: () => [] } } as never,
      }),
    ).toThrow(/unknown check field "missing"/);
  });
});

describe('useList 제출', () => {
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
  }

  it('정책이 include면 [추가]하지 않은 입력을 구분자로 나눠 검색에 포함한다', () => {
    const navigations: unknown[] = [];
    const { result } = renderHook(
      () =>
        useList({
          definition: search,
          search: {},
          navigate: (next) => navigations.push(next),
          query: (full) => ({ queryKey: ['rows', full], queryFn: async () => ({ rows: [], total: 0 }) }),
          rowId: (row: { id: string }) => row.id,
        }),
      { wrapper },
    );
    act(() => result.current.keywordInput('search', ['name', 'code']).setText(' Alpha;Beta;;Alpha '));
    act(() => result.current.submit());
    expect(navigations.at(-1)).toEqual({ search: 'name:Alpha|name:Beta' });
    expect(result.current.meta?.['search']).toMatchObject({ kind: 'keywords', split: ';', pending: 'include' });
  });

  it('정책이 exclude면 추가한 검색어만 제출한다', () => {
    const navigations: unknown[] = [];
    const exclude = connectSearch(
      listSearch({ policy: { ...policy, keywords: { codec: pipeCodec, pending: 'exclude' } }, fields: { search: keywords({ targets: ['name'] }) } }),
    );
    const { result } = renderHook(
      () =>
        useList({
          definition: exclude,
          search: {},
          navigate: (next) => navigations.push(next),
          query: (full) => ({ queryKey: ['rows-ex', full], queryFn: async () => ({ rows: [], total: 0 }) }),
          rowId: (row: { id: string }) => row.id,
        }),
      { wrapper },
    );
    act(() => result.current.keywordInput('search', ['name']).setText('Alpha'));
    act(() => result.current.submit());
    expect(navigations).toEqual([]);
  });
});
