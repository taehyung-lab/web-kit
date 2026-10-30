// @vitest-environment jsdom
// 파일 책임: 세션 없이 시계를 재생성할 때 표본 저장 상한과 탭 간 순서·정리 경합을 관찰한다.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createServerClock } from '../src/server-clock';
const key = 'bounded-clock';
const disposals: Array<() => void> = [];
/** 시계 소유 키만 센다. 세션이나 타이머는 만들지 않는다. */
function sampleKeys() { return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).filter((k) => k.startsWith(key + ':samples:')); }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100_000); localStorage.clear(); });
afterEach(() => { for (const off of disposals.splice(0)) off(); vi.restoreAllMocks(); vi.useRealTimers(); });

it('시계 교정: 20회 페이지 재로드와 관측 뒤 표본 키와 전체 스캔 크기가 일정하다', () => {
  const keyRead = vi.spyOn(Storage.prototype, 'key');
  for (let i = 0; i < 20; i++) {
    const clock = createServerClock({ key });
    const off = clock.subscribe(() => undefined);
    keyRead.mockClear();
    clock.observe(i * 100, 100_000 + i);
    expect(keyRead.mock.calls.length).toBeLessThanOrEqual(3);
    window.dispatchEvent(new StorageEvent('storage', { key: sampleKeys()[0] }));
    expect(clock.now()).toBe(100_000 + i * 100);
    off();
    expect(sampleKeys()).toHaveLength(1);
    expect(createServerClock({ key }).now()).toBe(100_000 + i * 100);
  }
});

it('시계 교정: 역순 표본을 배제하고 새 표본의 더 작은 보정도 탭 사이에 공유한다', () => {
  const a = createServerClock({ key }); const b = createServerClock({ key });
  disposals.push(a.subscribe(() => undefined), b.subscribe(() => undefined));
  a.observe(5000, 100_100); b.observe(-5000, 100_000);
  window.dispatchEvent(new StorageEvent('storage', { key: sampleKeys()[0] }));
  expect(a.now()).toBe(105_000); expect(b.now()).toBe(105_000);
  b.observe(-3000, 100_200);
  window.dispatchEvent(new StorageEvent('storage', { key: sampleKeys()[0] }));
  expect(a.now()).toBe(97_000); expect(b.now()).toBe(97_000); expect(sampleKeys()).toHaveLength(1);
});

it('시계 교정: 같은 옛 저장값을 읽은 두 탭의 동시 쓰기에서 최신 표본을 준 탭이 없어도 복원한다', () => {
  createServerClock({ key }).observe(1000, 100_000);
  const snapshot = new Map(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).map((k) => [k, localStorage.getItem(k)!]));
  let stale = true;
  const storage = {
    get length() { return stale ? snapshot.size : localStorage.length; },
    key: (i: number) => stale ? [...snapshot.keys()][i] ?? null : localStorage.key(i),
    getItem: (k: string) => stale ? snapshot.get(k) ?? null : localStorage.getItem(k),
    setItem: (k: string, v: string) => localStorage.setItem(k, v),
    removeItem: (k: string) => localStorage.removeItem(k),
  } as Storage;
  const a = createServerClock({ key }); const b = createServerClock({ key, storage: () => storage });
  disposals.push(b.subscribe(() => undefined));
  a.observe(7000, 100_300); b.observe(3000, 100_200);
  stale = false; window.dispatchEvent(new StorageEvent('storage', { key: sampleKeys()[0] }));
  expect(b.now()).toBe(107_000); expect(createServerClock({ key }).now()).toBe(107_000);
  expect(sampleKeys()).toHaveLength(1);
});

it('시계 교정: 정리의 읽기와 삭제 사이에 다른 탭이 최신 표본을 저장해도 지워지지 않는다', () => {
  let between: (() => void) | undefined;
  let interleaved = false;
  const storage = {
    get length() { return localStorage.length; }, key: (i: number) => localStorage.key(i),
    getItem: (k: string) => localStorage.getItem(k), setItem: (k: string, v: string) => localStorage.setItem(k, v),
    removeItem(k: string) { const run = between; between = undefined; run?.(); localStorage.removeItem(k); },
  } as Storage;
  const a = createServerClock({ key, storage: () => storage }); const b = createServerClock({ key });
  disposals.push(a.subscribe(() => undefined), b.subscribe(() => undefined));
  a.observe(1000, 100_000);
  between = () => { interleaved = true; b.observe(9000, 100_300); };
  a.observe(5000, 100_200);
  window.dispatchEvent(new StorageEvent('storage', { key: sampleKeys()[0] }));
  expect(interleaved).toBe(true);
  expect(a.now()).toBe(109_000); expect(b.now()).toBe(109_000);
  expect(createServerClock({ key }).now()).toBe(109_000); expect(sampleKeys()).toHaveLength(1);
});

it('시계 교정: 같은 시각의 자기 표본은 최신 관측을 쓰고 구형 숫자 저장도 이어받는다', () => {
  localStorage.setItem(key, '2000');
  const a = createServerClock({ key }); expect(a.now()).toBe(102_000);
  a.observe(5000, 100_000); a.observe(-3000, 100_000);
  expect(a.now()).toBe(97_000); expect(createServerClock({ key }).now()).toBe(97_000);
  expect(localStorage.getItem(key)).toBeNull(); expect(sampleKeys()).toHaveLength(1);
});
