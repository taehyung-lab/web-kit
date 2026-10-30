// @vitest-environment jsdom
// 인증 기한·즉시 단일 요청·교체 뒤 응답 격리·세션 공유 시계를 검사한다.
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getAuthTiming, isAuthCode, remainingAuthSeconds, useAuthChallenge } from '../src/auth';
import { createIdleTimer, createServerClock } from '../src/session-idle';
import { createSession } from '../src/session';

/** 지연 응답을 직접 완료하여 경합 순서를 검사한다. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100000); localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('기한·초 경계·재전송 대기와 숫자 길이를 계산한다', () => {
  expect(remainingAuthSeconds(undefined, 0)).toBeUndefined();
  expect(remainingAuthSeconds(1001, 1)).toBe(1);
  expect(remainingAuthSeconds(1001, 1001)).toBe(0);
  expect(getAuthTiming({ codeExpiresAt: 1, resendAvailableAt: 2 }, 1)).toMatchObject({ canSubmit: false, canResend: false, expired: false });
  expect(getAuthTiming({ expiresAt: 1 }, 1)).toMatchObject({ canSubmit: false, canResend: false, expired: true });
  expect(getAuthTiming({}, 1)).toMatchObject({ canSubmit: true, canResend: true });
  expect(isAuthCode('001234', 6)).toBe(true);
  expect(isAuthCode('abcdef', 6)).toBe(false);
  expect(isAuthCode('1234567', 6)).toBe(false);
});
it('같은 순간 중복 실행을 차단하고 만료 뒤 직접 호출도 차단한다', async () => {
  const response = deferred<string>(); const verify = vi.fn(() => response.promise); const onVerified = vi.fn();
  const clock = createServerClock({ key: 'clock' });
  const { result } = renderHook(() => useAuthChallenge({ scope: 'login', clock, codeLength: 6, codeExpiresAt: 105000, verify, onVerified }));
  let pending!: Promise<void>;
  act(() => { pending = result.current.submit('123456'); void result.current.submit('654321'); });
  expect(verify).toHaveBeenCalledTimes(1);
  await act(async () => { response.resolve('ok'); await pending; });
  expect(onVerified).toHaveBeenCalledWith('ok');
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); await result.current.submit('123456'); });
  expect(verify).toHaveBeenCalledTimes(1);
  expect(result.current.canSubmit).toBe(false);
});
it('전환 뒤 옛 성공·실패가 새 진행을 끄거나 결과를 적용하지 않는다', async () => {
  const first = deferred<string>(); const second = deferred<string>(); const onVerified = vi.fn();
  const verify = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const clock = createServerClock({ key: 'clock' });
  const { result, rerender } = renderHook(({ scope }) => useAuthChallenge({ scope, clock, codeLength: 6, verify, onVerified }), { initialProps: { scope: 'email' } });
  let a!: Promise<void>; let b!: Promise<void>;
  act(() => { a = result.current.submit('123456'); });
  rerender({ scope: 'google' });
  act(() => { b = result.current.submit('654321'); });
  await act(async () => { first.reject(new Error('old')); await a; });
  expect(result.current.pending).toBe('verify'); expect(result.current.verifyFailure).toBeUndefined(); expect(result.current.resendFailure).toBeUndefined();
  await act(async () => { second.resolve('new'); await b; });
  expect(onVerified).toHaveBeenCalledExactlyOnceWith('new');
});
it('전체 기한 뒤와 unmount 뒤의 성공은 적용하지 않는다', async () => {
  const response = deferred<string>(); const onVerified = vi.fn(); const clock = createServerClock({ key: 'clock' });
  const { result, unmount } = renderHook(() => useAuthChallenge({ scope: 1, clock, codeLength: 6, expiresAt: 101000, verify: () => response.promise, onVerified }));
  let pending!: Promise<void>;
  act(() => { pending = result.current.submit('123456'); });
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); response.resolve('late'); await pending; });
  expect(onVerified).not.toHaveBeenCalled();
  unmount();
});
it('재전송 대기와 즉시 중복 잠금을 hook 직접 호출에서도 지킨다', async () => {
  const response = deferred<void>(); const resend = vi.fn(() => response.promise); const onResent = vi.fn();
  const clock = createServerClock({ key: 'clock' });
  const { result } = renderHook(() => useAuthChallenge({ scope: 1, clock, codeLength: 6, resendAvailableAt: 103000, verify: async () => undefined, onVerified: () => undefined, resend, onResent }));
  await act(async () => result.current.resend()); expect(resend).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  let pending!: Promise<void>;
  act(() => { pending = result.current.resend(); void result.current.resend(); });
  expect(resend).toHaveBeenCalledTimes(1);
  await act(async () => { response.resolve(); await pending; });
  expect(onResent).toHaveBeenCalledTimes(1);
});
it('로그인 전후가 같은 보정 시계를 쓰고 인증만으로 세션이 시작되지 않는다', () => {
  const clock = createServerClock({ key: 'shared:clock' });
  const session = createSession({ store: { read: () => null, write: () => undefined, subscribe: () => () => undefined }, reissue: vi.fn() });
  const idle = createIdleTimer({ session, key: 'shared', clock, policy: { warningMs: 1000, pendingAtDeadline: 'wait' }, extend: async () => null, environment: { locks: null } });
  const { result } = renderHook(() => useAuthChallenge({ scope: 1, clock, codeLength: 6, codeExpiresAt: 110000, verify: vi.fn(), onVerified: vi.fn() }));
  expect(session.current()).toBeNull();
  clock.observe(2000);
  expect(getAuthTiming({ codeExpiresAt: 110000 }, clock.now()).remainingSeconds).toBe(8);
  idle.start(); act(() => { session.start({ accessToken: 'test' }); idle.setProvisionalDeadline(session.current()!.sessionId, clock.now() + 10000); });
  expect(idle.remaining()).toBe(10000);
  act(() => idle.observe({ sentAt: 100000, clockOffsetMs: 3000 }));
  expect(result.current.remainingSeconds).toBe(7);
  expect(idle.remaining()).toBe(9000);
  idle.stop(); session.dispose();
});

it.each(['verify', 'resend'] as const)('종류별 관문은 %s 대기 중 다른 종류를 허용하고 같은 종류 중복을 막는다', async (firstKind) => {
  const verification = deferred<string>(); const sent = deferred<void>();
  const verify = vi.fn(() => verification.promise); const resend = vi.fn(() => sent.promise);
  const onVerified = vi.fn(); const onResent = vi.fn();
  const clock = createServerClock({ key: 'clock' });
  const { result } = renderHook(() => useAuthChallenge({ scope: 1, clock, codeLength: 6, verify, resend, onVerified, onResent }));
  let checking!: Promise<void>; let sending!: Promise<void>;
  act(() => {
    if (firstKind === 'verify') checking = result.current.submit('123456');
    else sending = result.current.resend();
  });
  expect(firstKind === 'verify' ? result.current.canResend : result.current.canSubmit).toBe(true);
  act(() => {
    if (firstKind === 'verify') sending = result.current.resend();
    else checking = result.current.submit('123456');
    void result.current.submit('123456'); void result.current.resend();
  });
  expect(verify).toHaveBeenCalledTimes(1); expect(resend).toHaveBeenCalledTimes(1);
  expect(result.current.pending).toBe('both');
  await act(async () => { sent.resolve(); await sending; });
  expect(result.current.pending).toBe('verify');
  expect(result.current.canSubmit).toBe(false); expect(result.current.canResend).toBe(true);
  await act(async () => { verification.resolve('ok'); await checking; });
  expect(onVerified).toHaveBeenCalledExactlyOnceWith('ok'); expect(onResent).toHaveBeenCalledTimes(1);
});

it('다른 탭의 시계 보정이 유휴 단계·남은 시간과 인증 남은 초에 즉시 함께 반영된다', () => {
  const clock = createServerClock({ key: 'shared:clock' });
  const session = createSession({ store: { read: () => null, write: () => undefined, subscribe: () => () => undefined }, reissue: vi.fn() });
  const idle = createIdleTimer({ session, key: 'shared', clock, policy: { warningMs: 8000, pendingAtDeadline: 'wait' }, extend: async () => null, environment: { locks: null } });
  idle.start(); session.start({ accessToken: 'test' }); idle.setProvisionalDeadline(session.current()!.sessionId, clock.now() + 10000);
  const { result } = renderHook(() => useAuthChallenge({ scope: 1, clock, codeLength: 6, codeExpiresAt: 110000, verify: vi.fn(), onVerified: vi.fn() }));
  expect(idle.remaining()).toBe(10000); expect(idle.state().phase).toBe('active');
  expect(result.current.remainingSeconds).toBe(10);
  act(() => {
    localStorage.setItem('shared:clock', '3000');
    window.dispatchEvent(new StorageEvent('storage', { key: 'shared:clock', newValue: '3000' }));
  });
  expect(clock.now()).toBe(103000);
  expect(idle.remaining()).toBe(7000); expect(idle.state().phase).toBe('warning');
  expect(result.current.remainingSeconds).toBe(7);
  idle.stop(); session.dispose();
});

it('인증 hook 공개 결과는 종류별 실패 이름을 제공하고 공용 failure를 제거한다', () => {
  const clock = createServerClock({ key: 'clock' });
  const { result } = renderHook(() => useAuthChallenge({ scope: 1, clock, codeLength: 6, verify: vi.fn(), onVerified: vi.fn() }));
  expect(Object.keys(result.current).sort()).toEqual([
    'remainingSeconds', 'challengeRemainingSeconds', 'resendRemainingSeconds', 'expired', 'codeExpired',
    'canSubmit', 'canResend', 'pending', 'verifyFailure', 'resendFailure', 'invalidate', 'submit', 'resend',
  ].sort());
});
