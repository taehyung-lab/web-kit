// @vitest-environment jsdom
// 파일 책임: 세션 책임 분리 S1–S7의 시간·탭·저장 순서와 반례를 실제 공개 상태로 관찰한다.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createIdleTimer, createServerClock, type IdlePolicy, type ServerTimeSample } from '../src/session-idle';
import { attachSessionActivity } from '../src/session-activity';
import { createSession, type SessionStore, type StoredSession } from '../src/session';
import { RequestFailure } from '../src/failure';

type Creds = { accessToken: string };
const key = 'policy';
const policy: IdlePolicy = { warningMs: 1000, pendingAtDeadline: 'wait' };
const cleanups: Array<() => void> = [];
/** 다른 탭 저장 알림을 명시적으로 배달하는 환경. */
function tab({ initial = null as StoredSession<Creds> | null, mode = 'wait' as IdlePolicy['pendingAtDeadline'], locks = null as LockManager | null, storage = () => localStorage } = {}) {
  let value = initial;
  let receive: (v: StoredSession<Creds> | null) => void = () => undefined;
  const store: SessionStore<Creds> = { read: () => value, write: (v) => { value = v; }, subscribe: (fn) => { receive = fn; return () => undefined; } };
  const session = createSession({ store, reissue: vi.fn() });
  const request = vi.fn<() => Promise<ServerTimeSample | null>>(async () => null);
  const clock = createServerClock({ key: key + ':clock', storage });
  const idle = createIdleTimer({ session, key, clock, policy: { ...policy, pendingAtDeadline: mode }, extend: request, environment: { locks, storage } });
  cleanups.push(() => { idle.stop(); session.dispose(); });
  return { session, idle, request, clock, external(v: StoredSession<Creds> | null) { value = v; receive(v); } };
}
/** 로그인 완료와 마감은 프로젝트가 각각 전달한다. */
function login(t: ReturnType<typeof tab>, ms?: number) {
  t.idle.start(); t.session.start({ accessToken: 'synthetic' });
  if (ms !== undefined) t.idle.acceptDeadline(t.session.current()!.sessionId, { sentAt: Date.now(), deadline: t.clock.now() + ms });
}
/** 원하는 시점까지 응답을 보류한다. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
/** 대표 획득을 보류해 비대표 탭의 복구를 재현한다. */
const followerLocks = { request: () => new Promise(() => undefined) } as unknown as LockManager;
/** 현재 저장된 기록의 변경 이벤트를 보낸다. */
function storageEvent() { window.dispatchEvent(new StorageEvent('storage', { key: null })); }

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100_000); localStorage.clear(); vi.spyOn(document, 'hasFocus').mockReturnValue(true); });
afterEach(() => { for (const fn of cleanups.splice(0)) fn(); vi.restoreAllMocks(); vi.useRealTimers(); });

it('S1: 부품 없이 모든 조작은 0회, 부착 후 경고·멈춤·유예는 0회', async () => {
  const t = tab(); login(t, 10_000);
  for (const name of ['click', 'mousedown', 'keydown', 'wheel', 'touchstart', 'popstate']) window.dispatchEvent(new Event(name));
  expect(t.request).toHaveBeenCalledTimes(0);
  cleanups.push(attachSessionActivity({ idle: t.idle, intervalMs: 1000 }));
  window.dispatchEvent(new Event('click')); await vi.advanceTimersByTimeAsync(0);
  expect(t.request).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(9000);
  window.dispatchEvent(new Event('click')); expect(t.request).toHaveBeenCalledTimes(1);
  t.idle.pause(); window.dispatchEvent(new Event('click')); expect(t.request).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(2000);
  await t.idle.resume({ graceMs: 10_000 });
  expect(t.idle.state().deadlineSource).toBe('grace');
  window.dispatchEvent(new Event('click')); expect(t.request).toHaveBeenCalledTimes(2);
});

it.each(['success', 'failure', 'resume'] as const)('S1: 다른 탭에 기록된 %s 시도 이후 간격을 지킨다', async (kind) => {
  const a = tab(); login(a, 30_000);
  const b = tab({ initial: a.session.current() }); b.idle.start();
  cleanups.push(attachSessionActivity({ idle: b.idle, intervalMs: 5000, events: ['keydown'] }));
  if (kind === 'failure') a.request.mockRejectedValueOnce(new RequestFailure({ kind: 'network' }));
  if (kind === 'success') a.request.mockResolvedValueOnce({ sentAt: Date.now(), deadline: Date.now() + 40_000 });
  if (kind === 'resume') { a.idle.pause(); await a.idle.resume(); } else await a.idle.extend();
  storageEvent();
  await vi.advanceTimersByTimeAsync(4999); window.dispatchEvent(new Event('keydown'));
  expect(b.request).toHaveBeenCalledTimes(0);
  await vi.advanceTimersByTimeAsync(1); window.dispatchEvent(new Event('keydown'));
  expect(b.request).toHaveBeenCalledTimes(1);
});

it('S2: 필수 선택 누락은 실행 시 오류다', () => {
  const t = tab();
  expect(() => createIdleTimer({ session: t.session, key, policy: { warningMs: 1000 } as IdlePolicy, extend: async () => null })).toThrow('pendingAtDeadline');
});

it.each(['wait', 'expire'] as const)('S2: %s는 자기 요청만 처리하고 늦은 성공은 종료를 되살리지 않는다', async (mode) => {
  const t = tab({ mode }); login(t, 2000);
  const reply = deferred<ServerTimeSample | null>(); t.request.mockReturnValueOnce(reply.promise);
  const pending = t.idle.extend();
  await vi.advanceTimersByTimeAsync(3000);
  expect(t.session.current() !== null).toBe(mode === 'wait');
  reply.resolve({ sentAt: 100_000, deadline: Date.now() + 20_000 }); await pending;
  expect(t.session.current() !== null).toBe(mode === 'wait');
  if (mode === 'expire') expect(t.idle.state().deadline).toBeNull();
});

it('S2: 기다리던 자기 요청 실패 뒤 종료한다', async () => {
  const t = tab(); login(t, 1000);
  const reply = deferred<ServerTimeSample | null>(); t.request.mockReturnValueOnce(reply.promise);
  const pending = t.idle.extend(); await vi.advanceTimersByTimeAsync(6000);
  expect(t.session.current()).not.toBeNull();
  reply.reject(new RequestFailure({ kind: 'timeout' })); await pending;
  expect(t.session.current()).toBeNull();
});

it('S2: 대표 요청이 5초를 넘기면 비대표가 먼저 종료할 수 있다', async () => {
  const a = tab(); login(a, 1000);
  const b = tab({ initial: a.session.current(), locks: followerLocks }); b.idle.start();
  const reply = deferred<ServerTimeSample | null>(); a.request.mockReturnValueOnce(reply.promise);
  const pending = a.idle.extend(); await vi.advanceTimersByTimeAsync(6000);
  expect(b.session.current()).toBeNull();
  // 종료 기록은 다른 탭에도 우선한다.
  reply.resolve({ sentAt: 100_000, deadline: 200_000 }); await pending;
  expect(a.session.current()).toBeNull(); expect(a.idle.state().deadline).toBeNull();
});

it('S2: 비대표 활동 요청을 기다리는 동안 대표의 정상 만료가 우선한다', async () => {
  const a = tab(); login(a, 3000);
  const b = tab({ initial: a.session.current(), locks: followerLocks }); b.idle.start();
  const reply = deferred<ServerTimeSample | null>(); b.request.mockReturnValueOnce(reply.promise);
  cleanups.push(attachSessionActivity({ idle: b.idle, intervalMs: 1000 }));
  window.dispatchEvent(new Event('click'));
  await vi.advanceTimersByTimeAsync(3000); expect(a.session.current()).toBeNull();
  reply.resolve({ sentAt: 100_000, deadline: 200_000 }); await vi.advanceTimersByTimeAsync(0);
  expect(b.session.current()).toBeNull();
});

it('S3: 로그인·새로고침·외부 계정 교체에 자동 마감이 없고 지난 저장 마감만 종료한다', () => {
  const a = tab(); login(a);
  expect(a.idle.state()).toMatchObject({ phase: 'active', deadline: null });
  const b = tab({ initial: a.session.current() }); b.idle.start();
  expect(b.idle.remaining()).toBeNull();
  b.external({ sessionId: 'other', credentials: { accessToken: 'other-synthetic' } });
  expect(b.session.current()).not.toBeNull(); expect(b.idle.state().deadline).toBeNull();
  const old = tab(); login(old, 1000); const initial = old.session.current(); old.idle.stop();
  vi.setSystemTime(102_000);
  const restored = tab({ initial }); restored.idle.start(); expect(restored.session.current()).toBeNull();
});

it.each([500, 50_000])('S3/S4: 임시 %i는 처음 서버 마감으로 대체되고 더 이른 요청의 긴 마감도 채택한다', (localMs) => {
  const t = tab(); login(t);
  const id = t.session.current()!.sessionId;
  t.idle.setProvisionalDeadline(id, Date.now() + localMs);
  t.idle.acceptDeadline(id, { sentAt: 100_000, deadline: 110_000 });
  expect(t.idle.state()).toMatchObject({ deadline: 110_000, deadlineSource: 'server' });
  t.idle.acceptDeadline(id, { sentAt: 99_000, deadline: 120_000 });
  t.idle.acceptDeadline(id, { sentAt: 105_000, deadline: 115_000 });
  t.idle.acceptDeadline('other', { sentAt: 110_000, deadline: 999_000 });
  expect(t.idle.state().deadline).toBe(120_000);
});

it('S4: 두 탭이 같은 옛 저장값을 읽고 동시 쓰기 후 긴 마감 탭을 닫아도 새 탭이 긴 값을 복원한다', () => {
  const a = tab(); login(a, 10_000);
  const initial = a.session.current();
  const snapshot = new Map(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).map((k) => [k, localStorage.getItem(k)!]));
  let stale = true;
  const staleStorage = {
    get length() { return stale ? snapshot.size : localStorage.length; },
    key: (i: number) => stale ? [...snapshot.keys()][i] ?? null : localStorage.key(i),
    getItem: (k: string) => stale ? snapshot.get(k) ?? null : localStorage.getItem(k),
    setItem: (k: string, v: string) => localStorage.setItem(k, v),
  } as Storage;
  const b = tab({ initial, storage: () => staleStorage }); b.idle.start();
  // B는 A의 긴 저장을 재독할 수 없는 경합 순서다.
  a.idle.acceptDeadline(initial!.sessionId, { sentAt: 100_000, deadline: 150_000 });
  b.idle.acceptDeadline(initial!.sessionId, { sentAt: 100_000, deadline: 130_000 });
  a.idle.stop(); stale = false; storageEvent();
  const c = tab({ initial }); c.idle.start();
  expect(b.idle.state().deadline).toBe(150_000); expect(c.idle.state().deadline).toBe(150_000);
});

it.each([true, false])('S4: 세션 시작 뒤 타이머 시작 %s 순서에도 명시 로그인 마감은 남는다', (startFirst) => {
  const t = tab(); if (startFirst) t.idle.start();
  t.session.start({ accessToken: 'synthetic' });
  t.idle.acceptDeadline(t.session.current()!.sessionId, { sentAt: Date.now(), deadline: 130_000 });
  if (!startFirst) t.idle.start();
  const b = tab({ initial: t.session.current() }); b.idle.start();
  expect(t.idle.state().deadline).toBe(130_000); expect(b.idle.state().deadline).toBe(130_000);
});

it('S5: 실패 확정 시점의 보정 시계부터 유예를 저장하고 새 탭도 같은 시한을 쓴다', async () => {
  const t = tab(); login(t, 1000); t.idle.pause(); t.idle.observe({ sentAt: Date.now(), clockOffsetMs: 20_000 });
  const reply = deferred<ServerTimeSample | null>(); t.request.mockReturnValueOnce(reply.promise);
  const pending = t.idle.resume({ graceMs: 5000 }); await vi.advanceTimersByTimeAsync(3000);
  reply.reject(new RequestFailure({ kind: 'network' })); await pending;
  expect(t.idle.remaining()).toBe(5000); expect(t.idle.state().deadline).toBe(128_000);
  const b = tab({ initial: t.session.current() }); b.idle.start();
  expect(b.idle.remaining()).toBe(5000); expect(b.idle.state().deadline).toBe(t.idle.state().deadline);
});

it.each(['none', 'rejected', 'cancelled'] as const)('S5: %s는 유예를 임의 생성하지 않는다', async (kind) => {
  const t = tab(); login(t, 1000); t.idle.pause(); await vi.advanceTimersByTimeAsync(2000);
  t.request.mockRejectedValueOnce(new RequestFailure(kind === 'rejected' ? { kind: 'unauthorized', status: 401 } : { kind: kind === 'cancelled' ? 'cancelled' : 'network' }));
  await t.idle.resume(kind === 'none' ? {} : { graceMs: 5000 });
  expect(t.session.current()).toBeNull();
});

it('S5: 마감 미정에서 서버 거절은 그 탭을 종료한다', async () => {
  const t = tab({ locks: followerLocks }); login(t); t.idle.pause();
  t.request.mockRejectedValueOnce(new RequestFailure({ kind: 'unauthorized', status: 401 }));
  await t.idle.resume({ graceMs: 5000 }); expect(t.session.current()).toBeNull();
});

it.each(['ended', 'updated', 'pause', 'stop', 'replace'] as const)('S5: 재개 대기 중 %s 뒤 실패는 유예로 새 상태를 덮지 않는다', async (transition) => {
  const t = tab(); login(t, 1000); t.idle.pause(); await vi.advanceTimersByTimeAsync(2000);
  const reply = deferred<ServerTimeSample | null>(); t.request.mockReturnValueOnce(reply.promise);
  const pending = t.idle.resume({ graceMs: 5000 });
  if (transition === 'ended') t.external(null);
  if (transition === 'updated') {
    const b = tab({ initial: t.session.current() }); b.idle.pause(); b.idle.start();
    b.idle.acceptDeadline(t.session.current()!.sessionId, { sentAt: Date.now(), deadline: 150_000 }); storageEvent();
  }
  if (transition === 'pause') t.idle.pause();
  if (transition === 'stop') t.idle.stop();
  if (transition === 'replace') t.session.start({ accessToken: 'new-synthetic' });
  reply.reject(new RequestFailure({ kind: 'network' })); await pending;
  expect(t.idle.state().deadlineSource).not.toBe('grace');
  if (transition === 'updated') expect(t.idle.state().deadline).toBe(150_000);
  if (transition === 'ended') expect(t.session.current()).toBeNull();
  if (transition === 'pause') expect(t.idle.state().paused).toBe(true);
});

it.each([500, 50_000])('S4/S5: 유예 %i보다 짧거나 긴 새 서버 마감은 승인값으로 대체한다', async (graceMs) => {
  const t = tab(); login(t, 1000); t.idle.pause(); await vi.advanceTimersByTimeAsync(2000);
  await t.idle.resume({ graceMs });
  t.idle.acceptDeadline(t.session.current()!.sessionId, { sentAt: Date.now(), deadline: 110_000 });
  expect(t.idle.state()).toMatchObject({ deadline: 110_000, deadlineSource: 'server' });
});

it('S6: 실패·무마감·경고 채택·같은 마감 확인·경고 해소를 각각 돌려준다', async () => {
  const t = tab(); login(t);
  const failure = new RequestFailure({ kind: 'network' }); t.request.mockRejectedValueOnce(failure);
  await expect(t.idle.extend()).resolves.toEqual({ kind: 'failed', failure });
  await expect(t.idle.extend()).resolves.toEqual({ kind: 'no-deadline' });
  t.request.mockResolvedValueOnce({ sentAt: Date.now(), deadline: Date.now() + 500 });
  await expect(t.idle.extend()).resolves.toEqual({ kind: 'adopted-warning' });
  t.request.mockResolvedValueOnce({ sentAt: Date.now(), deadline: Date.now() + 500 });
  await expect(t.idle.extend()).resolves.toEqual({ kind: 'adopted-warning' });
  t.request.mockResolvedValueOnce({ sentAt: Date.now() - 1, deadline: Date.now() + 5000 });
  await expect(t.idle.extend()).resolves.toEqual({ kind: 'adopted-active' });
});

// 연장과 재개가 같은 서버 응답 사실을 돌려주고 비감소 마감을 지키는지 확인한다.
it.each(['extend', 'resume'] as const)('소비자 교정: %s는 같은·늦은·이른·없는 마감을 구별한다', async (method) => {
  const t = tab(); login(t, 500);
  const run = () => {
    if (method === 'resume') t.idle.pause();
    return t.idle[method]();
  };
  for (const [deadline, kind, retained] of [
    [100_500, 'adopted-warning', 100_500],
    [105_000, 'adopted-active', 105_000],
    [105_000, 'adopted-active', 105_000],
    [100_200, 'earlier-deadline', 105_000],
    [undefined, 'no-deadline', 105_000],
  ] as const) {
    t.request.mockResolvedValueOnce({ sentAt: Date.now(), deadline });
    await expect(run()).resolves.toEqual({ kind });
    expect(t.idle.state()).toMatchObject({ deadline: retained, deadlineSource: 'server', paused: false });
    expect(t.idle.remaining()).toBe(retained - Date.now());
    expect(t.session.current()).not.toBeNull();
  }
});

it('S7: 로그인 전·양음 보정·표본 역순·다른 탭 보정·마감 동시 전달을 같은 시계로 판단한다', () => {
  const t = tab(); t.idle.observe({ sentAt: 99_000, clockOffsetMs: 60_000 }); login(t);
  t.idle.setProvisionalDeadline(t.session.current()!.sessionId, t.clock.now() + 10_000);
  expect(t.idle.remaining()).toBe(10_000);
  t.idle.observe({ sentAt: 98_000, clockOffsetMs: -60_000 }); expect(t.idle.remaining()).toBe(10_000);
  t.idle.acceptDeadline(t.session.current()!.sessionId, { sentAt: 100_000, clockOffsetMs: 200_000, deadline: 320_000 });
  expect(t.session.current()).not.toBeNull(); expect(t.idle.remaining()).toBe(20_000);
  t.idle.observe({ sentAt: 101_000, clockOffsetMs: -200_000 }); expect(t.idle.remaining()).toBe(420_000);
  const b = tab({ initial: t.session.current() }); b.idle.start();
  b.clock.observe(210_000, 102_000); storageEvent();
  expect(t.idle.remaining()).toBe(10_000); expect(b.idle.remaining()).toBe(10_000);
});

it('S5: 재개 중 더 최신이지만 이미 지난 서버 마감도 늦은 실패의 유예로 덮지 않는다', async () => {
  const t = tab(); login(t, 1000); t.idle.pause(); await vi.advanceTimersByTimeAsync(3000);
  const reply = deferred<ServerTimeSample | null>(); t.request.mockReturnValueOnce(reply.promise);
  const pending = t.idle.resume({ graceMs: 5000 });
  const b = tab({ initial: t.session.current() }); b.idle.pause(); b.idle.start();
  b.idle.acceptDeadline(t.session.current()!.sessionId, { sentAt: Date.now(), deadline: 102_000 }); storageEvent();
  reply.reject(new RequestFailure({ kind: 'network' })); await pending;
  expect(t.session.current()).toBeNull(); expect(t.idle.state().deadlineSource).not.toBe('grace');
});

it('S5: 서버가 승인한 지난 마감은 일시 실패로 간주해 유예를 만들지 않는다', async () => {
  const t = tab(); login(t); t.idle.pause();
  t.request.mockResolvedValueOnce({ sentAt: Date.now(), deadline: Date.now() - 1 });
  await expect(t.idle.resume({ graceMs: 5000 })).resolves.toEqual({ kind: 'adopted-warning' });
  expect(t.session.current()).toBeNull();
});

it('S10: 탭 안 직접 연장·재개는 한 요청에 합류하고 stop 뒤 늦은 동기 실패도 다음 요청을 막지 않는다', async () => {
  const t = tab(); login(t, 10_000);
  const reply = deferred<ServerTimeSample | null>(); t.request.mockReturnValueOnce(reply.promise);
  const a = t.idle.extend(); const b = t.idle.extend(); expect(a).toBe(b);
  expect(t.request).toHaveBeenCalledTimes(1);
  reply.resolve(null); await a;
  t.request.mockImplementationOnce(() => { throw new RequestFailure({ kind: 'network' }); });
  await expect(t.idle.extend()).resolves.toMatchObject({ kind: 'failed' });
  await expect(t.idle.extend()).resolves.toMatchObject({ kind: 'no-deadline' });
  expect(t.request).toHaveBeenCalledTimes(3);
});

it('S10: 상태 구독은 매초 표시 구독과 분리된다', () => {
  const t = tab(); login(t, 10_000);
  const states = vi.fn(); const ticks = vi.fn();
  t.idle.subscribe(states); t.idle.subscribeTick(ticks);
  vi.advanceTimersByTime(3000);
  expect(states).toHaveBeenCalledTimes(0); expect(ticks).toHaveBeenCalledTimes(3);
  expect(t.idle.remaining()).toBe(7000);
});

it('리뷰 교정: 20회 재로드·연장·로그아웃·계정 교체 뒤 현재 세션 기록만 일정 개수로 남는다', async () => {
  let initial: StoredSession<Creds> | null = null;
  for (let i = 0; i < 20; i++) {
    const t = tab({ initial });
    t.idle.start();
    if (!initial) t.session.start({ accessToken: 'synthetic' });
    t.request.mockResolvedValueOnce({ sentAt: Date.now(), deadline: 200_000 + i * 1000 });
    await t.idle.extend();
    if (i % 3 === 0) { t.session.end(); t.session.start({ accessToken: 'replacement' }); }
    else if (i % 3 === 1) t.session.start({ accessToken: 'replacement' });
    t.idle.acceptDeadline(t.session.current()!.sessionId, { sentAt: Date.now(), deadline: 300_000 + i * 1000 });
    initial = t.session.current();
    t.idle.stop(); t.session.dispose();
    const keys = Array.from({ length: localStorage.length }, (_, n) => localStorage.key(n)!).filter((k) => k.startsWith(key + ':records:'));
    expect(keys.length).toBeLessThanOrEqual(1);
    expect(keys.every((k) => k.includes(encodeURIComponent(initial!.sessionId)) && !k.endsWith(':ended'))).toBe(true);
    const restored = tab({ initial }); restored.idle.start();
    expect(restored.idle.state().deadline).toBe(300_000 + i * 1000);
    restored.idle.stop(); restored.session.dispose();
  }
});

it('리뷰 교정: 이전 세션 표식 정리 뒤 도착한 다른 탭의 성공도 새 세션을 덮거나 옛 기록을 되살리지 않는다', async () => {
  const a = tab(); login(a, 10_000);
  const oldId = a.session.current()!.sessionId;
  const b = tab({ initial: a.session.current() }); b.idle.start();
  const reply = deferred<ServerTimeSample | null>(); b.request.mockReturnValueOnce(reply.promise);
  const pending = b.idle.extend();
  a.session.end(); a.session.start({ accessToken: 'new-synthetic' });
  const newId = a.session.current()!.sessionId;
  a.idle.acceptDeadline(newId, { sentAt: Date.now(), deadline: 150_000 });
  reply.resolve({ sentAt: Date.now(), deadline: 999_000 }); await pending;
  storageEvent();
  expect(b.session.current()).toBeNull(); expect(a.idle.state().deadline).toBe(150_000);
  const keys = Array.from({ length: localStorage.length }, (_, n) => localStorage.key(n)!).filter((k) => k.startsWith(key + ':records:'));
  expect(keys.length).toBeLessThanOrEqual(1);
  expect(keys.some((k) => k.includes(encodeURIComponent(oldId)) || k.endsWith(':ended'))).toBe(false);
  const reopened = tab({ initial: a.session.current() }); reopened.idle.start();
  expect(reopened.idle.state().deadline).toBe(150_000);
});

it('리뷰 교정: 멈춘 옛 타이머의 명시 마감 전달도 교체된 저장 경계를 다시 열지 않는다', () => {
  const a = tab(); login(a, 10_000);
  const oldId = a.session.current()!.sessionId;
  a.idle.stop();
  const b = tab({ initial: a.session.current() }); b.idle.start();
  b.session.start({ accessToken: 'new-synthetic' });
  b.idle.acceptDeadline(b.session.current()!.sessionId, { sentAt: Date.now(), deadline: 150_000 });
  expect(a.idle.acceptDeadline(oldId, { sentAt: Date.now(), deadline: 999_000 })).toBe(false);
  a.idle.start();
  expect(a.session.current()).toBeNull();
  storageEvent(); expect(b.idle.state().deadline).toBe(150_000);
});

it('리뷰 교정: A가 요약을 확보한 뒤 삭제하는 사이 B가 더 긴 마감을 쓰고 정리해도 최대값은 남는다', () => {
  let interleaved = false;
  let interleave: (() => void) | undefined;
  const wrapped = {
    get length() { return localStorage.length; },
    key: (i: number) => localStorage.key(i),
    getItem: (k: string) => localStorage.getItem(k),
    removeItem(k: string) {
      const run = interleave;
      if (run && k.startsWith(key + ':records:')) {
        interleave = undefined; interleaved = true; run();
      }
      localStorage.removeItem(k);
    },
    setItem: (k: string, raw: string) => localStorage.setItem(k, raw),
  } as Storage;
  const a = tab({ storage: () => wrapped }); login(a, 10_000);
  const b = tab({ initial: a.session.current() }); b.idle.start();
  const initial = a.session.current();
  interleave = () => { b.idle.acceptDeadline(initial!.sessionId, { sentAt: Date.now(), deadline: 160_000 }); };
  a.idle.acceptDeadline(initial!.sessionId, { sentAt: Date.now(), deadline: 150_000 });
  a.idle.stop(); b.idle.stop();
  const c = tab({ initial }); c.idle.start();
  expect(c.idle.state().deadline).toBe(160_000);
  expect(interleaved).toBe(true);
  const keys = Array.from({ length: localStorage.length }, (_, n) => localStorage.key(n)!).filter((k) => k.startsWith(key + ':records:'));
  expect(keys).toHaveLength(1);
});

it('리뷰 교정: 세션이 없는 새 페이지 시작은 이전 기록과 종료 표식을 정리한다', () => {
  localStorage.setItem(key + ':records:old:ended', '1');
  localStorage.setItem(key + ':records:old:writer', JSON.stringify({ sessionId: 'old', server: 130_000, local: null, attempt: null }));
  const t = tab(); t.idle.start();
  expect(Array.from({ length: localStorage.length }, (_, n) => localStorage.key(n)!).filter((k) => k.startsWith(key + ':records:'))).toEqual([]);
});


it('리뷰 교정: 구형 종료 표식은 정리하기 전에 경계로 옮겨 옛 세션 복원을 막는다', () => {
  localStorage.setItem(key + ':records:old:ended', '1');
  localStorage.setItem(key + ':records:old:writer', JSON.stringify({ sessionId: 'old', server: 130_000, local: null, attempt: null }));
  const t = tab({ initial: { sessionId: 'old', credentials: { accessToken: 'synthetic' } } }); t.idle.start();
  expect(t.session.current()).toBeNull();
  expect(Array.from({ length: localStorage.length }, (_, n) => localStorage.key(n)!).filter((k) => k.startsWith(key + ':records:'))).toEqual([]);
});
