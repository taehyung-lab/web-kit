// @vitest-environment jsdom
// 파일 책임: 실행 수명(lifetime.ts) — 화면에 그려지는 결과는 시작한 방문의 것, 시킨 일의 실패 알림은 시작한 로그인의 것 — 을
// 확인창·다운로드·저장 폼·조회·일괄 작업 연결에서 검사한다. 연결하지 않은 앱의 동작은 각 기능의 기존 검사가 지킨다.
import type { StandardSchemaV1 } from '@tanstack/react-form';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useConfirmationState } from '../src/confirmation';
import { RequestFailure } from '../src/failure';
import { FormRejection, useSaveForm } from '../src/form/save-form';
import { createLifetime, LifetimeProvider, type FailureAnswer, type FailureReport, type Lifetime } from '../src/lifetime';
import { useBulkConfirmation, type ListModel } from '../src/list/list-binding';
import { useListDownload } from '../src/list/list-download';
import { useRecord } from '../src/record';

afterEach(cleanup);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const forbidden = () => new RequestFailure({ kind: 'forbidden' });

/** 앱 역할: 답을 정해 두고 받은 알림을 기록한다. */
function app(answer: (failure: unknown, report: FailureReport) => FailureAnswer = () => 'local', extra: Parameters<typeof createLifetime>[0] = {}) {
  const reports: FailureReport[] = [];
  const lifetime = createLifetime({
    ...extra,
    onFailure: (failure, report) => {
      reports.push(report);
      return answer(failure, report);
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <LifetimeProvider lifetime={lifetime}>{children}</LifetimeProvider>;
  return { lifetime, reports, wrapper };
}

function confirmation(lifetime: ReturnType<typeof app>, run: () => Promise<unknown>) {
  const onSuccess = vi.fn();
  const onError = vi.fn((failure: unknown) => ({ kind: 'show' as const, failure }));
  const hook = renderHook(() => useConfirmationState({ run, onSuccess, onError }), { wrapper: lifetime.wrapper });
  return { hook, onSuccess, onError };
}

it('확인창: 같은 방문의 실패를 앱이 직접 알리면 onError 없이 닫히고, 맡기면 그 자리에 보인다', async () => {
  for (const answer of ['handled', 'local'] as const) {
    const lifetime = app(() => answer);
    const failure = forbidden();
    const { hook, onError } = confirmation(lifetime, () => Promise.reject(failure));
    act(() => hook.result.current.request('target'));
    await act(() => hook.result.current.confirm());
    expect(lifetime.reports).toEqual([{ place: 'action', here: true }]);
    if (answer === 'handled') {
      expect(onError).not.toHaveBeenCalled();
      expect(hook.result.current.state.kind).toBe('closed');
      expect(lifetime.lifetime.isHandled(failure)).toBe(true);
    } else {
      expect(onError).toHaveBeenCalledWith(failure);
      expect(hook.result.current.state).toMatchObject({ kind: 'open', failure });
      expect(lifetime.lifetime.isHandled(failure)).toBe(false);
    }
    hook.unmount();
  }
});

it('확인창: 방문이 바뀌면 열린 확인이 닫히고, 그 뒤 끝난 성공은 완료 처리를 하지 않는다', async () => {
  const lifetime = app();
  const pending = deferred<string>();
  const { hook, onSuccess } = confirmation(lifetime, () => pending.promise);
  act(() => hook.result.current.request('target'));
  let confirming!: Promise<void>;
  act(() => {
    confirming = hook.result.current.confirm();
  });
  act(() => lifetime.lifetime.leave());
  expect(hook.result.current.state.kind).toBe('closed');
  await act(async () => {
    pending.resolve('done');
    await confirming;
  });
  expect(onSuccess).not.toHaveBeenCalled();
  expect(lifetime.reports).toEqual([]);
});

it('확인창: 방문이 바뀐 뒤 끝난 실패는 화면에 보이지 않고 앱에 here:false로 한 번 알린다', async () => {
  const lifetime = app(() => 'local');
  const pending = deferred<string>();
  const { hook, onError } = confirmation(lifetime, () => pending.promise);
  act(() => hook.result.current.request('target'));
  let confirming!: Promise<void>;
  act(() => {
    confirming = hook.result.current.confirm();
  });
  act(() => lifetime.lifetime.leave());
  await act(async () => {
    pending.reject(new RequestFailure({ kind: 'server-error' }));
    await confirming;
  });
  expect(onError).not.toHaveBeenCalled();
  expect(hook.result.current.state.kind).toBe('closed');
  expect(lifetime.reports).toEqual([{ place: 'action', here: false }]);
});

it('로그인이 바뀐 뒤 끝난 실패와 취소는 앱에 알리지 않는다', () => {
  let generation = 0;
  let signedIn = false;
  const changes = new Set<() => void>();
  const session = {
    generation: () => generation,
    current: () => (signedIn ? {} : null),
    subscribe: (listener: () => void) => {
      changes.add(listener);
      return () => changes.delete(listener);
    },
  };
  const change = (next: number, signed: boolean) => {
    generation = next;
    signedIn = signed;
    for (const listener of [...changes]) listener();
  };
  const lifetime = app(() => 'local', { session });
  // 로그인 없이 시작한 실행(로그인 요청)은 시작한 화면에 있는 동안 그 실행이 세션을 열어도 같은 실행이다.
  const signingIn = lifetime.lifetime.begin('action');
  // 화면을 떠난 로그인 시도는 그 뒤 열린 다른 로그인에 결과를 넘기지 않는다.
  const abandoned = lifetime.lifetime.begin('action');
  change(1, true);
  expect(signingIn.here()).toBe(true);
  lifetime.lifetime.leave();
  expect(abandoned.fail(forbidden(), false)).toBe('handled');
  expect(lifetime.reports).toEqual([]);
  const execution = lifetime.lifetime.begin('action');
  const ended = vi.fn();
  execution.onLoginEnd(ended);
  expect(ended).not.toHaveBeenCalled();
  expect(execution.fail(new RequestFailure({ kind: 'cancelled' }), true)).toBe('local');
  change(2, true);
  expect(ended).toHaveBeenCalledTimes(1);
  expect(execution.here()).toBe(false);
  expect(execution.fail(forbidden(), true)).toBe('handled');
  expect(lifetime.reports).toEqual([]);
});

function download(lifetime: ReturnType<typeof app>, run: () => Promise<void>) {
  const list = { search: {}, isCurrent: true, selection: { selectedIds: [] } };
  return renderHook(() => useListDownload(list, { run }), { wrapper: lifetime.wrapper });
}

it('다운로드: 앱이 직접 알린 실패는 state에 남기지 않고, 맡긴 실패는 남기되 방문이 바뀌면 지운다', async () => {
  const handled = app(() => 'handled');
  const first = download(handled, () => Promise.reject(forbidden()));
  await act(async () => {
    await first.result.current.start('all');
  });
  expect(first.result.current.state).toEqual({ kind: 'idle' });
  expect(handled.reports).toEqual([{ place: 'download', here: true }]);

  const local = app(() => 'local');
  const second = download(local, () => Promise.reject(forbidden()));
  await act(async () => {
    await second.result.current.start('all');
  });
  expect(second.result.current.state.kind).toBe('failed');
  act(() => local.lifetime.leave());
  expect(second.result.current.state).toEqual({ kind: 'idle' });
});

it('다운로드: 방문이 바뀌어도 실행은 끝까지 가고, 늦은 실패는 here:false로 알린 뒤 화면에 남기지 않는다', async () => {
  const lifetime = app(() => 'local');
  const pending = deferred<void>();
  const hook = download(lifetime, () => pending.promise);
  let starting!: Promise<boolean>;
  act(() => {
    starting = hook.result.current.start('all');
  });
  act(() => lifetime.lifetime.leave());
  await act(async () => {
    pending.reject(new RequestFailure({ kind: 'server-error' }));
    await starting;
  });
  expect(lifetime.reports).toEqual([{ place: 'download', here: false }]);
  expect(hook.result.current.state).toEqual({ kind: 'idle' });
});

interface Values {
  readonly name: string;
}
const schema: StandardSchemaV1<Values, Values> = {
  '~standard': { version: 1, vendor: 'test', validate: (value) => ({ value: value as Values }) },
};

function saveForm(lifetime: ReturnType<typeof app>, save: Parameters<typeof useSaveForm<Values, Values, unknown>>[0]['save']) {
  const onSaved = vi.fn();
  const hook = renderHook(() => useSaveForm({ schema, source: { id: 1, values: { name: 'A' } }, save, onSaved }), {
    wrapper: lifetime.wrapper,
  });
  return { hook, onSaved };
}

it('저장 폼: 앱이 직접 알린 실패는 폼에 남기지 않고 다시 저장할 수 있다. 화면 절차의 칸 거절은 앱에 알리지 않는다', async () => {
  const lifetime = app(() => 'handled');
  const { hook } = saveForm(lifetime, () => Promise.reject(forbidden()));
  await act(() => hook.result.current.submit());
  expect(hook.result.current.failure).toBeUndefined();
  expect(hook.result.current.stage.kind).toBe('idle');
  expect(lifetime.reports).toEqual([{ place: 'action', here: true }]);

  const rejecting = app(() => 'handled');
  const second = saveForm(rejecting, () => Promise.reject(new FormRejection()));
  await act(() => second.hook.result.current.submit());
  expect(rejecting.reports).toEqual([]);
});

it('저장 폼: 방문이 바뀐 뒤 끝난 저장은 완료 처리를 하지 않고, 저장 함수의 step.isCurrent가 거짓이 된다', async () => {
  const lifetime = app();
  const pending = deferred<void>();
  let stillCurrent: (() => boolean) | undefined;
  const { hook, onSaved } = saveForm(lifetime, async (_values, _submitted, step) => {
    stillCurrent = step.isCurrent;
    await pending.promise;
    return {};
  });
  let submitting!: Promise<void>;
  act(() => {
    submitting = hook.result.current.submit();
  });
  await waitFor(() => expect(stillCurrent?.()).toBe(true));
  act(() => lifetime.lifetime.leave());
  expect(stillCurrent?.()).toBe(false);
  await act(async () => {
    pending.resolve();
    await submitting;
  });
  expect(onSaved).not.toHaveBeenCalled();
});

function queries(answer: (failure: unknown, report: FailureReport) => FailureAnswer = () => 'local') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const lifetime = app(answer, { queryClient });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LifetimeProvider lifetime={lifetime.lifetime}>{children}</LifetimeProvider>
    </QueryClientProvider>
  );
  return { ...lifetime, queryClient, wrapper };
}

it('조회: 본문으로 선언한 단건 조회의 실패는 page, 그 밖의 조회는 detail로 이 방문에서만 알린다', async () => {
  const context = queries();
  renderHook(
    () => {
      useRecord({ queryKey: ['record'], queryFn: () => Promise.reject(forbidden()) }, 1, { progress: 'page' });
      useQuery({ queryKey: ['options'], queryFn: () => Promise.reject(forbidden()) });
    },
    { wrapper: context.wrapper },
  );
  await waitFor(() => expect(context.reports).toHaveLength(2));
  expect(context.reports).toEqual(
    expect.arrayContaining([
      { place: 'page', here: true },
      { place: 'detail', here: true },
    ]),
  );
});

it('조회: 방문이 바뀌면 이전 방문의 진행 중 조회를 취소해 늦은 실패를 알리지 않고, 자리 잡은 뒤 화면이 쓰는 것만 다시 받는다', async () => {
  const context = queries();
  const first = deferred<string>();
  const queryFn = vi.fn<() => Promise<string>>().mockReturnValueOnce(first.promise).mockResolvedValue('fresh');
  const hook = renderHook(() => useQuery({ queryKey: ['list'], queryFn }), { wrapper: context.wrapper });
  await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
  act(() => context.lifetime.leave());
  await act(async () => {
    first.reject(forbidden());
    await Promise.resolve();
  });
  expect(context.reports).toEqual([]);
  act(() => context.lifetime.arrive());
  await waitFor(() => expect(hook.result.current.data).toBe('fresh'));
  expect(queryFn).toHaveBeenCalledTimes(2);
  expect(context.reports).toEqual([]);
});

it('조회: 오류로 끝나 있던 조회는 방문이 바뀌면 오류를 지우고 새 방문에서 다시 받는다', async () => {
  const context = queries();
  const queryFn = vi.fn<() => Promise<string>>().mockRejectedValueOnce(forbidden()).mockResolvedValue('fresh');
  const hook = renderHook(() => useQuery({ queryKey: ['list'], queryFn }), { wrapper: context.wrapper });
  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(context.reports).toEqual([{ place: 'detail', here: true }]);
  act(() => context.lifetime.leave());
  act(() => context.lifetime.arrive());
  await waitFor(() => expect(hook.result.current.data).toBe('fresh'));
  expect(context.reports).toHaveLength(1);
});

function model(run: ListModel['selection']['run']): ListModel {
  return { isCurrent: true, page: {}, selection: { selectedIds: [], isRunning: false, canSelect: () => true, run } } as unknown as ListModel;
}

it('일괄 작업: 열어 둔 거절 안내는 방문이 바뀌면 닫힌다', () => {
  const lifetime = app();
  const hook = renderHook(
    () => useBulkConfirmation({ model: model(vi.fn()), run: vi.fn() }),
    { wrapper: lifetime.wrapper },
  );
  act(() => hook.result.current.open());
  expect(hook.result.current.refusal).toEqual({ reason: 'no-selection' });
  act(() => lifetime.lifetime.leave());
  expect(hook.result.current.refusal).toBeUndefined();
});

it('일괄 작업: onCompleted는 결과가 이 화면에 전달될 때만 부른다', async () => {
  const lifetime = app();
  const onCompleted = vi.fn();
  for (const delivered of [{ completedIds: ['1'] }, undefined]) {
    const list = { ...model(vi.fn().mockResolvedValue(delivered)) };
    const selected = { ...list, selection: { ...list.selection, selectedIds: ['1'] } } as ListModel;
    const hook = renderHook(
      () => useBulkConfirmation({ model: selected, run: vi.fn().mockResolvedValue({ completedIds: ['1'] }), onCompleted }),
      { wrapper: lifetime.wrapper },
    );
    act(() => hook.result.current.open());
    await act(() => hook.result.current.confirm());
    hook.unmount();
  }
  expect(onCompleted).toHaveBeenCalledTimes(1);
  expect(onCompleted).toHaveBeenCalledWith({ completedIds: ['1'] });
});

it('확인창: 완료 처리가 화면을 옮기지 못하고 실패하면(방문은 그대로) 요청을 다시 보내지 않고 완료만 다시 시도한다', async () => {
  const lifetime = app();
  const run = vi.fn().mockResolvedValue('done');
  const onSuccess = vi.fn().mockRejectedValueOnce(new Error('navigation failed')).mockResolvedValue(undefined);
  const onError = vi.fn((failure: unknown) => ({ kind: 'show' as const, failure }));
  const hook = renderHook(() => useConfirmationState({ run, onSuccess, onError }), { wrapper: lifetime.wrapper });
  act(() => hook.result.current.request('target'));
  await act(() => hook.result.current.confirm());
  expect(hook.result.current.state).toMatchObject({ kind: 'open', completed: true, pending: false });
  expect(lifetime.reports).toEqual([]);
  await act(() => hook.result.current.confirm());
  expect(run).toHaveBeenCalledTimes(1);
  expect(onSuccess).toHaveBeenCalledTimes(2);
  expect(hook.result.current.state.kind).toBe('closed');
});

it('확인창: 방문이 끝나면 진행 중이던 확인과 완료 기록을 버린다. 새 방문은 바로 다른 대상을 확인할 수 있고 이전 완료의 늦은 실패는 창을 다시 열지 않는다', async () => {
  const lifetime = app();
  const completing = deferred<void>();
  const onSuccess = vi.fn(() => completing.promise);
  const onError = vi.fn((failure: unknown) => ({ kind: 'show' as const, failure }));
  const hook = renderHook(() => useConfirmationState({ run: async () => 'done', onSuccess, onError }), {
    wrapper: lifetime.wrapper,
  });
  act(() => hook.result.current.request('A'));
  let confirming!: Promise<void>;
  await act(async () => {
    confirming = hook.result.current.confirm();
    await Promise.resolve();
  });
  act(() => lifetime.lifetime.leave());
  act(() => lifetime.lifetime.arrive());
  expect(hook.result.current.state.kind).toBe('closed');
  act(() => hook.result.current.request('B'));
  expect(hook.result.current.state).toMatchObject({ kind: 'open', values: 'B', pending: false });
  await act(async () => {
    completing.reject(new Error('late'));
    await confirming;
  });
  expect(onError).not.toHaveBeenCalled();
  expect(hook.result.current.state).toMatchObject({ kind: 'open', values: 'B', pending: false });
  expect(hook.result.current.state).not.toHaveProperty('completed');
});

it('저장 폼: 완료 처리 도중 방문이 끝나면 step.isCurrent가 거짓이 되고, 저장한 로그인이 바뀌면 완료 확인을 눌러도 완료 처리를 하지 않는다', async () => {
  const lifetime = app();
  let completionCurrent: (() => boolean) | undefined;
  const waiting = deferred<void>();
  const first = renderHook(
    () =>
      useSaveForm({
        schema,
        source: { id: 1, values: { name: 'A' } },
        save: async () => ({}),
        onSaved: async (_result, step) => {
          completionCurrent = step.isCurrent;
          await waiting.promise;
        },
      }),
    { wrapper: lifetime.wrapper },
  );
  let submitting!: Promise<void>;
  act(() => {
    submitting = first.result.current.submit();
  });
  await waitFor(() => expect(completionCurrent?.()).toBe(true));
  act(() => lifetime.lifetime.leave());
  expect(completionCurrent?.()).toBe(false);
  await act(async () => {
    waiting.resolve();
    await submitting;
  });
  expect(first.result.current.stage.kind).toBe('idle');

  let generation = 0;
  const changes = new Set<() => void>();
  const session = {
    generation: () => generation,
    current: () => ({}),
    subscribe: (listener: () => void) => {
      changes.add(listener);
      return () => changes.delete(listener);
    },
  };
  const signedIn = app(() => 'local', { session });
  const onSaved = vi.fn();
  const second = renderHook(
    () => useSaveForm({ schema, source: { id: 1, values: { name: 'A' } }, save: async () => ({}), onSaved, acknowledge: true }),
    { wrapper: signedIn.wrapper },
  );
  await act(() => second.result.current.submit());
  expect(second.result.current.stage.kind).toBe('saved');
  generation = 1;
  await act(() => second.result.current.complete());
  expect(onSaved).not.toHaveBeenCalled();
  expect(second.result.current.stage.kind).toBe('idle');
});

it('다운로드: 로그인이 바뀌면 실행 함수의 신호가 끊기고, 방문이 바뀐 뒤의 취소는 실패로 남지 않는다', async () => {
  let generation = 0;
  const changes = new Set<() => void>();
  const session = {
    generation: () => generation,
    current: () => ({}),
    subscribe: (listener: () => void) => {
      changes.add(listener);
      return () => changes.delete(listener);
    },
  };
  const lifetime = app(() => 'local', { session });
  const pending = deferred<void>();
  let signal: AbortSignal | undefined;
  const list = { search: {}, isCurrent: true, selection: { selectedIds: [] } };
  const hook = renderHook(
    () =>
      useListDownload(list, {
        run: (_target, step) => {
          signal = step.signal;
          return pending.promise;
        },
      }),
    { wrapper: lifetime.wrapper },
  );
  let starting!: Promise<boolean>;
  act(() => {
    starting = hook.result.current.start('all');
  });
  act(() => lifetime.lifetime.leave());
  expect(signal?.aborted).toBe(false);
  generation = 1;
  for (const listener of [...changes]) listener();
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    pending.reject(new RequestFailure({ kind: 'cancelled' }));
    await starting;
  });
  expect(hook.result.current.state).toEqual({ kind: 'idle' });
  expect(lifetime.reports).toEqual([]);
});

it('저장 폼: 저장 중 방문이 바뀌었는데 폼이 남아 있으면 진행 상태가 풀리고 늦은 결과는 반영하지 않는다', async () => {
  const lifetime = app();
  const pending = deferred<void>();
  const { hook, onSaved } = saveForm(lifetime, async () => {
    await pending.promise;
    return {};
  });
  let submitting!: Promise<void>;
  act(() => {
    submitting = hook.result.current.submit();
  });
  await waitFor(() => expect(hook.result.current.stage.kind).toBe('saving'));
  act(() => lifetime.lifetime.leave());
  expect(hook.result.current.stage.kind).toBe('idle');
  await act(async () => {
    pending.resolve();
    await submitting;
  });
  expect(hook.result.current.stage.kind).toBe('idle');
  expect(onSaved).not.toHaveBeenCalled();
});

it('조회: 연달아 두 번 이동해도 취소한 조회를 도착한 화면이 쓰면 다시 받는다', async () => {
  const context = queries();
  const first = deferred<string>();
  const queryFn = vi.fn<() => Promise<string>>().mockReturnValueOnce(first.promise).mockResolvedValue('fresh');
  const hook = renderHook(() => useQuery({ queryKey: ['list'], queryFn }), { wrapper: context.wrapper });
  await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
  act(() => context.lifetime.leave());
  act(() => context.lifetime.leave());
  act(() => context.lifetime.arrive());
  await waitFor(() => expect(hook.result.current.data).toBe('fresh'));
});

it('조회: 이동 중에 시작해 실패한 조회는 알리지 않고, 도착한 화면이 쓰면 다시 받아 그 응답으로 판정한다', async () => {
  const context = queries();
  act(() => context.lifetime.leave());
  const queryFn = vi.fn<() => Promise<string>>().mockRejectedValueOnce(forbidden()).mockResolvedValue('fresh');
  const hook = renderHook(() => useQuery({ queryKey: ['list'], queryFn }), { wrapper: context.wrapper });
  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(context.reports).toEqual([]);
  act(() => context.lifetime.arrive());
  await waitFor(() => expect(hook.result.current.data).toBe('fresh'));
  expect(context.reports).toEqual([]);
});

it('조회: 이동 중에 다시 받아 성공한 조회는 도착 때 또 받지 않는다', async () => {
  const context = queries();
  const first = deferred<string>();
  const queryFn = vi.fn<() => Promise<string>>().mockReturnValueOnce(first.promise).mockResolvedValue('fresh');
  const hook = renderHook(() => useQuery({ queryKey: ['list'], queryFn }), { wrapper: context.wrapper });
  await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
  act(() => context.lifetime.leave());
  await act(async () => {
    await hook.result.current.refetch();
  });
  await waitFor(() => expect(hook.result.current.data).toBe('fresh'));
  act(() => context.lifetime.arrive());
  await act(() => new Promise((done) => setTimeout(done, 20)));
  expect(queryFn).toHaveBeenCalledTimes(2);
});

it('조회: 내용이 있는 채 다시 받기가 실패한 조회는 방문이 바뀌어도 내용을 지우지 않고 오류만 지운다', async () => {
  const context = queries();
  const queryFn = vi.fn<() => Promise<string>>().mockResolvedValueOnce('good').mockRejectedValueOnce(forbidden()).mockResolvedValue('fresh');
  const hook = renderHook(() => useQuery({ queryKey: ['record'], queryFn }), { wrapper: context.wrapper });
  await waitFor(() => expect(hook.result.current.data).toBe('good'));
  await act(async () => {
    await hook.result.current.refetch();
  });
  await waitFor(() => expect(context.queryClient.getQueryState(['record'])?.status).toBe('error'));
  act(() => context.lifetime.leave());
  expect(context.queryClient.getQueryData(['record'])).toBe('good');
  expect(context.queryClient.getQueryState(['record'])?.status).toBe('success');
  act(() => context.lifetime.arrive());
  await waitFor(() => expect(hook.result.current.data).toBe('fresh'));
});

it('수명을 따로 만들면 서로의 방문을 공유하지 않는다', () => {
  const first: Lifetime = createLifetime();
  const second: Lifetime = createLifetime();
  first.leave();
  expect(first.visit()).toBe(1);
  expect(second.visit()).toBe(0);
});
