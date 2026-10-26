// 파일 책임: URL 검색 선언의 필드별 복구·묶음 복구·기본값·정규 URL·진입 표시를 검사한다.
import { isRedirect } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineSearch } from '../src/search/fields';

const search = defineSearch({
  fields: {
    page: { schema: z.number().int().min(1), default: 1 },
    size: { schema: z.union([z.literal(20), z.literal(50)]), default: 20 },
    status: { schema: z.array(z.enum(['A', 'B', 'C'])), default: ['A'] },
    tags: { schema: z.array(z.string()), default: [] as string[] },
    from: { schema: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), default: undefined as string | undefined },
    to: { schema: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), default: undefined as string | undefined },
  },
  groups: [{ fields: ['from', 'to'], valid: ({ from, to }) => from === undefined || to === undefined || String(from) <= String(to) }],
});

describe('필드별 복구', () => {
  it('틀린 필드만 버리고 다른 필드는 유지한다(.catch 없이)', () => {
    expect(search.read({ page: 'x', size: 50 })).toEqual({ size: 50 });
    expect(search.resolve(search.read({ page: 'x', size: 50 }))).toMatchObject({ page: 1, size: 50 });
  });
  it('선언하지 않은 키는 버린다', () => {
    expect(search.read({ page: 2, extra: 1 })).toEqual({ page: 2 });
  });
  it('묶음 안 한 필드가 틀리면 묶음 전체를 기본값으로 돌린다', () => {
    expect(search.read({ from: '2026-01-01', to: 'bad', page: 3 })).toEqual({ page: 3 });
    expect(search.read({ from: '2026-01-01', to: '2026-01-31' })).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });
  it('기본값은 제품 선언 그대로 채운다(빈 배열이 아닌 기본값 포함)', () => {
    expect(search.resolve({})).toEqual({ page: 1, size: 20, status: ['A'], tags: [], from: undefined, to: undefined, searched: true });
  });
});

describe('정규 URL', () => {
  it('기본값과 같은 값·undefined를 생략한다', () => {
    expect(search.canonical(search.resolve({ page: 1, status: ['A'], tags: [] }))).toEqual({});
  });
  it('기본값과 다르면 빈 배열도 남긴다', () => {
    expect(search.canonical({ ...search.resolve({}), status: [] })).toEqual({ status: [] });
  });
  it('진입 주소가 정규형이 아니면 beforeLoad가 정규형으로 replace하고, 정규형이면 통과한다(반복 없음)', () => {
    let thrown: unknown;
    try {
      search.beforeLoad({ location: { pathname: '/list', search: { page: 'x', size: 50, status: ['A'], from: '2026-10-02', to: '2026-10-01' } } });
    } catch (error) {
      thrown = error;
    }
    expect(isRedirect(thrown)).toBe(true);
    const options = (thrown as { options: { to: string; search: unknown; replace: boolean } }).options;
    expect(options).toMatchObject({ to: '/list', search: { size: 50 }, replace: true });
    expect(() => search.beforeLoad({ location: { pathname: '/list', search: options.search } })).not.toThrow();
  });
  it('route validateSearch는 정규 URL 표현을 내고, 다시 넣어도 같다(Router가 그대로 URL로 쓴다)', () => {
    const url = search.validateSearch({ page: 'x', size: 50, status: ['A'] });
    expect(url).toEqual({ size: 50 });
    expect(search.validateSearch(url)).toEqual(url);
  });
});

describe('첫 진입 미조회', () => {
  const gated = defineSearch({
    fields: { page: { schema: z.number().int().min(1), default: 1 }, q: { schema: z.string(), default: '' } },
    gated: true,
  });
  it('빈 URL은 검색 전이고, 검색한 상태는 표시 하나를 URL에 남긴다', () => {
    expect(gated.resolve(gated.read({})).searched).toBe(false);
    expect(gated.canonical({ ...gated.resolve({}), searched: true })).toEqual({ searched: true });
    expect(gated.canonical({ ...gated.resolve({}), q: 'x', searched: true })).toEqual({ q: 'x', searched: true });
    expect(gated.canonical({ ...gated.resolve({}), q: 'x', searched: false })).toEqual({});
    expect(gated.resolve(gated.read({ searched: true })).searched).toBe(true);
  });
  it('유효한 조건이 하나라도 있으면 검색한 것으로 읽고 표시를 붙인다', () => {
    expect(gated.canonical(gated.resolve(gated.read({ q: 'x' })))).toEqual({ q: 'x', searched: true });
    expect(gated.resolve(gated.read({ q: 1 })).searched).toBe(false);
  });
});

describe('URL 표현과 묶음 유효성', () => {
  const coded = defineSearch({
    fields: {
      types: {
        // URL에는 "a,b"로 쓰고, schema가 그 문자열을 읽는다.
        schema: z.string().transform((value) => value.split(',').filter(Boolean)).pipe(z.array(z.enum(['internal', 'agency']))),
        default: [] as ('internal' | 'agency')[],
        encode: (value: readonly string[]) => value.join(','),
      },
      page: { schema: z.number().int().min(1), default: 1 },
    },
  });

  it('필드의 encode로 URL 값을 쓰고 schema로 다시 읽는다', () => {
    const url = coded.canonical(coded.resolve({ types: ['internal', 'agency'] }));
    expect(url).toEqual({ types: 'internal,agency' });
    expect(coded.read(url)).toEqual({ types: ['internal', 'agency'] });
  });

  it('encode한 URL 값은 route validateSearch를 다시 거쳐도 그대로다(JSON 배열로 바뀌지 않는다)', () => {
    expect(coded.validateSearch({ types: 'internal,agency' })).toEqual({ types: 'internal,agency' });
    expect(coded.validateSearch({ types: 'internal,nope' })).toEqual({});
  });

  it('묶음 유효성이 거짓이면(역순 기간) 묶음 전체를 기본값으로 돌린다', () => {
    expect(search.read({ from: '2026-10-02', to: '2026-10-01', page: 2 })).toEqual({ page: 2 });
    expect(search.read({ from: '2026-10-01', to: '2026-10-02' })).toEqual({ from: '2026-10-01', to: '2026-10-02' });
  });
});
