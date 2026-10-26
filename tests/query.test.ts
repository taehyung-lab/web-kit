// 파일 책임: QueryClient 연결(재시도 대상·알림 한 번·선언한 무효화·세션 전환 시 비움)을 검사한다.
import { describe, expect, it, vi } from 'vitest';
import { RequestFailure, type FailureKind } from '../src/failure';
import { createQueryClient } from '../src/query';
import { createSession, type SessionStore, type StoredSession } from '../src/session';

function session() {
  let value: StoredSession<{ accessToken: string }> | null = null;
  const store: SessionStore<{ accessToken: string }> = {
    read: () => value,
    write: (next) => {
      value = next;
    },
    subscribe: () => () => undefined,
  };
  const created = createSession({ store, reissue: vi.fn() });
  created.start({ accessToken: 't' });
  return created;
}

function client(notify = vi.fn()) {
  const owner = session();
  const queryClient = createQueryClient({ session: owner, retry: 2, notify, queries: { retryDelay: 0 } });
  return { queryClient, notify, owner };
}

const failure = (kind: FailureKind, extra: { resultUnknown?: boolean } = {}) =>
  new RequestFailure({ kind, ...extra });

describe('조회 재시도', () => {
  it.each<[FailureKind, number]>([
    ['network', 3],
    ['timeout', 3],
    ['server-error', 3],
    ['rate-limited', 1],
    ['contract', 1],
    ['validation', 1],
    ['not-found', 1],
  ])('%s → 시도 %i회', async (kind, attempts) => {
    const { queryClient } = client();
    const fn = vi.fn(async () => {
      throw failure(kind);
    });
    await queryClient.fetchQuery({ queryKey: [kind], queryFn: fn }).catch(() => undefined);
    expect(fn).toHaveBeenCalledTimes(attempts);
  });

  it('쓰기는 network여도 자동 재시도하지 않는다', async () => {
    const { queryClient } = client();
    const fn = vi.fn(async () => {
      throw failure('network', { resultUnknown: true });
    });
    await queryClient.getMutationCache().build(queryClient, { mutationFn: fn }).execute(undefined).catch(() => undefined);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('실패 알림', () => {
  it('최종 실패만 한 번 알리고 취소는 알리지 않는다', async () => {
    const { queryClient, notify } = client();
    await queryClient.fetchQuery({ queryKey: ['a'], queryFn: async () => { throw failure('server-error'); } }).catch(() => undefined);
    await queryClient.fetchQuery({ queryKey: ['b'], queryFn: async () => { throw failure('cancelled'); } }).catch(() => undefined);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]?.[0]).toMatchObject({ kind: 'server-error' });
    expect(notify.mock.calls[0]?.[1]).toMatchObject({ kind: 'query', query: { queryKey: ['a'] } });
  });
});

describe('쓰기 실패 알림', () => {
  it('쓰기의 최종 실패도 출처와 함께 한 번 알리고, 취소와 이전 세션의 쓰기는 알리지 않는다', async () => {
    const { queryClient, notify, owner } = client();
    const run = (fn: () => Promise<unknown>) =>
      queryClient.getMutationCache().build(queryClient, { mutationFn: fn, meta: { name: 'save' } }).execute(undefined).catch(() => undefined);
    await run(async () => { throw failure('forbidden'); });
    await run(async () => { throw failure('cancelled'); });
    let finish!: () => void;
    const pending = run(() => new Promise<void>((_, reject) => { finish = () => reject(failure('server-error')); }));
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    owner.start({ accessToken: 'other' });
    finish();
    await pending;
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]?.[0]).toMatchObject({ kind: 'forbidden' });
    expect(notify.mock.calls[0]?.[1]).toMatchObject({ kind: 'mutation', mutation: { options: { meta: { name: 'save' } } } });
  });
});

describe('선언한 무효화', () => {
  async function write(queryClient: ReturnType<typeof createQueryClient>, fn: () => Promise<unknown>) {
    await queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: fn, meta: { invalidates: [['items']] } })
      .execute(undefined)
      .catch(() => undefined);
  }

  it('성공하면 선언한 key를 무효화한다', async () => {
    const { queryClient } = client();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await write(queryClient, async () => 'ok');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['items'] });
  });

  it('반영 여부 미확정이면 다시 읽고, 확정 실패면 무효화하지 않는다', async () => {
    const { queryClient } = client();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await write(queryClient, async () => { throw failure('validation'); });
    expect(spy).not.toHaveBeenCalled();
    await write(queryClient, async () => { throw failure('timeout', { resultUnknown: true }); });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('쓰기 중 세션이 바뀌면 후속 무효화를 새 세션에 일으키지 않는다', async () => {
    const { queryClient, owner } = client();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    let finish!: () => void;
    const pending = write(queryClient, () => new Promise<void>((resolve) => { finish = resolve; }));
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    owner.start({ accessToken: 'other' });
    finish();
    await pending;
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('세션 전환', () => {
  it('진행 중 조회를 중단하고 서버 데이터 캐시를 비운다', async () => {
    const { queryClient, owner } = client();
    queryClient.setQueryData(['user'], { name: 'A' });
    const signals: AbortSignal[] = [];
    const inFlight = queryClient
      .fetchQuery({ queryKey: ['slow'], queryFn: ({ signal }) => { signals.push(signal); return new Promise(() => undefined); } })
      .catch((error: unknown) => error);
    await vi.waitFor(() => expect(signals).toHaveLength(1));
    owner.end();
    expect(queryClient.getQueryData(['user'])).toBeUndefined();
    expect(signals[0]?.aborted).toBe(true);
    await inFlight;
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
