// @vitest-environment jsdom
// 파일 책임: useList의 검색 확정·조회·이전 결과·조회 보류·선택지 확인·선택·일괄 작업을 관찰 결과로 검사한다.
import { act, cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider, queryOptions, useQuery } from '@tanstack/react-query';
import { StrictMode, useState, type ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RequestFailure } from '../src/failure';
import { defineSearch, type FieldCheck, type SparseSearch } from '../src/search/fields';
import { useList, type ListPage } from '../src/use-list';

interface Row {
  readonly id: string;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function makeDefinition(options: { gated?: boolean; check?: FieldCheck; codeDefault?: string; childCheck?: FieldCheck } = {}) {
  return defineSearch({
    fields: {
      page: { schema: z.number().int().min(1), default: 1 },
      size: { schema: z.number().int(), default: 20 },
      q: { schema: z.string(), default: '' },
      code: { schema: z.string(), default: options.codeDefault ?? '', ...(options.check ? { check: options.check } : {}) },
      child: { schema: z.string(), default: '', ...(options.childCheck ? { check: options.childCheck } : {}) },
    },
    gated: options.gated,
  });
}
type Definition = ReturnType<typeof makeDefinition>;

let latest!: ReturnType<typeof useList<Definition['fields'], Row>>;
let navigations: { next: unknown; replace: boolean }[] = [];
let setUrl!: (next: SparseSearch<Definition['fields']>) => void;

function Harness(props: {
  definition: Definition;
  initial: Record<string, unknown>;
  fetchRows: (search: unknown) => Promise<ListPage<Row>>;
  validateDraft?: (draft: { q: string }) => readonly { field: string; code: string }[];
  ready?: boolean;
}) {
  const [search, setSearch] = useState(() => props.definition.validateSearch(props.initial));
  setUrl = (next) => setSearch(props.definition.validateSearch(next as Record<string, unknown>));
  latest = useList({
    definition: props.definition,
    search,
    navigate: (next, options) => {
      navigations.push({ next, replace: options.replace });
      setSearch(props.definition.validateSearch(next as Record<string, unknown>));
    },
    query: (full) => ({ queryKey: ['rows', full], queryFn: () => props.fetchRows(full), enabled: props.ready ?? true }),
    rowId: (row) => row.id,
    selectable: (row) => row.id !== 'locked',
    validateDraft: props.validateDraft,
  });
  return null;
}

let client!: QueryClient;
function mount(props: Parameters<typeof Harness>[0]) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<Harness {...props} />, { wrapper });
}

/** 렌더 결과가 몇 틱 연속 바뀌지 않을 때까지 기다린다. 고정 틱 수에 기대지 않는다. */
async function flush() {
  await act(async () => {
    let stable = 0;
    for (let tick = 0; tick < 200 && stable < 3; tick += 1) {
      const previous = latest;
      await new Promise((resolve) => setTimeout(resolve, 0));
      stable = latest === previous ? stable + 1 : 0;
    }
  });
}

const page = (...ids: string[]): ListPage<Row> => ({ rows: ids.map((id) => ({ id })), total: ids.length });

afterEach(() => {
  cleanup();
  navigations = [];
});

it('L1 진입 즉시 조회하고 결과를 현재 조건의 행으로 낸다', async () => {
  const fetchRows = vi.fn(async () => page('1', '2'));
  mount({ definition: makeDefinition(), initial: { page: 2 }, fetchRows });
  await flush();
  await flush();
  expect(fetchRows).toHaveBeenCalledWith(expect.objectContaining({ page: 2, size: 20, q: '' }));
  expect(latest.status.kind).toBe('rows');
  expect(latest.isCurrent).toBe(true);
  expect(latest.rows.map((row) => row.id)).toEqual(['1', '2']);
});

it('L2 다른 조건 확정은 1페이지로 URL push, 보기 상태(size)는 유지한다', async () => {
  mount({ definition: makeDefinition(), initial: { page: 3, size: 50 }, fetchRows: async () => page('1') });
  await flush();
  act(() => latest.patchDraft({ q: 'kim' }));
  act(() => latest.submit());
  expect(navigations).toEqual([{ next: { q: 'kim', size: 50 }, replace: false }]);
});

it('L3 같은 조건 확정은 URL을 바꾸지 않고 다시 조회한다', async () => {
  const fetchRows = vi.fn(async () => page('1'));
  mount({ definition: makeDefinition(), initial: {}, fetchRows });
  await flush();
  await act(async () => latest.submit());
  await flush();
  expect(navigations).toEqual([]);
  expect(fetchRows).toHaveBeenCalledTimes(2);
});

it('L4 직접 입력 검증 실패는 확정을 막고 오류를 낸다', async () => {
  mount({
    definition: makeDefinition(),
    initial: {},
    fetchRows: async () => page('1'),
    validateDraft: (draft) => (draft.q === 'bad' ? [{ field: 'q', code: 'invalid' }] : []),
  });
  await flush();
  act(() => latest.patchDraft({ q: 'bad' }));
  act(() => latest.submit());
  expect(navigations).toEqual([]);
  expect(latest.issues).toEqual([{ field: 'q', code: 'invalid' }]);
});

it('L5 새 조건 대기·실패 중 이전 행은 읽기용이고 선택할 수 없다', async () => {
  const second = deferred<ListPage<Row>>();
  const fetchRows = vi.fn().mockResolvedValueOnce(page('1', '2')).mockReturnValueOnce(second.promise);
  mount({ definition: makeDefinition(), initial: {}, fetchRows });
  await flush();
  act(() => latest.selection.toggleRow('1', true));
  expect(latest.selection.selectedIds).toEqual(['1']);
  act(() => latest.goToPage(2));
  expect(latest.status.kind).toBe('pending');
  expect(latest.isCurrent).toBe(false);
  expect(latest.rows.map((row) => row.id)).toEqual(['1', '2']);
  expect(latest.selection.selectedIds).toEqual([]);
  act(() => latest.selection.toggleRow('2', true));
  expect(latest.selection.selectedIds).toEqual([]);
  await act(async () => second.reject(new RequestFailure({ kind: 'server-error', status: 500 })));
  await flush();
  expect(latest.status.kind).toBe('failed');
  expect(latest.isCurrent).toBe(false);
  expect(latest.rows.map((row) => row.id)).toEqual(['1', '2']);
});

it('L6 첫 진입 미조회는 조회 0회인 조회 안 함 상태이고 재개하면 검색한다', async () => {
  const fetchRows = vi.fn(async () => page('1'));
  mount({ definition: makeDefinition({ gated: true }), initial: {}, fetchRows });
  await flush();
  expect(fetchRows).not.toHaveBeenCalled();
  expect(latest.status).toMatchObject({ kind: 'idle', reason: 'not-searched' });
  act(() => (latest.status as { resume: () => void }).resume());
  await flush();
  expect(navigations).toEqual([{ next: { searched: true }, replace: false }]);
  expect(fetchRows).toHaveBeenCalledTimes(1);
});

/** 선택지 조회 하나를 확인으로 선언한다. key는 상위 값마다 다르다. */
function optionsCheck(
  fetch: (parents: Record<string, unknown>) => Promise<readonly string[]>,
  options: { parents?: string[] } = {},
): FieldCheck<readonly string[]> {
  return {
    parents: options.parents,
    options: (parents) => ({ queryKey: ['options', parents], queryFn: () => fetch(parents) }),
    allowed: (data) => data,
  };
}

it('L7 확인 대상 값이 있으면 선택지가 올 때까지 조회하지 않는다', async () => {
  const options = deferred<readonly string[]>();
  const fetchOptions = vi.fn(() => options.promise);
  const fetchRows = vi.fn(async () => page('1'));
  mount({ definition: makeDefinition({ check: optionsCheck(fetchOptions) }), initial: { code: 'A' }, fetchRows });
  await flush();
  expect(fetchOptions).toHaveBeenCalledTimes(1);
  expect(fetchRows).not.toHaveBeenCalled();
  expect(latest.status.kind).toBe('pending');
  await act(async () => options.resolve(['A', 'B']));
  await flush();
  expect(navigations).toEqual([]);
  expect(fetchRows).toHaveBeenCalledTimes(1);
});

it('L8 선택지에 없는 값은 그 필드만 기본값으로 replace 한 번 하고 조회한다', async () => {
  const fetchRows = vi.fn(async () => page('1'));
  mount({ definition: makeDefinition({ check: optionsCheck(async () => ['A']) }), initial: { code: 'gone', q: 'kim' }, fetchRows });
  await flush();
  await flush();
  expect(navigations).toEqual([{ next: { q: 'kim' }, replace: true }]);
  expect(fetchRows).toHaveBeenCalledTimes(1);
  expect(fetchRows).toHaveBeenCalledWith(expect.objectContaining({ q: 'kim', code: '' }));
});

it('L8b 배열 값은 선택지에 있는 항목만 남기고, 남는 항목이 없으면 기본값이 된다', async () => {
  const definition = defineSearch({
    fields: {
      codes: { schema: z.array(z.string()), default: [] as string[], check: optionsCheck(async () => ['A', 'B']) },
      q: { schema: z.string(), default: '' },
    },
  });
  const fetchRows = vi.fn(async () => page('1'));
  mount({ definition: definition as never, initial: { codes: ['A', 'X'], q: 'kim' }, fetchRows });
  await flush();
  await flush();
  expect(navigations).toEqual([{ next: { codes: ['A'], q: 'kim' }, replace: true }]);
  expect(fetchRows).toHaveBeenCalledTimes(1);
  expect(fetchRows).toHaveBeenCalledWith(expect.objectContaining({ codes: ['A'] }));

  cleanup();
  navigations = [];
  mount({ definition: definition as never, initial: { codes: ['X', 'Y'], q: 'kim' }, fetchRows });
  await flush();
  await flush();
  expect(navigations).toEqual([{ next: { q: 'kim' }, replace: true }]);
});

it('L8c 확인은 필터 UI와 같은 Query 캐시를 읽는다(이미 받은 선택지는 다시 요청하지 않는다)', async () => {
  const fetchOptions = vi.fn(async () => ['A'] as const);
  const check = optionsCheck(fetchOptions);
  const fetchRows = vi.fn(async () => page('1'));
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  await client.fetchQuery(check.options({}));
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  render(<Harness definition={makeDefinition({ check })} initial={{ code: 'A' }} fetchRows={fetchRows} />, { wrapper });
  await flush();
  expect(fetchOptions).toHaveBeenCalledTimes(1);
  expect(fetchRows).toHaveBeenCalledTimes(1);
});

it('L8d 필터 UI가 선택지를 다시 받아 성공하면 보류가 풀린다', async () => {
  let fail = true;
  const fetchOptions = vi.fn(async () => {
    if (fail) throw new RequestFailure({ kind: 'network' });
    return ['A'];
  });
  const check = optionsCheck(fetchOptions);
  const fetchRows = vi.fn(async () => page('1'));
  mount({ definition: makeDefinition({ check }), initial: { code: 'A' }, fetchRows });
  await flush();
  expect(latest.status).toMatchObject({ kind: 'idle', reason: 'check-failed' });
  fail = false;
  // 목록의 resume이 아니라 같은 선택지 query를 다른 곳(필터의 다시 시도)이 다시 받는다.
  await act(async () => client.refetchQueries({ queryKey: check.options({}).queryKey }));
  await flush();
  expect(fetchRows).toHaveBeenCalledTimes(1);
  expect(latest.status.kind).toBe('rows');
});

it('L8e StrictMode 재마운트로 선택지 조회가 다시 시작돼도 판정이 끝난다', async () => {
  const fetchOptions = vi.fn(async (_parents: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return ['A'];
  });
  const check = optionsCheck(fetchOptions);
  const fetchRows = vi.fn(async () => page('1'));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** 같은 선택지를 그리는 필터 UI. 신호를 쓰는 조회라 observer가 빠지면 Query가 취소한다. */
  function Filter() {
    useQuery({ ...check.options({}), queryFn: ({ signal }) => (void signal, fetchOptions({})) });
    return null;
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </StrictMode>
  );
  render(
    <>
      <Filter />
      <Harness definition={makeDefinition({ check })} initial={{ code: 'A' }} fetchRows={fetchRows} />
    </>,
    { wrapper },
  );
  await act(async () => {
    await vi.waitFor(() => expect(latest.status.kind).toBe('rows'));
  });
  expect(navigations).toEqual([]);
});

it('L9 선택지 조회 실패는 URL을 유지한 채 조회를 보류하고, 재개하면 다시 확인한다', async () => {
  let fail = true;
  const fetchOptions = vi.fn(async () => {
    if (fail) throw new RequestFailure({ kind: 'network' });
    return ['A'];
  });
  const fetchRows = vi.fn(async () => page('1'));
  mount({ definition: makeDefinition({ check: optionsCheck(fetchOptions) }), initial: { code: 'A' }, fetchRows });
  await flush();
  expect(latest.status).toMatchObject({ kind: 'idle', reason: 'check-failed', fields: ['code'] });
  expect(navigations).toEqual([]);
  expect(fetchRows).not.toHaveBeenCalled();
  fail = false;
  act(() => (latest.status as { resume: () => void }).resume());
  await flush();
  await flush();
  expect(fetchOptions).toHaveBeenCalledTimes(2);
  expect(fetchRows).toHaveBeenCalledTimes(1);
});

it('L10 값만 바뀌면 받은 선택지로 다시 판정하고 선택지를 다시 요청하지 않는다', async () => {
  const fetchOptions = vi.fn(async () => ['A']);
  const fetchRows = vi.fn(async () => page('1'));
  mount({ definition: makeDefinition({ check: optionsCheck(fetchOptions) }), initial: { code: 'A' }, fetchRows });
  await flush();
  expect(navigations).toEqual([]);
  act(() => setUrl({ code: 'B', q: 'kim' }));
  await flush();
  await flush();
  expect(navigations).toEqual([{ next: { q: 'kim' }, replace: true }]);
  expect(fetchOptions).toHaveBeenCalledTimes(1);
});

it('L11 기본값도 선택지에 없으면 자동 복구를 멈추고 조회를 보류한다', async () => {
  const fetchRows = vi.fn(async () => page('1'));
  mount({
    definition: makeDefinition({ check: optionsCheck(async () => ['A']), codeDefault: 'X' }),
    initial: { code: 'Y' },
    fetchRows,
  });
  for (let i = 0; i < 4; i += 1) await flush();
  expect(navigations).toEqual([{ next: {}, replace: true }]);
  expect(latest.status).toMatchObject({ kind: 'idle', reason: 'check-stuck', fields: ['code'] });
  expect(fetchRows).not.toHaveBeenCalled();
});

it('L12 상위 필드 값이 바뀌면 하위 선택지를 새 상위 값으로 다시 읽는다', async () => {
  const fetchOptions = vi.fn(async (_parents: Record<string, unknown>) => ['c']);
  mount({
    definition: makeDefinition({ childCheck: optionsCheck(fetchOptions, { parents: ['code'] }) }),
    initial: { code: 'A', child: 'c' },
    fetchRows: async () => page('1'),
  });
  await flush();
  act(() => setUrl({ code: 'B', child: 'c' }));
  await flush();
  expect(fetchOptions.mock.calls.map((args) => args[0])).toEqual([{ code: 'A' }, { code: 'B' }]);
});

it('L13 검색 변경은 선택을 비우고, 재조회에서 사라진 행은 선택에서 빠지며, 선택 불가 행은 무시한다', async () => {
  const fetchRows = vi
    .fn()
    .mockResolvedValueOnce(page('1', '2', 'locked'))
    .mockResolvedValueOnce(page('2'))
    .mockResolvedValue(page('9'));
  mount({ definition: makeDefinition(), initial: {}, fetchRows });
  await flush();
  act(() => latest.selection.togglePage(true));
  expect(latest.selection.selectedIds).toEqual(['1', '2']);
  await act(async () => latest.submit());
  await flush();
  expect(latest.selection.selectedIds).toEqual(['2']);
  act(() => latest.goToPage(2));
  await flush();
  expect(latest.selection.selectedIds).toEqual([]);
});

it('L14 일괄 작업은 시작 순간의 선택 ID로 실행하고, 같은 선택 수명일 때만 성공 후 선택을 비운다', async () => {
  mount({ definition: makeDefinition(), initial: {}, fetchRows: async () => page('1', '2', '3') });
  await act(async () => {
    await vi.waitFor(() => expect(latest.status.kind).toBe('rows'));
  });
  act(() => {
    latest.selection.toggleRow('1', true);
    latest.selection.toggleRow('2', true);
  });
  const work = deferred<{ completedIds: readonly string[]; value: string }>();
  const action = vi.fn((_ids: readonly string[]) => work.promise);
  let result!: Promise<{ completedIds: readonly string[]; value: string } | undefined>;
  act(() => {
    result = latest.selection.run(action);
  });
  act(() => latest.selection.toggleRow('3', true));
  expect(action).toHaveBeenCalledWith(['1', '2']);
  await act(async () => work.resolve({ completedIds: ['1', '2'], value: 'done' }));
  await expect(result).resolves.toEqual({ completedIds: ['1', '2'], value: 'done' });
  expect(latest.selection.selectedIds).toEqual([]);

  act(() => latest.selection.toggleRow('1', true));
  const second = deferred<{ completedIds: readonly string[] }>();
  act(() => void latest.selection.run(() => second.promise));
  act(() => latest.patchDraft({ q: 'other' }));
  act(() => latest.submit());
  await act(async () => {
    await vi.waitFor(() => expect(latest.status.kind === 'rows' && latest.isCurrent).toBe(true));
  });
  act(() => latest.selection.toggleRow('3', true));
  await act(async () => second.resolve({ completedIds: ['1'] }));
  expect(latest.selection.selectedIds).toEqual(['3']);
});

it('L15 취소된 조회는 실패가 아니라 조회 안 함이고 재개할 수 있다', async () => {
  const fetchRows = vi
    .fn()
    .mockRejectedValueOnce(new RequestFailure({ kind: 'cancelled' }))
    .mockResolvedValue(page('1'));
  mount({ definition: makeDefinition(), initial: {}, fetchRows });
  await flush();
  expect(latest.status).toMatchObject({ kind: 'idle', reason: 'cancelled' });
  await act(async () => (latest.status as { resume: () => void }).resume());
  await flush();
  expect(latest.status.kind).toBe('rows');
});

it('L16 같은 URL이라도 캐시가 비워져 다시 받는 중이면 이전 행·선택을 일괄 대상으로 내지 않는다', async () => {
  const again = deferred<ListPage<Row>>();
  const fetchRows = vi.fn().mockResolvedValueOnce(page('1', '2')).mockReturnValueOnce(again.promise);
  mount({ definition: makeDefinition(), initial: {}, fetchRows });
  await flush();
  act(() => latest.selection.toggleRow('1', true));
  act(() => client.clear());
  act(() => latest.patchDraft({ q: 'typing' }));
  await flush();
  expect(latest.isCurrent).toBe(false);
  expect(latest.rows.map((row) => row.id)).toEqual(['1', '2']);
  expect(latest.selection.selectedIds).toEqual([]);
  act(() => latest.selection.togglePage(true));
  await act(async () => again.resolve(page('1', '2')));
  await flush();
  expect(latest.selection.selectedIds).toEqual(['1']);
});

it('L17 같은 이벤트에서 초안을 바꾸고 바로 확정해도 바뀐 값으로 확정한다', async () => {
  mount({ definition: makeDefinition(), initial: {}, fetchRows: async () => page('1') });
  await flush();
  act(() => {
    latest.patchDraft({ q: 'typed' });
    latest.submit();
  });
  await flush();
  expect(navigations.at(-1)?.next).toMatchObject({ q: 'typed' });
});

it('L18 화면이 준 조회 조건(enabled)을 함께 지킨다. 준비 전에는 조회하지 않고 not-ready다', async () => {
  const fetchRows = vi.fn(async () => page('1'));
  const view = mount({ definition: makeDefinition(), initial: {}, fetchRows, ready: false });
  await flush();
  expect(fetchRows).not.toHaveBeenCalled();
  expect(latest.status).toMatchObject({ kind: 'idle', reason: 'not-ready' });
  view.rerender(<Harness definition={makeDefinition()} initial={{}} fetchRows={fetchRows} ready />);
  await flush();
  expect(fetchRows).toHaveBeenCalledTimes(1);
  expect(latest.status.kind).toBe('rows');
});

it('L19 보기 키 이름은 선언을 따른다(pageSize)', async () => {
  const definition = defineSearch({
    fields: {
      page: { schema: z.number().int().min(1), default: 1 },
      pageSize: { schema: z.number().int(), default: 20 },
      q: { schema: z.string(), default: '' },
    },
    view: { size: 'pageSize' },
  });
  let current!: ReturnType<typeof useList<typeof definition.fields, Row>>;
  function Sized() {
    const [search, setSearch] = useState(() => definition.validateSearch({ page: 3 }));
    current = useList({
      definition,
      search,
      navigate: (next) => {
        navigations.push({ next, replace: false });
        setSearch(definition.validateSearch(next as Record<string, unknown>));
      },
      query: (full) => ({ queryKey: ['sized', full], queryFn: async () => page('1') }),
      rowId: (row) => row.id,
    });
    return null;
  }
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Sized />
    </QueryClientProvider>,
  );
  act(() => current.setSize(50));
  expect(navigations.at(-1)?.next).toEqual({ pageSize: 50 });
});

it('L20 TanStack queryOptions() 결과(튜플 key·DataTag)를 그대로 query로 넘긴다', () => {
  // 타입 검사가 본체다.
  const definition = makeDefinition();
  function Typed() {
    const [search] = useState(() => definition.validateSearch({}));
    useList({
      definition,
      search,
      navigate: () => undefined,
      query: (full) => queryOptions({ queryKey: ['typed', full.q] as const, queryFn: async () => page('1') }),
      rowId: (row) => row.id,
    });
    return null;
  }
  expect(Typed).toBeTypeOf('function');
});

it('L21 초안 모양이 URL과 달라도(기간 preset) 변환으로 다루고, 확정은 to(초안)이다', async () => {
  const definition = defineSearch({
    fields: {
      page: { schema: z.number().int().min(1), default: 1 },
      from: { schema: z.string(), default: '' },
      to: { schema: z.string(), default: '' },
    },
  });
  type Draft = { readonly preset: 'ALL' | 'TODAY' | 'CUSTOM'; readonly from: string; readonly to: string };
  let current!: ReturnType<typeof useList<typeof definition.fields, Row, Error, readonly unknown[], Draft>>;
  function Period() {
    const [search, setSearch] = useState(() => definition.validateSearch({ from: '2026-10-01', to: '2026-10-23' }));
    current = useList({
      definition,
      search,
      navigate: (next) => {
        navigations.push({ next, replace: false });
        setSearch(definition.validateSearch(next as Record<string, unknown>));
      },
      query: (full) => ({ queryKey: ['period', full], queryFn: async () => page('1') }),
      rowId: (row) => row.id,
      // 날짜가 있으면 사용자가 고른 범위(CUSTOM)로 연다. preset은 URL에 없다.
      draft: {
        from: (full): Draft => ({ preset: full.from === '' ? 'ALL' : 'CUSTOM', from: full.from, to: full.to }),
        to: (draft) => (draft.preset === 'TODAY' ? { from: '2026-10-23', to: '2026-10-23' } : { from: draft.from, to: draft.to }),
      },
      validateDraft: (draft) => (draft.preset === 'CUSTOM' && draft.from > draft.to ? [{ field: 'from', code: 'reversed' }] : []),
    });
    return null;
  }
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Period />
    </QueryClientProvider>,
  );
  expect(current.draft).toEqual({ preset: 'CUSTOM', from: '2026-10-01', to: '2026-10-23' });
  act(() => {
    current.patchDraft({ preset: 'TODAY' });
    current.submit();
  });
  expect(navigations.at(-1)?.next).toEqual({ from: '2026-10-23', to: '2026-10-23' });
  expect(current.draft).toEqual({ preset: 'CUSTOM', from: '2026-10-23', to: '2026-10-23' });
  act(() => {
    current.patchDraft({ preset: 'CUSTOM', from: '2026-10-30', to: '2026-10-01' });
    current.submit();
  });
  expect(current.issues).toEqual([{ field: 'from', code: 'reversed' }]);
  expect(navigations).toHaveLength(1);
});

it('L22 페이지·크기 같은 보기 값만 바뀌면 고치던 필터 초안을 유지하고, 확정 때 현재 보기 값을 쓴다', async () => {
  mount({ definition: makeDefinition(), initial: {}, fetchRows: async () => page('1') });
  await flush();
  act(() => latest.patchDraft({ q: 'typing' }));
  act(() => latest.setSize(50));
  await flush();
  expect(latest.draft.q).toBe('typing');
  act(() => latest.submit());
  expect(navigations.at(-1)?.next).toEqual({ q: 'typing', size: 50 });
});

it('L23 현재 결과가 있는 상태의 재조회 실패는 refresh로 다시 읽는다', async () => {
  let fail = false;
  const fetchRows = vi.fn(async () => {
    if (fail) throw new RequestFailure({ kind: 'server-error', status: 500 });
    return page('1');
  });
  mount({ definition: makeDefinition(), initial: {}, fetchRows });
  await flush();
  fail = true;
  await act(async () => {
    await client.refetchQueries();
  });
  await flush();
  expect(latest.failure).toMatchObject({ kind: 'server-error' });
  fail = false;
  act(() => latest.refresh());
  await flush();
  expect(fetchRows).toHaveBeenCalledTimes(3);
  expect(latest.failure).toBeUndefined();
});

it('L24 목록 응답에 다른 필드가 함께 있으면 page로 그대로 노출한다', async () => {
  interface CountedPage extends ListPage<Row> {
    readonly counts: { readonly open: number };
  }
  const definition = makeDefinition();
  let current!: ReturnType<
    typeof useList<typeof definition.fields, Row, Error, readonly unknown[], ReturnType<typeof definition.resolve>, CountedPage>
  >;
  function Counted() {
    const [search] = useState(() => definition.validateSearch({}));
    current = useList({
      definition,
      search,
      navigate: () => undefined,
      query: () =>
        queryOptions({
          queryKey: ['counted'] as const,
          queryFn: async (): Promise<CountedPage> => ({ ...page('1'), counts: { open: 3 } }),
        }),
      rowId: (row) => row.id,
    });
    return null;
  }
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Counted />
    </QueryClientProvider>,
  );
  await act(async () => {
    await vi.waitFor(() => expect(current.page?.counts.open).toBe(3));
  });
  expect(current.rows.map((row) => row.id)).toEqual(['1']);
});

it('L25 일괄 작업 실행 중 다시 run을 부르면 두 번째 작업은 실행하지 않는다', async () => {
  mount({ definition: makeDefinition(), initial: {}, fetchRows: async () => page('1', '2') });
  await act(async () => {
    await vi.waitFor(() => expect(latest.status.kind).toBe('rows'));
  });
  act(() => latest.selection.toggleRow('1', true));
  const work = deferred<{ completedIds: readonly string[]; value: string }>();
  const first = vi.fn(() => work.promise);
  const second = vi.fn(async () => ({ completedIds: [], value: 'second' }));
  let again!: Promise<{ completedIds: readonly string[]; value: string } | undefined>;
  act(() => {
    void latest.selection.run(first);
    again = latest.selection.run(second);
  });
  await expect(again).resolves.toBeUndefined();
  expect(second).not.toHaveBeenCalled();
  await act(async () => work.resolve({ completedIds: ['1'], value: 'done' }));
  expect(first).toHaveBeenCalledTimes(1);
});

it('L26 같은 조건 재조회와 refresh는 진행 중인 요청에 합류한다(취소하고 다시 보내지 않는다)', async () => {
  const slow = deferred<ListPage<Row>>();
  const fetchRows = vi.fn().mockResolvedValueOnce(page('1')).mockReturnValueOnce(slow.promise).mockResolvedValue(page('1'));
  mount({ definition: makeDefinition(), initial: {}, fetchRows });
  await act(async () => {
    await vi.waitFor(() => expect(latest.status.kind).toBe('rows'));
  });
  act(() => latest.refresh());
  act(() => latest.submit());
  act(() => latest.refresh());
  await act(async () => slow.resolve(page('1')));
  await flush();
  expect(fetchRows).toHaveBeenCalledTimes(2);
});

it('L31 부분 성공은 실제 완료 ID만 선택에서 빼고 0건 성공은 유지한다', async () => {
  mount({ definition: makeDefinition(), initial: {}, fetchRows: async () => page('1', '2') });
  await flush();
  act(() => latest.selection.togglePage(true));
  await act(async () => {
    await latest.selection.run(async () => ({ completedIds: [] as string[] }));
  });
  expect(latest.selection.selectedIds).toEqual(['1', '2']);
  await act(async () => {
    await latest.selection.run(async () => ({ completedIds: ['1'] }));
  });
  expect(latest.selection.selectedIds).toEqual(['2']);
});
it('L32 실행 snapshot 밖 성공 ID를 반환하면 선택을 보존하고 오류로 처리한다', async () => {
  mount({ definition: makeDefinition(), initial: {}, fetchRows: async () => page('1', '2') });
  await flush();
  act(() => latest.selection.toggleRow('1', true));
  await act(async () => {
    await expect(latest.selection.run(async () => ({ completedIds: ['2'] }))).rejects.toThrow('subset');
  });
  expect(latest.selection.selectedIds).toEqual(['1']);
});

it('L33 성공 ID 없는 런타임 결과는 전체 성공으로 처리하지 않는다', async () => {
  mount({ definition: makeDefinition(), initial: {}, fetchRows: async () => page('1') });
  await flush();
  act(() => latest.selection.toggleRow('1', true));
  await act(async () => {
    // JavaScript 소비자의 잘못된 결과도 선택 삭제로 이어지지 않아야 한다.
    // @ts-expect-error 완료 ID는 공개 타입에서도 필수다.
    await expect(latest.selection.run(async () => ({ count: 0 }))).rejects.toThrow('subset');
  });
  expect(latest.selection.selectedIds).toEqual(['1']);
});
