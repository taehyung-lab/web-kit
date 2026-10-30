// 파일 책임: 응답 표본 순서를 지키며 보정을 탭 사이에 공유하고 오래된 저장 표본을 정리한다.
export interface ServerClock {
  readonly now: () => number;
  readonly observe: (offsetMs: number | undefined, sentAt?: number) => void;
  readonly subscribe: (listener: () => void) => () => void;
}
interface ClockSample {
  readonly key: string;
  readonly offset: number;
  readonly sentAt: number;
}
/** 같은 전송 시각은 불변 키 순서로 결정해 모든 탭이 같은 보정으로 수렴한다. */
function compare(a: ClockSample, b: ClockSample): number {
  if (a.sentAt !== b.sentAt) return a.sentAt > b.sentAt ? 1 : -1;
  return a.key === b.key ? 0 : a.key > b.key ? 1 : -1;
}
/** 구형 숫자 보정과 요청 시각이 있는 표본을 같은 읽기 경로로 검증한다. */
function parse(raw: string | null, key: string): ClockSample | null {
  try {
    const v: unknown = JSON.parse(raw ?? 'null');
    if (typeof v === 'number' && Number.isFinite(v)) return { key, offset: v, sentAt: -Infinity };
    if (v && typeof v === 'object' && 'offset' in v && 'sentAt' in v &&
      typeof v.offset === 'number' && Number.isFinite(v.offset) && typeof v.sentAt === 'number' && Number.isFinite(v.sentAt))
      return { key, offset: v.offset, sentAt: v.sentAt };
    return null;
  } catch { return null; }
}
/** 세션 수명과 무관하게 최신 표본 하나를 보존한다. 저장 불가 때는 이 탭의 마지막 보정을 유지한다. */
export function createServerClock({ key, storage = () => window.localStorage }: {
  readonly key: string;
  readonly storage?: () => Storage;
}): ServerClock {
  const prefix = `${key}:samples:`;
  const writer = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let sequence = 0;
  let current: ClockSample | null = null;
  const listeners = new Set<() => void>();
  /** 메모리보다 최신인 표본만 반영한다. */
  function accept(sample: ClockSample) {
    if (current === null || compare(sample, current) >= 0) current = sample;
  }
  /** 읽었던 표본 중 최신 항목을 보존하고 나머지만 지운다. 새로 생긴 키는 삭제 목록에 없다. */
  function compact(entries: readonly { key: string; sample: ClockSample | null }[]) {
    const newest = entries.flatMap((entry) => entry.sample ? [entry.sample] : [])
      .sort((a, b) => compare(b, a))[0];
    if (newest) accept(newest);
    for (const entry of entries) {
      if (entry.key === newest?.key) continue;
      try { storage().removeItem(entry.key); } catch { /* 정리 실패는 기존 값을 보존한다. */ }
    }
  }
  /** 관측·구독·저장 이벤트에서 최신 표본을 읽으며 인스턴스별 과거 키를 함께 정리한다. */
  function read() {
    try {
      const slot = storage();
      const keys = [key];
      for (let i = 0; i < slot.length; i++) {
        const k = slot.key(i);
        if (k?.startsWith(prefix)) keys.push(k);
      }
      const entries = keys.flatMap((k) => {
        const raw = slot.getItem(k);
        return raw === null ? [] : [{ key: k, sample: parse(raw, k) }];
      });
      compact(entries);
    } catch { /* 마지막 메모리 보정을 유지한다. */ }
  }
  /** 다른 탭 보정을 받고 구독자에게 알린다. 삭제 이벤트도 같은 현재 저장값으로 판단한다. */
  function receive(event: StorageEvent) {
    if (event.key !== key && event.key !== null && !event.key.startsWith(prefix)) return;
    read();
    for (const listener of [...listeners]) listener();
  }
  read();
  return {
    now: () => Date.now() + (current?.offset ?? 0),
    /** 새 불변 키로 표본을 쓴 뒤 최신 표본만 남긴다. 먼저 보낸 요청의 늦은 응답은 쓰지 않는다. */
    observe(value, sentAt = Date.now()) {
      if (value === undefined || !Number.isFinite(value) || !Number.isFinite(sentAt)) return;
      read();
      if (current !== null && sentAt < current.sentAt) return;
      const sample: ClockSample = { key: `${prefix}${writer}:${String(++sequence).padStart(16, '0')}`, offset: value, sentAt };
      accept(sample);
      try { storage().setItem(sample.key, JSON.stringify({ offset: value, sentAt })); } catch { /* 메모리 보정을 유지한다. */ }
      read();
      for (const listener of [...listeners]) listener();
    },
    /** 첫 구독부터 마지막 해제까지 다른 탭 변경을 듣는다. */
    subscribe(listener) {
      if (listeners.size === 0) {
        read();
        if (typeof window !== 'undefined') window.addEventListener('storage', receive);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', receive);
      };
    },
  };
}
