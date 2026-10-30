// 서버 시계 보정을 로그인 전 인증과 로그인 후 유휴 타이머가 함께 사용한다.
export interface ServerClock {
  readonly now: () => number;
  readonly observe: (offsetMs: number | undefined) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

/** 기존 `${idleKey}:clock` 저장 형식을 유지하며, 구독하는 동안 다른 탭의 보정도 받는다. */
export function createServerClock({ key, storage = () => window.localStorage }: {
  readonly key: string;
  readonly storage?: () => Storage;
}): ServerClock {
  let offset = 0;
  const listeners = new Set<() => void>();
  /** 접근 실패 때 마지막 메모리 보정을 유지한다. */
  function read() {
    try {
      const raw = storage().getItem(key);
      if (raw !== null && Number.isFinite(Number(raw))) offset = Number(raw);
    } catch { /* 메모리 보정을 유지한다. */ }
  }
  /** 다른 탭의 시계 변경을 현재 구독자에게 알린다. */
  function receive(event: StorageEvent) {
    if (event.key !== key && event.key !== null) return;
    read();
    for (const listener of [...listeners]) listener();
  }
  read();
  return {
    now: () => Date.now() + offset,
    observe(value) {
      if (value === undefined || !Number.isFinite(value)) return;
      offset = value;
      try { storage().setItem(key, String(value)); } catch { /* 메모리 보정을 유지한다. */ }
      for (const listener of [...listeners]) listener();
    },
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
