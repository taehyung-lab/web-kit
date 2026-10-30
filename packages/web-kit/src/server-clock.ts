// 파일 책임: 응답 표본 순서를 지키며 서버 시계 보정을 로그인 전후와 탭 사이에 공유한다.
export interface ServerClock {
  readonly now: () => number;
  readonly observe: (offsetMs: number | undefined, sentAt?: number) => void;
  readonly subscribe: (listener: () => void) => () => void;
}
/** 저장 불가 때는 마지막 메모리 보정을 유지한다. */
export function createServerClock({ key, storage = () => window.localStorage }: {
  readonly key: string;
  readonly storage?: () => Storage;
}): ServerClock {
  const writerKey = `${key}:samples:${(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)}`;
  let offset = 0;
  let observedAt = -Infinity;
  const listeners = new Set<() => void>();
  /** 표본 시각보다 오래된 보정은 버린다. */
  function accept(value: number, at: number) {
    if (!Number.isFinite(value) || at < observedAt) return;
    offset = value; observedAt = at;
  }
  /** 이전 숫자 형식과 새 표본 형식을 읽는다. */
  function read() {
    try {
      const s = storage();
      const keys = [key];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k?.startsWith(`${key}:samples:`)) keys.push(k);
      }
      for (const k of keys) {
        const raw = s.getItem(k);
        if (raw === null) continue;
        const v = JSON.parse(raw);
        if (typeof v === 'number') accept(v, -Infinity);
        else if (v && typeof v.offset === 'number' && Number.isFinite(v.sentAt)) accept(v.offset, v.sentAt);
      }
    } catch { /* 마지막 보정 유지 */ }
  }
  /** 다른 탭 보정을 받고 구독자에게 알린다. */
  function receive(event: StorageEvent) {
    if (event.key !== key && event.key !== null && !event.key.startsWith(`${key}:samples:`)) return;
    read();
    for (const listener of [...listeners]) listener();
  }
  read();
  return {
    now: () => Date.now() + offset,
    /** 최신 요청 표본의 보정을 저장하고 알린다. */
    observe(value, sentAt = Date.now()) {
      if (value === undefined || !Number.isFinite(value) || !Number.isFinite(sentAt)) return;
      read();
      if (sentAt < observedAt) return;
      accept(value, sentAt);
      try { storage().setItem(writerKey, JSON.stringify({ offset, sentAt })); } catch { /* 메모리 유지 */ }
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
