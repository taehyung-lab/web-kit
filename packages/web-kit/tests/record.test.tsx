// @vitest-environment jsdom
// 파일 책임: useRecord의 네 내용 상태·갱신 사실·식별 전환·forbidden 범위를 실제 Query 실행으로 검사한다.
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, queryOptions, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { RequestFailure } from '../src/failure';
import { useRecord, type RecordState } from '../src/record';

interface Item {
  readonly id: number;
  readonly name: string;
}

type Fetcher = (id: number) => Promise<Item>;

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function describe(state: RecordState<Item>): string {
  if (state.kind === 'ready')
    return `ready:${state.data.name}:${state.refresh.refreshing ? 'refreshing' : 'idle'}:${
      state.refresh.failure instanceof RequestFailure ? state.refresh.failure.kind : 'none'
    }`;
  if (state.kind === 'missing') return `missing:${state.failure.kind}:${state.wasReady ? 'after' : 'entry'}`;
  if (state.kind === 'failed')
    return `failed:${state.failure instanceof RequestFailure ? state.failure.kind : 'other'}`;
  return state.kind;
}

function Detail({ id, fetch }: { readonly id: number; readonly fetch: Fetcher }) {
  const record = useRecord({ queryKey: ['item', id], queryFn: () => fetch(id) }, id);
  return (
    <>
      <output data-testid="record">{describe(record)}</output>
      {record.kind === 'ready' && (
        <button type="button" onClick={record.refresh.retry}>
          refresh
        </button>
      )}
      {record.kind === 'failed' && (
        <button type="button" onClick={record.retry}>
          retry
        </button>
      )}
    </>
  );
}

function wrap(queryClient: QueryClient) {
  return ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function shown() {
  return screen.getByTestId('record').textContent;
}

/** 기대 상태가 될 때까지 기다린다. 틱 수에 기대지 않는다. */
async function expectShown(matcher: 'toBe' | 'toMatch', expected: string | RegExp) {
  await act(async () => {
    await vi.waitFor(() => {
      if (matcher === 'toBe') expect(shown()).toBe(expected);
      else expect(shown()).toMatch(expected);
    });
  });
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

afterEach(cleanup);

it('R1 대기 → 준비됨', async () => {
  const qc = client();
  render(<Detail id={1} fetch={async (id) => ({ id, name: 'A' })} />, { wrapper: wrap(qc) });
  expect(shown()).toBe('pending');
  await expectShown('toBe', 'ready:A:idle:none');
});

it('R2 데이터 없는 실패는 failed이고 다시 시도할 수 있다', async () => {
  const qc = client();
  let fail = true;
  render(
    <Detail
      id={1}
      fetch={async (id) => {
        if (fail) throw new RequestFailure({ kind: 'server-error', status: 500 });
        return { id, name: 'A' };
      }}
    />,
    { wrapper: wrap(qc) },
  );
  await expectShown('toBe', 'failed:server-error');
  fail = false;
  await act(async () => screen.getByText('retry').click());
  await expectShown('toBe', 'ready:A:idle:none');
});

it('R3 일시적 재조회 실패는 내용을 유지하고 갱신 실패 사실만 붙는다', async () => {
  const qc = client();
  let fail = false;
  render(
    <Detail
      id={1}
      fetch={async (id) => {
        if (fail) throw new RequestFailure({ kind: 'network' });
        return { id, name: 'A' };
      }}
    />,
    { wrapper: wrap(qc) },
  );
  await expectShown('toBe', 'ready:A:idle:none');
  fail = true;
  await act(async () => screen.getByText('refresh').click());
  await expectShown('toBe', 'ready:A:idle:network');
});

it('R4 확인된 not-found는 캐시된 내용보다 우선한다', async () => {
  const qc = client();
  qc.setQueryData(['item', 1], { id: 1, name: 'cached' });
  render(
    <Detail
      id={1}
      fetch={async () => {
        throw new RequestFailure({ kind: 'not-found', status: 404 });
      }}
    />,
    { wrapper: wrap(qc) },
  );
  expect(shown()).toBe('ready:cached:refreshing:none');
  await expectShown('toBe', 'missing:not-found:after');
});

it('R5 이 레코드 조회의 forbidden은 내용을 숨긴다', async () => {
  const qc = client();
  qc.setQueryData(['item', 1], { id: 1, name: 'cached' });
  render(
    <Detail
      id={1}
      fetch={async () => {
        throw new RequestFailure({ kind: 'forbidden', status: 403 });
      }}
    />,
    { wrapper: wrap(qc) },
  );
  await expectShown('toBe', 'missing:forbidden:after');
});

function WithSideQuery({ fetch }: { readonly fetch: Fetcher }) {
  const side = useQuery({
    queryKey: ['options'],
    queryFn: async (): Promise<string[]> => {
      throw new RequestFailure({ kind: 'forbidden', status: 403 });
    },
  });
  return (
    <>
      <Detail id={1} fetch={fetch} />
      <span data-testid="side">{side.error instanceof RequestFailure ? side.error.kind : 'none'}</span>
    </>
  );
}

it('R6 다른 요청(보조 선택지)의 forbidden은 상세를 숨기지 않는다', async () => {
  const qc = client();
  render(<WithSideQuery fetch={async (id) => ({ id, name: 'A' })} />, { wrapper: wrap(qc) });
  await act(async () => {
    await vi.waitFor(() => expect(screen.getByTestId('side').textContent).toBe('forbidden'));
  });
  await expectShown('toBe', 'ready:A:idle:none');
});

it('R7 식별이 바뀌면 이전 레코드를 보이지 않고, 이전 식별의 늦은 응답은 적용하지 않는다', async () => {
  const qc = client();
  const first = deferred<Item>();
  const second = deferred<Item>();
  const fetch: Fetcher = (id) => (id === 1 ? first.promise : second.promise);
  qc.setQueryData(['item', 1], { id: 1, name: 'one' });
  const view = render(<Detail id={1} fetch={fetch} />, { wrapper: wrap(qc) });
  expect(shown()).toMatch(/^ready:one/);
  view.rerender(<Detail id={2} fetch={fetch} />);
  expect(shown()).toBe('pending');
  await act(async () => first.resolve({ id: 1, name: 'one-late' }));
  await expectShown('toBe', 'pending');
  await act(async () => second.resolve({ id: 2, name: 'two' }));
  await expectShown('toBe', 'ready:two:idle:none');
});

it('R8 같은 식별의 캐시가 있으면 준비됨으로 시작한다', async () => {
  const qc = client();
  qc.setQueryData(['item', 3], { id: 3, name: 'three' });
  render(<Detail id={3} fetch={() => new Promise<Item>(() => undefined)} />, { wrapper: wrap(qc) });
  expect(shown()).toBe('ready:three:refreshing:none');
});

it('R9 화면이 이전 데이터 유지(placeholderData)를 넘겨도 다른 식별의 내용은 보이지 않는다', async () => {
  const qc = client();
  qc.setQueryData(['item', 1], { id: 1, name: 'one' });
  function Kept({ id }: { readonly id: number }) {
    const record = useRecord({
      queryKey: ['item', id],
      queryFn: () => new Promise<Item>(() => undefined),
      placeholderData: (previous: Item | undefined) => previous,
    }, id);
    return <output data-testid="record">{describe(record)}</output>;
  }
  const view = render(<Kept id={1} />, { wrapper: wrap(qc) });
  view.rerender(<Kept id={2} />);
  expect(shown()).toBe('pending');
});

it('R10 취소된 조회는 실패로 보이지 않는다(조회가 끝난 뒤에도)', async () => {
  const qc = client();
  const fetch = vi.fn(async () => {
    throw new RequestFailure({ kind: 'cancelled' });
  });
  render(<Detail id={1} fetch={fetch} />, { wrapper: wrap(qc) });
  // 조회가 실제로 실패로 끝날 때까지 기다린 뒤에 판정한다.
  await act(async () => {
    await vi.waitFor(() => expect(qc.getQueryState(['item', 1])?.status).toBe('error'));
  });
  expect(fetch).toHaveBeenCalled();
  expect(shown()).toBe('pending');
});

it('R11 TanStack queryOptions()를 cast 없이 그대로 넘긴다', () => {
  // 타입 검사가 이 테스트의 본체다: Error 타입 queryOptions가 useRecord 인자로 맞아야 한다.
  const options = queryOptions({ queryKey: ['item', 1] as const, queryFn: async () => ({ id: 1, name: 'A' }) });
  function Typed() {
    const record = useRecord(options, 1);
    return <output>{record.kind}</output>;
  }
  expect(Typed).toBeTypeOf('function');
});

it('R12 식별이 같고 key의 다른 부분(언어)만 바뀌면 내용을 유지한 채 갱신하고, 수정 폼 입력을 잃지 않는다', async () => {
  const qc = client();
  const next = deferred<Item>();
  function Localized({ locale }: { readonly locale: string }) {
    const record = useRecord(
      { queryKey: ['item', 1, locale], queryFn: () => (locale === 'ko' ? Promise.resolve({ id: 1, name: '하나' }) : next.promise) },
      1,
    );
    return <output data-testid="record">{describe(record)}</output>;
  }
  const view = render(<Localized locale="ko" />, { wrapper: wrap(qc) });
  await expectShown('toBe', 'ready:하나:idle:none');
  view.rerender(<Localized locale="en" />);
  expect(shown()).toBe('ready:하나:refreshing:none');
  await act(async () => next.resolve({ id: 1, name: 'one' }));
  await expectShown('toBe', 'ready:one:idle:none');
});

it('R13 없음은 진입 때인지(이 식별 내용이 아직 준비된 적 없음) 진입 뒤인지 알려 준다', async () => {
  const qc = client();
  let gone = false;
  const fetch: Fetcher = async (id) => {
    if (id === 9 || gone) throw new RequestFailure({ kind: 'not-found', status: 404 });
    return { id, name: 'A' };
  };
  const view = render(<Detail id={9} fetch={fetch} />, { wrapper: wrap(qc) });
  await expectShown('toBe', 'missing:not-found:entry');
  view.rerender(<Detail id={1} fetch={fetch} />);
  await expectShown('toBe', 'ready:A:idle:none');
  gone = true;
  await act(async () => screen.getByText('refresh').click());
  await expectShown('toBe', 'missing:not-found:after');
});

it('R14 식별이 바뀐 뒤 화면이 다시 그려져도 이전 레코드를 보이지 않는다', async () => {
  const qc = client();
  qc.setQueryData(['item', 1], { id: 1, name: 'one' });
  const fetch: Fetcher = (id) => (id === 1 ? Promise.resolve({ id, name: 'one' }) : new Promise<Item>(() => undefined));
  const view = render(<Detail id={1} fetch={fetch} />, { wrapper: wrap(qc) });
  expect(shown()).toMatch(/^ready:one/);
  view.rerender(<Detail id={2} fetch={fetch} />);
  expect(shown()).toBe('pending');
  view.rerender(<Detail id={2} fetch={fetch} />);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  view.rerender(<Detail id={2} fetch={fetch} />);
  expect(shown()).toBe('pending');
});
