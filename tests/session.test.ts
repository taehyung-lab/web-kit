// 파일 책임: 세션 수명(세대·시작/종료·다른 탭 변경·재발급 단일 비행)의 관찰 결과를 검사한다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestFailure } from '../src/failure';
import { createSession, type SessionChange, type SessionStore, type StoredSession } from '../src/session';

interface Credentials {
  readonly accessToken: string;
  readonly loginId: string;
}

/** 다른 탭을 흉내 내는 저장소. `external`로 다른 탭의 쓰기를 알린다. */
function memoryStore(initial: StoredSession<Credentials> | null = null) {
  let value = initial;
  const listeners = new Set<(next: StoredSession<Credentials> | null) => void>();
  const store: SessionStore<Credentials> = {
    read: () => value,
    write: (next) => {
      value = next;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    store,
    get value() {
      return value;
    },
    external(next: StoredSession<Credentials> | null) {
      value = next;
      for (const listener of listeners) listener(next);
    },
  };
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

const origin = new RequestFailure({ kind: 'unauthorized', status: 401, code: '4002' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('시작·종료와 세대', () => {
  it('시작은 세대를 올리고 저장하며, 종료는 한 번만 알린다', () => {
    const memory = memoryStore();
    const session = createSession({ store: memory.store, reissue: vi.fn() });
    const changes: SessionChange[] = [];
    session.subscribe((change) => changes.push(change));
    const before = session.generation();
    session.start({ accessToken: 't1', loginId: 'u' });
    expect(session.generation()).toBe(before + 1);
    expect(session.current()?.credentials.accessToken).toBe('t1');
    expect(memory.value?.credentials.accessToken).toBe('t1');
    session.end(origin);
    session.end(origin);
    expect(memory.value).toBeNull();
    expect(session.current()).toBeNull();
    expect(changes.map((change) => change.kind)).toEqual(['started', 'ended']);
    expect(changes[1]).toEqual({ kind: 'ended', by: 'local', cause: origin });
  });

  it('저장된 세션으로 시작한다', () => {
    const memory = memoryStore({ sessionId: 's', credentials: { accessToken: 't0', loginId: 'u' } });
    const session = createSession({ store: memory.store, reissue: vi.fn() });
    expect(session.current()?.credentials.accessToken).toBe('t0');
  });
});

describe('다른 탭의 변경', () => {
  it('같은 세션의 토큰 회전은 세대를 바꾸지 않는다', () => {
    const memory = memoryStore();
    const session = createSession({ store: memory.store, reissue: vi.fn() });
    session.start({ accessToken: 't1', loginId: 'u' });
    const generation = session.generation();
    const sessionId = memory.value!.sessionId;
    const changes: SessionChange[] = [];
    session.subscribe((change) => changes.push(change));
    memory.external({ sessionId, credentials: { accessToken: 't2', loginId: 'u' } });
    expect(session.generation()).toBe(generation);
    expect(session.current()?.credentials.accessToken).toBe('t2');
    expect(changes).toEqual([]);
  });

  it('다른 세션으로 바뀌거나 지워지면 세대를 올리고 알린다', () => {
    const memory = memoryStore();
    const session = createSession({ store: memory.store, reissue: vi.fn() });
    session.start({ accessToken: 't1', loginId: 'u' });
    const changes: SessionChange[] = [];
    session.subscribe((change) => changes.push(change));
    const generation = session.generation();
    memory.external({ sessionId: 'other', credentials: { accessToken: 'x', loginId: 'v' } });
    expect(session.generation()).toBe(generation + 1);
    expect(session.current()?.credentials.loginId).toBe('v');
    memory.external(null);
    expect(session.generation()).toBe(generation + 2);
    expect(session.current()).toBeNull();
    expect(changes.map((change) => change.kind)).toEqual(['replaced', 'ended']);
    expect(changes[1]).toEqual({ kind: 'ended', by: 'other-tab' });
  });
});

describe('재발급', () => {
  it('같은 세대의 동시 재발급은 한 번만 나가고 같은 세션으로 저장한다', async () => {
    vi.stubGlobal('navigator', {});
    const memory = memoryStore();
    const pending = deferred<Credentials>();
    const reissue = vi.fn(() => pending.promise);
    const session = createSession({ store: memory.store, reissue });
    session.start({ accessToken: 't1', loginId: 'u' });
    const sessionId = memory.value!.sessionId;
    const generation = session.generation();
    const first = session.refresh(generation, 't1', origin);
    const second = session.refresh(generation, 't1', origin);
    pending.resolve({ accessToken: 't2', loginId: 'u' });
    await expect(first).resolves.toBe('t2');
    await expect(second).resolves.toBe('t2');
    expect(reissue).toHaveBeenCalledTimes(1);
    expect(reissue).toHaveBeenCalledWith({ accessToken: 't1', loginId: 'u' });
    expect(memory.value).toEqual({ sessionId, credentials: { accessToken: 't2', loginId: 'u' } });
    expect(session.generation()).toBe(generation);
  });

  it('요청이 쓴 토큰보다 새 토큰이 이미 있으면 재발급하지 않고 그것을 쓴다', async () => {
    const memory = memoryStore();
    const reissue = vi.fn();
    const session = createSession({ store: memory.store, reissue });
    session.start({ accessToken: 't1', loginId: 'u' });
    memory.external({ sessionId: memory.value!.sessionId, credentials: { accessToken: 't2', loginId: 'u' } });
    await expect(session.refresh(session.generation(), 't1', origin)).resolves.toBe('t2');
    expect(reissue).not.toHaveBeenCalled();
  });

  it('재발급이 401로 거절되면 원 요청 실패를 사유로 세션을 한 번 끝내고 대기자는 취소로 끝난다', async () => {
    const memory = memoryStore();
    const session = createSession({
      store: memory.store,
      reissue: async () => {
        throw new RequestFailure({ kind: 'unauthorized', status: 401 });
      },
    });
    session.start({ accessToken: 't1', loginId: 'u' });
    const changes: SessionChange[] = [];
    session.subscribe((change) => changes.push(change));
    const generation = session.generation();
    const results = await Promise.allSettled([
      session.refresh(generation, 't1', origin),
      session.refresh(generation, 't1', origin),
    ]);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      expect((result as PromiseRejectedResult).reason).toMatchObject({ kind: 'cancelled' });
    }
    expect(changes).toEqual([{ kind: 'ended', by: 'server', cause: origin }]);
    expect(memory.value).toBeNull();
  });

  it('일시 실패는 세션을 유지하고 그 실패를 돌려준다', async () => {
    const memory = memoryStore();
    const transient = new RequestFailure({ kind: 'server-error', status: 503 });
    const session = createSession({ store: memory.store, reissue: async () => { throw transient; } });
    session.start({ accessToken: 't1', loginId: 'u' });
    await expect(session.refresh(session.generation(), 't1', origin)).rejects.toBe(transient);
    expect(session.current()?.credentials.accessToken).toBe('t1');
  });

  it('재발급 자체의 403은 원 요청의 forbidden이 아니라 contract다', async () => {
    const memory = memoryStore();
    const session = createSession({
      store: memory.store,
      reissue: async () => {
        throw new RequestFailure({ kind: 'forbidden', status: 403, code: '3005' });
      },
    });
    session.start({ accessToken: 't1', loginId: 'u' });
    await expect(session.refresh(session.generation(), 't1', origin)).rejects.toMatchObject({
      kind: 'contract',
      status: 403,
      code: '3005',
    });
    expect(session.current()).not.toBeNull();
  });

  it('세대가 바뀐 뒤 도착한 재발급 결과는 저장·종료하지 않는다', async () => {
    const memory = memoryStore();
    const pending = deferred<Credentials>();
    const session = createSession({ store: memory.store, reissue: () => pending.promise });
    session.start({ accessToken: 't1', loginId: 'u' });
    const refresh = session.refresh(session.generation(), 't1', origin);
    session.start({ accessToken: 'n1', loginId: 'other' });
    pending.resolve({ accessToken: 't2', loginId: 'u' });
    await expect(refresh).rejects.toMatchObject({ kind: 'cancelled' });
    expect(session.current()?.credentials.accessToken).toBe('n1');
    expect(memory.value?.credentials.accessToken).toBe('n1');
  });

  it('지난 세대의 재발급 요청은 시작하지 않는다', async () => {
    const memory = memoryStore();
    const reissue = vi.fn();
    const session = createSession({ store: memory.store, reissue });
    session.start({ accessToken: 't1', loginId: 'u' });
    const old = session.generation();
    session.start({ accessToken: 'n1', loginId: 'u' });
    await expect(session.refresh(old, 't1', origin)).rejects.toMatchObject({ kind: 'cancelled' });
    expect(reissue).not.toHaveBeenCalled();
  });

  it('Web Locks가 있으면 그 안에서 저장값을 다시 읽어 다른 탭의 재발급 결과를 재사용한다', async () => {
    const memory = memoryStore();
    const reissue = vi.fn();
    const request = vi.fn(async (_name: string, task: () => Promise<unknown>) => {
      // 다른 탭이 lock을 먼저 잡고 회전을 끝냈다.
      memory.external({ sessionId: memory.value!.sessionId, credentials: { accessToken: 'tab2', loginId: 'u' } });
      return task();
    });
    vi.stubGlobal('navigator', { locks: { request } });
    const session = createSession({ store: memory.store, reissue });
    session.start({ accessToken: 't1', loginId: 'u' });
    await expect(session.refresh(session.generation(), 't1', origin)).resolves.toBe('tab2');
    expect(request).toHaveBeenCalledTimes(1);
    expect(reissue).not.toHaveBeenCalled();
  });

  it('원 요청 없이도 재발급할 수 있다', async () => {
    vi.stubGlobal('navigator', {});
    const memory = memoryStore();
    const session = createSession({ store: memory.store, reissue: async () => ({ accessToken: 't2', loginId: 'u' }) });
    session.start({ accessToken: 't1', loginId: 'u' });
    await expect(session.refresh(session.generation(), 't1')).resolves.toBe('t2');
  });

  it('재발급 실패도 결과 코드 표로 판정한다: 종료 행이면 그 실패를 사유로 끝낸다', async () => {
    vi.stubGlobal('navigator', {});
    const memory = memoryStore();
    const terminal = new RequestFailure({ kind: 'business', status: 200, code: '4001', messageKey: 'duplicatedLogin', endsSession: true });
    const session = createSession({ store: memory.store, reissue: async () => { throw terminal; } });
    session.start({ accessToken: 't1', loginId: 'u' });
    const changes: SessionChange[] = [];
    session.subscribe((change) => changes.push(change));
    await expect(session.refresh(session.generation(), 't1', origin)).rejects.toMatchObject({ kind: 'cancelled' });
    expect(changes).toEqual([{ kind: 'ended', by: 'server', cause: terminal }]);
  });

  it('원 요청 없는 재발급의 401은 재발급 실패를 사유로 끝낸다', async () => {
    vi.stubGlobal('navigator', {});
    const memory = memoryStore();
    const rejected = new RequestFailure({ kind: 'unauthorized', status: 401 });
    const session = createSession({ store: memory.store, reissue: async () => { throw rejected; } });
    session.start({ accessToken: 't1', loginId: 'u' });
    const changes: SessionChange[] = [];
    session.subscribe((change) => changes.push(change));
    await expect(session.refresh(session.generation(), 't1')).rejects.toMatchObject({ kind: 'cancelled' });
    expect(changes).toEqual([{ kind: 'ended', by: 'server', cause: rejected }]);
  });
});
