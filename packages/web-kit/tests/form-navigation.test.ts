/** 이탈 판정은 공개 요청으로 범위·경합·실행 횟수를 검사한다. */
import { expect, it, vi } from 'vitest';
import { createFormNavigation, type FormFacts } from '../src/form/navigation';

it('여러 폼은 한 번만 묻고 승인도 한 번만 실행한다', () => {
  const nav = createFormNavigation();
  const run = vi.fn();
  const other = vi.fn();
  nav.register({}, { read: () => ({ dirty: true, busy: false, identity: 1 }) });
  nav.register({}, { read: () => ({ dirty: true, busy: false, identity: 2 }) });
  expect(nav.request(run)).toBe('confirming');
  expect(nav.request(other)).toBe('blocked');
  nav.confirm();
  nav.confirm();
  expect(run).toHaveBeenCalledTimes(1);
  expect(other).not.toHaveBeenCalled();
});
it('닫히는 범위만 검사하고 페이지 이동은 전체를 검사한다', () => {
  const nav = createFormNavigation();
  const dialog = {};
  nav.registerScope(dialog);
  nav.register({}, { read: () => ({ dirty: true, busy: false, identity: 1 }) });
  nav.register({}, { scope: dialog, read: () => ({ dirty: false, busy: false, identity: 2 }) });
  const close = vi.fn();
  expect(nav.request(close, { scope: dialog })).toBe('performed');
  expect(close).toHaveBeenCalledOnce();
  expect(nav.request(vi.fn())).toBe('confirming');
});
it.each(['saving', 'identity', 'removed'] as const)('확인 대기 뒤 %s 변화는 이전 동작을 무효화한다', (kind) => {
  const nav = createFormNavigation();
  let facts: FormFacts = { dirty: true, busy: false, identity: 1 };
  const remove = nav.register({}, { read: () => facts });
  const run = vi.fn();
  const cancel = vi.fn();
  nav.request(run, { onCancel: cancel });
  if (kind === 'saving') facts = { ...facts, busy: true };
  if (kind === 'identity') facts = { ...facts, identity: 2 };
  if (kind === 'removed') remove();
  nav.confirm();
  expect(run).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
});
it('중첩 범위와 재마운트는 옛 요청을 실행하지 않는다', () => {
  const nav = createFormNavigation();
  const outer = {},
    inner = {};
  const remove = nav.registerScope(outer);
  nav.registerScope(inner, outer);
  nav.register({}, { scope: inner, read: () => ({ dirty: true, busy: false, identity: 1 }) });
  const run = vi.fn();
  nav.request(run, { scope: outer });
  remove();
  nav.registerScope(outer);
  nav.confirm();
  expect(run).not.toHaveBeenCalled();
});
it('실행 직전 저장 상태를 읽고 clean 이동은 확인 없이 실행한다', () => {
  const nav = createFormNavigation();
  let busy = true;
  nav.register({}, { read: () => ({ dirty: false, busy, identity: 1 }) });
  const run = vi.fn();
  expect(nav.request(run)).toBe('blocked');
  busy = false;
  expect(nav.request(run)).toBe('performed');
  expect(run).toHaveBeenCalledOnce();
});

it('묻는 이탈은 까닭(취소 버튼/이동)을 함께 기억하고 답하면 지운다', () => {
  const nav = createFormNavigation();
  nav.register({}, { read: () => ({ dirty: true, busy: false, identity: 1 }) });
  nav.request(vi.fn(), { reason: 'cancel' });
  expect(nav.reason).toBe('cancel');
  nav.cancel();
  expect(nav.reason).toBeUndefined();
  nav.request(vi.fn());
  expect(nav.reason).toBe('navigate');
});
