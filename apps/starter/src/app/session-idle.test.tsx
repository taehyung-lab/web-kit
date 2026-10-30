// 파일 책임: 포장된 키트의 요청별 마감 전달과 화면 소유의 닫음·재노출을 소비자에서 관찰한다.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createSession } from '@boosterlab/web-kit/session';
import { createHttp, springEnvelope } from '@boosterlab/web-kit/http';
import type { AxiosAdapter } from 'axios';
import { createStarterIdle } from './session-idle';
import { SessionWarning } from './SessionWarning';

const dispose: Array<() => void> = [];
afterEach(() => { cleanup(); for (const fn of dispose.splice(0)) fn(); vi.restoreAllMocks(); vi.useRealTimers(); });
/** 합성 서버의 헤더를 소비 측에서 해석한다. */
function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(100_000);
  let current = null as ReturnType<ReturnType<typeof createSession>['current']>;
  const session = createSession({ store: { read: () => current, write: (v) => { current = v; }, subscribe: () => () => undefined }, reissue: vi.fn() });
  const adapter: AxiosAdapter = async (config) => ({ config, status: 200, statusText: '', data: null,
    headers: { 'content-type': 'text/plain', 'x-session-expires': '130000' } });
  const http = createHttp({ session, response: springEnvelope({ lookup: () => undefined }), isPublic: () => false, defaults: { adapter } });
  const idle = createStarterIdle({ session, http, key: 'starter-idle-fixture', policy: { warningMs: 1000, pendingAtDeadline: 'wait' },
    request: { url: '/synthetic-session-extension', method: 'POST' },
    sample: ({ sentAt, response }) => ({ sentAt, deadline: Number(response.header('x-session-expires')) }),
  });
  idle.start(); session.start({ accessToken: 'synthetic' });
  dispose.push(() => { idle.stop(); session.dispose(); });
  return { session, idle };
}

it('S9: 연장 요청이 자기 응답 마감을 전역 표본 없이 전달한다', async () => {
  const { idle } = fixture();
  await expect(idle.extend()).resolves.toEqual({ kind: 'adopted-active' });
  expect(idle.state().deadline).toBe(130_000);
});

it('S8: 닫기→tick→문서 재표시→경고 탈출·재진입→계정 교체의 화면 결과', async () => {
  const { idle, session } = fixture();
  idle.setProvisionalDeadline(session.current()!.sessionId, 100_900);
  render(<SessionWarning idle={idle} />);
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(screen.queryByRole('dialog')).toBeNull();
  let visible = 'hidden';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visible as DocumentVisibilityState);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  visible = 'visible'; act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  await act(async () => { await idle.extend(); });
  expect(screen.queryByRole('dialog')).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(29_000); });
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  act(() => {
    session.start({ accessToken: 'other-synthetic' });
    idle.setProvisionalDeadline(session.current()!.sessionId, Date.now() + 900);
  });
  expect(screen.getByRole('dialog')).toBeTruthy();
});
