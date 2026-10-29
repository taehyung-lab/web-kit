// @vitest-environment jsdom
// 파일 책임: 유휴 타이머의 관찰 결과(마감·단계·대표 탭·종료 순서)를 검사한다. 위반 사례는 각 it의 기대가 실패로 잡는다.
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestFailure } from '../src/failure';
import { createQueryClient } from '../src/query';
import { createSession, type SessionChange, type SessionStore, type StoredSession } from '../src/session';
import { createIdleTimer, type ServerTimeSample } from '../src/session-idle';

interface Creds {
  readonly accessToken: string;
}

const KEY = 'test-idle';
const policy = { durationMs: 30 * 60_000, warningMs: 60_000, activityThrottleMs: 60_000 };

function memoryStore(initial: StoredSession<Creds> | null = null): SessionStore<Creds> & { value: () => StoredSession<Creds> | null } {
  let value = initial;
  return {
    read: () => value,
    write: (next) => {
      value = next;
    },
    subscribe: () => () => undefined,
    value: () => value,
  };
}

/** 이름별 대기열을 가진 최소 LockManager. 먼저 요청한 쪽이 잡고, 놓으면 다음이 잡는다. */
function fakeLocks(): LockManager {
  const queues = new Map<string, Array<() => void>>();
  const request = (name: string, options: LockOptions, callback: LockGrantedCallback<unknown>) =>
    new Promise((resolve, reject) => {
      const queue = queues.get(name) ?? [];
      queues.set(name, queue);
      const run = () => {
        void Promise.resolve(callback({ name, mode: 'exclusive' } as Lock))
          .then(resolve, reject)
          .finally(() => {
            queue.shift();
            queue[0]?.();
          });
      };
      options.signal?.addEventListener('abort', () => {
        const index = queue.indexOf(run);
        if (index > 0) {
          queue.splice(index, 1);
          reject(new DOMException('aborted', 'AbortError'));
        }
      });
      queue.push(run);
      if (queue.length === 1) run();
    });
  return { request, query: async () => ({}) } as unknown as LockManager;
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

function setup({ locks = null as LockManager | null, signOut = vi.fn(async () => undefined) } = {}) {
  const store = memoryStore();
  const session = createSession<Creds>({ store, reissue: vi.fn(), signOut });
  const requestExtend = vi.fn<() => Promise<ServerTimeSample | null>>();
  const idle = createIdleTimer({ session, key: KEY, policy, extend: requestExtend, environment: { locks } });
  return { store, session, idle, requestExtend, signOut };
}

/** 지금부터 ms 뒤를 서버 마감으로 주는 연장 응답. */
function grantIn(ms: number): ServerTimeSample {
  return { sentAt: Date.now(), deadline: Date.now() + ms };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T00:00:00Z'));
  localStorage.clear();
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('연결', () => {
  it('start 전에는 조작이 연장을 부르지 않고, 로그인해도 상태가 생기지 않는다', () => {
    const { session, idle, requestExtend } = setup();
    session.start({ accessToken: 't' });
    window.dispatchEvent(new MouseEvent('click'));
    expect(requestExtend).not.toHaveBeenCalled();
    expect(idle.state().phase).toBe('inactive');
    expect(idle.remaining()).toBeNull();
  });

  it('저장된 마감이 없거나 지난 세션은 start에서 바로 유휴 종료한다', () => {
    const { session, idle } = setup();
    session.start({ accessToken: 't' });
    localStorage.removeItem(KEY);
    const changes: SessionChange[] = [];
    session.subscribe((change) => changes.push(change));
    idle.start();
    expect(changes).toEqual([{ kind: 'ended', by: 'idle' }]);
    expect(session.current()).toBeNull();
  });

  it('다른 세션 ID의 마감은 따르지 않는다', () => {
    const { session, idle } = setup();
    session.start({ accessToken: 't' });
    localStorage.setItem(KEY, JSON.stringify({ sessionId: 'other', deadline: Date.now() + 600_000, sentAt: 1 }));
    idle.start();
    expect(session.current()).toBeNull();
  });

  it('살아 있는 마감은 이어받는다(새로고침)', () => {
    const first = setup();
    first.idle.start();
    first.session.start({ accessToken: 't' });
    const deadline = first.idle.state().deadline;
    first.idle.stop();
    const stored = first.store.value();
    const store = memoryStore(stored);
    const session = createSession<Creds>({ store, reissue: vi.fn() });
    const idle = createIdleTimer({ session, key: KEY, policy, extend: vi.fn(), environment: { locks: null } });
    vi.advanceTimersByTime(10_000);
    idle.start();
    expect(session.current()).not.toBeNull();
    expect(idle.state().deadline).toBe(deadline);
  });
});

describe('마감은 로그인과 서버 연장만 바꾼다(일반 응답·재발급·경고 안 조작은 늘리지 않는다)', () => {
  it('로그인 뒤 첫 서버 표본만 마감을 확정하고, 그 뒤 일반 응답은 시계만 보정한다', () => {
    const { session, idle } = setup();
    idle.start();
    session.start({ accessToken: 't' });
    expect(idle.state().deadline).toBe(Date.now() + policy.durationMs);
    idle.observe({ sentAt: Date.now() - 1, deadline: Date.now() + 999_999 });
    expect(idle.state().deadline).toBe(Date.now() + policy.durationMs);
    vi.advanceTimersByTime(1_000);
    const confirmed = Date.now() + policy.durationMs - 500;
    idle.observe({ sentAt: Date.now(), deadline: confirmed });
    expect(idle.state().deadline).toBe(confirmed);
    vi.advanceTimersByTime(5_000);
    idle.observe({ sentAt: Date.now(), deadline: Date.now() + policy.durationMs, clockOffsetMs: 0 });
    expect(idle.state().deadline).toBe(confirmed);
  });

  it('경고 구간에서는 클릭·키 입력·경고 닫기가 연장하지 않고, 연장 버튼만 연장한다', async () => {
    const { session, idle, requestExtend } = setup();
    idle.start();
    session.start({ accessToken: 't' });
    vi.advanceTimersByTime(policy.durationMs - 30_000);
    expect(idle.state().phase).toBe('warning');
    const deadline = idle.state().deadline;
    window.dispatchEvent(new MouseEvent('click'));
    window.dispatchEvent(new KeyboardEvent('keydown'));
    idle.dismiss();
    expect(idle.state().dismissed).toBe(true);
    expect(requestExtend).not.toHaveBeenCalled();
    expect(idle.state().deadline).toBe(deadline);

    requestExtend.mockResolvedValueOnce(grantIn(policy.durationMs));
    await expect(idle.extend()).resolves.toEqual({ ok: true });
    expect(idle.state()).toMatchObject({ phase: 'active', dismissed: false });
    expect(idle.state().deadline).toBeGreaterThan(deadline!);
  });

  it('경고 구간 밖의 조작은 간격마다 한 번 연장을 부른다', async () => {
    const { session, idle, requestExtend } = setup();
    requestExtend.mockImplementation(async () => grantIn(policy.durationMs));
    idle.start();
    session.start({ accessToken: 't' });
    vi.advanceTimersByTime(policy.activityThrottleMs);
    window.dispatchEvent(new MouseEvent('click'));
    window.dispatchEvent(new MouseEvent('click'));
    await flush();
    expect(requestExtend).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(policy.activityThrottleMs);
    window.dispatchEvent(new KeyboardEvent('keydown'));
    await flush();
    expect(requestExtend).toHaveBeenCalledTimes(2);
  });

  it('포커스가 없는 탭의 조작은 연장하지 않는다', () => {
    const { session, idle, requestExtend } = setup();
    vi.mocked(document.hasFocus).mockReturnValue(false);
    idle.start();
    session.start({ accessToken: 't' });
    vi.advanceTimersByTime(policy.activityThrottleMs);
    window.dispatchEvent(new MouseEvent('click'));
    expect(requestExtend).not.toHaveBeenCalled();
  });

  it('연장 응답에 마감이 없거나 실패하면 실패를 돌려주고 경고를 유지한다', async () => {
    const { session, idle, requestExtend } = setup();
    idle.start();
    session.start({ accessToken: 't' });
    vi.advanceTimersByTime(policy.durationMs - 30_000);
    requestExtend.mockResolvedValueOnce(null);
    await expect(idle.extend()).resolves.toEqual({ ok: false });
    const failure = new RequestFailure({ kind: 'server-error', status: 500 });
    requestExtend.mockRejectedValueOnce(failure);
    await expect(idle.extend()).resolves.toEqual({ ok: false, failure });
    expect(idle.state().phase).toBe('warning');
  });

  it('다시 보이게 되면 경고 대기 상태가 풀린다', () => {
    const { session, idle } = setup();
    idle.start();
    session.start({ accessToken: 't' });
    vi.advanceTimersByTime(policy.durationMs - 30_000);
    idle.dismiss();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(idle.state().dismissed).toBe(false);
  });

  it('이전 로그인에서 시작한 연장 응답은 새 로그인의 마감을 바꾸지 않는다', async () => {
    const { session, idle, requestExtend } = setup();
    idle.start();
    session.start({ accessToken: 'old' });
    const late = deferred<ServerTimeSample | null>();
    requestExtend.mockReturnValueOnce(late.promise);
    const pending = idle.extend();
    session.end();
    session.start({ accessToken: 'new' });
    const fresh = idle.state().deadline;
    late.resolve(grantIn(10 * policy.durationMs));
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(idle.state().deadline).toBe(fresh);
    expect(JSON.parse(localStorage.getItem(KEY)!).deadline).toBe(fresh);
  });
});

describe('만료와 종료 순서', () => {
  it('만료 때 앱 구독은 자격증명과 이전 사용자 캐시가 지워진 뒤에 받고, 서버 로그아웃은 그 뒤 한 번 나간다', async () => {
    const { store, session, idle, signOut } = setup();
    const seen: unknown[] = [];
    // 앱이 쿼리보다 먼저 구독해도 정리가 먼저 돈다.
    session.subscribe((change) => {
      if (change.kind !== 'ended') return;
      seen.push(change.by, store.value(), queryClient.getQueryData(['me']), signOut.mock.calls.length);
    });
    const queryClient: QueryClient = createQueryClient({ session, retry: 0, queries: { gcTime: Infinity } });
    idle.start();
    session.start({ accessToken: 'secret' });
    queryClient.setQueryData(['me'], { name: 'previous user' });
    vi.advanceTimersByTime(policy.durationMs + 1_000);
    expect(seen).toEqual(['idle', null, undefined, 0]);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ accessToken: 'secret' });
    expect(idle.state().phase).toBe('inactive');
  });

  it('서버 로그아웃이 실패해도 로컬 종료는 되돌려지지 않는다', async () => {
    const signOut = vi.fn(async () => {
      throw new RequestFailure({ kind: 'network' });
    });
    const { session } = setup({ signOut });
    session.start({ accessToken: 't' });
    session.end();
    await flush();
    expect(session.current()).toBeNull();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('서버 인증 계약으로 끝난 세션에는 서버 로그아웃을 보내지 않는다', () => {
    const { session, signOut } = setup();
    session.start({ accessToken: 't' });
    session.expire(new RequestFailure({ kind: 'unauthorized', status: 401 }));
    expect(signOut).not.toHaveBeenCalled();
  });

  it('연장 요청 중에는 마감이 지나도 결과를 본 뒤 판단한다', async () => {
    const { session, idle, requestExtend } = setup();
    idle.start();
    session.start({ accessToken: 't' });
    vi.advanceTimersByTime(policy.durationMs - 2_000);
    const pending = deferred<ServerTimeSample | null>();
    requestExtend.mockReturnValueOnce(pending.promise);
    const result = idle.extend();
    vi.advanceTimersByTime(5_000);
    expect(session.current()).not.toBeNull();
    pending.resolve(grantIn(policy.durationMs));
    await expect(result).resolves.toEqual({ ok: true });
    expect(session.current()).not.toBeNull();
  });
});

describe('대표 탭', () => {
  it('대표가 아닌 탭은 마감에 바로 끝내지 않고, 대표가 멈추면 이어받는다', async () => {
    const locks = fakeLocks();
    const leader = setup({ locks });
    leader.idle.start();
    leader.session.start({ accessToken: 't' });
    await flush();
    expect(leader.idle.state().leader).toBe(true);

    const store = memoryStore(leader.store.value());
    const session = createSession<Creds>({ store, reissue: vi.fn() });
    const follower = createIdleTimer({ session, key: KEY, policy, extend: vi.fn(), environment: { locks } });
    follower.start();
    await flush();
    expect(follower.state().leader).toBe(false);

    leader.idle.stop();
    await flush();
    expect(follower.state().leader).toBe(true);
  });

  it('대표가 아닌 탭은 마감 뒤 유예가 지나야 스스로 끝낸다', async () => {
    const locks = fakeLocks();
    const leader = setup({ locks });
    leader.idle.start();
    leader.session.start({ accessToken: 't' });
    await flush();
    const store = memoryStore(leader.store.value());
    const session = createSession<Creds>({ store, reissue: vi.fn() });
    const follower = createIdleTimer({ session, key: KEY, policy, extend: vi.fn(), environment: { locks } });
    follower.start();
    // 대표 탭이 멈춘 상황: 잠금은 쥐고 있지만 끝내지 않는다.
    vi.spyOn(leader.session, 'expireIdle').mockImplementation(() => undefined);
    await vi.advanceTimersByTimeAsync(policy.durationMs + 1_000);
    expect(session.current()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(session.current()).toBeNull();
  });

  it('다른 세션의 마감 저장 변경은 따르지 않는다', () => {
    const { session, idle } = setup();
    idle.start();
    session.start({ accessToken: 't' });
    const deadline = idle.state().deadline;
    localStorage.setItem(KEY, JSON.stringify({ sessionId: 'other', deadline: Date.now() + 10_000, sentAt: Date.now() }));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(idle.state().deadline).toBe(deadline);
  });

  it('다른 탭의 연장 마감을 저장 변경으로 받는다', () => {
    const { session, idle } = setup();
    idle.start();
    session.start({ accessToken: 't' });
    const sessionId = session.current()!.sessionId;
    const later = Date.now() + 2 * policy.durationMs;
    localStorage.setItem(KEY, JSON.stringify({ sessionId, deadline: later, sentAt: Date.now() }));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(idle.state().deadline).toBe(later);
  });
});

describe('멈춤과 재개(마감을 적용하지 않는 화면)', () => {
  /** 로그인한 뒤 pause()까지 마친 탭. */
  function paused(options?: Parameters<typeof setup>[0]) {
    const tab = setup(options);
    tab.idle.start();
    tab.session.start({ accessToken: 't' });
    tab.idle.pause();
    return tab;
  }

  it('멈춘 채 마감이 지나도 경고·로그아웃이 없고, 조작도 연장하지 않는다', () => {
    const { session, idle, requestExtend, signOut } = paused();
    const phases = new Set<string>();
    idle.subscribe(() => phases.add(idle.state().phase));
    vi.advanceTimersByTime(policy.durationMs - 30_000);
    window.dispatchEvent(new MouseEvent('click'));
    vi.advanceTimersByTime(10 * 60_000);
    expect(phases.has('warning')).toBe(false);
    expect(idle.state()).toMatchObject({ phase: 'active', paused: true, leader: false });
    expect(idle.remaining()).toBeNull();
    expect(session.current()).not.toBeNull();
    expect(signOut).not.toHaveBeenCalled();
    expect(requestExtend).not.toHaveBeenCalled();
  });

  it('경고 중에 멈추면 경고가 사라진다', () => {
    const { session, idle } = setup();
    idle.start();
    session.start({ accessToken: 't' });
    vi.advanceTimersByTime(policy.durationMs - 30_000);
    expect(idle.state().phase).toBe('warning');
    idle.pause();
    expect(idle.state()).toMatchObject({ phase: 'active', paused: true });
  });

  it('재개는 서버 연장을 한 번 보내 그 마감으로 이어 가고, 지난 마감으로 끝내지 않는다', async () => {
    const { session, idle, requestExtend } = paused();
    vi.advanceTimersByTime(policy.durationMs + 10 * 60_000);
    requestExtend.mockResolvedValueOnce(grantIn(policy.durationMs));
    const expected = Date.now() + policy.durationMs;
    await expect(idle.resume()).resolves.toEqual({ ok: true });
    expect(requestExtend).toHaveBeenCalledTimes(1);
    expect(idle.state()).toMatchObject({ phase: 'active', paused: false, deadline: expected, leader: true });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(session.current()).not.toBeNull();
    // 이어진 마감에서는 다시 경고·만료가 돈다.
    await vi.advanceTimersByTimeAsync(policy.durationMs);
    expect(session.current()).toBeNull();
  });

  it('재개 중 서버가 거절하면 지난 마감으로 유휴 종료한다', async () => {
    for (const reply of [null, new RequestFailure({ kind: 'unauthorized', status: 401 })]) {
      localStorage.clear();
      const { session, idle, requestExtend, signOut } = paused();
      const changes: SessionChange[] = [];
      session.subscribe((change) => changes.push(change));
      vi.advanceTimersByTime(policy.durationMs + 1_000);
      if (reply === null) requestExtend.mockResolvedValueOnce(null);
      else requestExtend.mockRejectedValueOnce(reply);
      const result = await idle.resume();
      expect(result.ok).toBe(false);
      expect(changes).toEqual([{ kind: 'ended', by: 'idle' }]);
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(idle.state()).toMatchObject({ phase: 'inactive', paused: false });
      idle.stop();
    }
  });

  it('마감 전 재개에서 연장이 실패하면 기존 마감으로 계속한다', async () => {
    const { session, idle, requestExtend } = paused();
    const deadline = idle.state().deadline;
    vi.advanceTimersByTime(60_000);
    requestExtend.mockResolvedValueOnce(null);
    await idle.resume();
    expect(idle.state()).toMatchObject({ phase: 'active', paused: false, deadline });
    expect(session.current()).not.toBeNull();
  });

  it('start 전에 멈추면 지난 저장 마감으로 끝내지 않고 재개의 연장 결과로 정한다', async () => {
    const first = setup();
    first.idle.start();
    first.session.start({ accessToken: 't' });
    first.idle.stop();
    vi.advanceTimersByTime(policy.durationMs + 60_000);
    const expiredGrant = localStorage.getItem(KEY)!;

    for (const reply of [grantIn(policy.durationMs), null]) {
      localStorage.setItem(KEY, expiredGrant);
      const store = memoryStore(first.store.value());
      const session = createSession<Creds>({ store, reissue: vi.fn() });
      const requestExtend = vi.fn(async () => (reply === null ? null : { ...reply, sentAt: Date.now() }));
      const idle = createIdleTimer({ session, key: KEY, policy, extend: requestExtend, environment: { locks: null } });
      idle.pause();
      idle.start();
      expect(session.current()).not.toBeNull();
      expect(idle.state()).toMatchObject({ phase: 'active', paused: true });
      await idle.resume();
      expect(session.current() !== null).toBe(reply !== null);
      idle.stop();
    }
  });

  it('세션 종료와 stop은 멈춤을 풀어, 다음 로그인은 평소처럼 경고한다', () => {
    const { session, idle } = paused();
    session.end();
    expect(idle.state().paused).toBe(false);
    session.start({ accessToken: 'next' });
    vi.advanceTimersByTime(policy.durationMs - 30_000);
    expect(idle.state().phase).toBe('warning');
    idle.pause();
    idle.stop();
    expect(idle.state().paused).toBe(false);
  });

  it('멈춘 탭은 대표를 내놓아 다른 탭이 마감에 끝내고, 다른 탭의 연장 마감은 멈춘 채 받는다', async () => {
    const locks = fakeLocks();
    const pausedTab = setup({ locks });
    pausedTab.idle.start();
    pausedTab.session.start({ accessToken: 't' });
    await flush();
    expect(pausedTab.idle.state().leader).toBe(true);
    const store = memoryStore(pausedTab.store.value());
    const otherSession = createSession<Creds>({ store, reissue: vi.fn() });
    const other = createIdleTimer({ session: otherSession, key: KEY, policy, extend: vi.fn(), environment: { locks } });
    other.start();
    await flush();
    expect(other.state().leader).toBe(false);

    pausedTab.idle.pause();
    await flush();
    expect(pausedTab.idle.state().leader).toBe(false);
    expect(other.state().leader).toBe(true);

    // 다른 탭의 서버 연장: 저장 마감을 받되 멈춘 탭은 경고하지 않는다.
    const sessionId = pausedTab.session.current()!.sessionId;
    const later = Date.now() + 2 * policy.durationMs;
    localStorage.setItem(KEY, JSON.stringify({ sessionId, deadline: later, sentAt: Date.now() }));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(pausedTab.idle.state()).toMatchObject({ deadline: later, paused: true, phase: 'active' });

    // 다른 탭이 대표로 마감에 끝낸다. 멈춘 탭은 스스로 끝내지 않는다(종료는 세션 동기화로 받는다).
    await vi.advanceTimersByTimeAsync(2 * policy.durationMs + 1_000);
    expect(otherSession.current()).toBeNull();
    expect(pausedTab.session.current()).not.toBeNull();
    expect(pausedTab.idle.state().phase).not.toBe('warning');
  });
});
