// @vitest-environment jsdom
/** 실제 브라우저 저장 경로와 저장 장애를 같은 공개 adapter에서 검사한다. */
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createBrowserSessionStore } from '../src/browser-session-store';
import { checkSessionStoreAdapter } from '../src/session-testing';
const credentials = z.object({ accessToken: z.string(), loginId: z.string() });
const localStorage = window.localStorage;
const sessionStorage = window.sessionStorage;
const key = 'kit-test-session';
const a = { sessionId: 'one', credentials: { accessToken: 'synthetic-a', loginId: 'test' } };
const b = { sessionId: 'one', credentials: { accessToken: 'synthetic-b', loginId: 'test' } };
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
/** 실제 storage 이벤트를 모사하되 저장 값도 함께 변경한다. */
function external(value: typeof a | null) {
  const next = value === null ? null : JSON.stringify(value);
  if (next === null) localStorage.removeItem(key);
  else localStorage.setItem(key, next);
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: next, storageArea: localStorage }));
}
it('정상 저장과 외부 변경의 전체 adapter 계약을 통과한다', async () => {
  await checkSessionStoreAdapter(() => {
    localStorage.clear();
    let fail = false;
    const storage: Storage = {
      get length() {
        return localStorage.length;
      },
      key: (i) => localStorage.key(i),
      clear: () => localStorage.clear(),
      getItem: (k) => localStorage.getItem(k),
      setItem: (k, v) => {
        if (fail) throw Error('quota');
        localStorage.setItem(k, v);
      },
      removeItem: (k) => {
        if (fail) throw Error('quota');
        localStorage.removeItem(k);
      },
    };
    const store = createBrowserSessionStore({ key, credentials, unreadable: 'memory', storage: () => storage });
    return {
      store,
      credentials: (accessToken) => ({ accessToken, loginId: 'test' }),
      failWrites: () => {
        fail = true;
      },
      externalWrite: (value) => {
        const raw = value === null ? null : JSON.stringify({ ...value, revision: crypto.randomUUID() });
        if (raw === null) localStorage.removeItem(key);
        else localStorage.setItem(key, raw);
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: raw }));
      },
      dispose: () => store.dispose(),
    };
  });
});
it('늦게 온 이전 이벤트는 성공한 새 로컬 값을 덮지 않는다', () => {
  const store = createBrowserSessionStore({ key, credentials, unreadable: 'memory' });
  const notify = vi.fn();
  store.subscribe(notify);
  store.write(a);
  store.write(b);
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(a), storageArea: localStorage }));
  expect(store.read()).toEqual(b);
  expect(notify).not.toHaveBeenCalled();
  store.dispose();
});
it('쓰기 실패 뒤 옛 이벤트와 다른 저장소 이벤트는 최신 메모리를 덮지 않는다', () => {
  let fail = false;
  const storage: Storage = {
    get length() {
      return localStorage.length;
    },
    key: (i) => localStorage.key(i),
    clear: () => localStorage.clear(),
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => {
      if (fail) throw Error();
      localStorage.setItem(k, v);
    },
    removeItem: (k) => {
      if (fail) throw Error();
      localStorage.removeItem(k);
    },
  };
  const store = createBrowserSessionStore({ key, credentials, unreadable: 'memory', storage: () => storage });
  store.write(a);
  fail = true;
  store.write(b);
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(a) }));
  expect(store.read()).toEqual(b);
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: null, storageArea: sessionStorage }));
  expect(store.read()).toEqual(b);
  store.write(null);
  expect(store.read()).toBeNull();
  store.dispose();
});
it('현재 외부 clear는 종료하고 해제 뒤에는 알리지 않는다', () => {
  const store = createBrowserSessionStore({ key, credentials, unreadable: 'memory' });
  store.write(a);
  const listener = vi.fn();
  store.subscribe(listener);
  localStorage.clear();
  window.dispatchEvent(new StorageEvent('storage', { key: null, newValue: null, storageArea: localStorage }));
  expect(store.read()).toBeNull();
  expect(listener).toHaveBeenCalledOnce();
  store.dispose();
  external(b);
  expect(listener).toHaveBeenCalledOnce();
});
it.each(['memory', 'empty'] as const)('읽기 불가는 명시한 %s 정책을 쓰고 외부 종료로 알리지 않는다', (unreadable) => {
  let fail = false;
  const store = createBrowserSessionStore({
    key,
    credentials,
    unreadable,
    storage: () => {
      if (fail) throw Error('unavailable');
      return localStorage;
    },
  });
  store.write(a);
  const listener = vi.fn();
  store.subscribe(listener);
  fail = true;
  window.dispatchEvent(new StorageEvent('storage', { key: null, newValue: null }));
  expect(store.read()).toEqual(unreadable === 'memory' ? a : null);
  expect(listener).not.toHaveBeenCalled();
  store.dispose();
});

it('외부 변경을 먼저 읽어도 대기 중인 외부 알림은 전달한다', () => {
  const store = createBrowserSessionStore({ key, credentials, unreadable: 'memory' });
  store.write(a);
  const listener = vi.fn();
  store.subscribe(listener);
  const value = JSON.stringify({ ...b, sessionId: 'other' });
  localStorage.setItem(key, value);
  expect(store.read()?.sessionId).toBe('other');
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: value, storageArea: localStorage }));
  expect(listener).toHaveBeenCalledOnce();
  expect(listener.mock.calls[0]?.[0].sessionId).toBe('other');
  store.dispose();
});
