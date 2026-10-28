/** 브라우저 저장과 메모리 복구를 한 곳에서 관리한다. 서버 인증 정책은 세션과 소비자가 맡는다. */
import type { Credentials, SessionStore, StoredSession } from './session';

export interface CredentialsSchema<C> {
  readonly '~standard': {
    readonly validate: (
      value: unknown,
    ) => { readonly value: C; readonly issues?: undefined } | { readonly issues: readonly unknown[] } | Promise<unknown>;
  };
}
export interface BrowserSessionStoreOptions<C extends Credentials> {
  readonly key: string;
  readonly credentials: CredentialsSchema<C>;
  /** 읽기 불가와 값 없음은 다르다. 유지/비움은 제품의 명시적 정책이다. */
  readonly unreadable: 'memory' | 'empty';
  /** 실제 브라우저나 격리한 브라우저 저장 환경. 함수는 저장 접근 자체가 던지는 경우도 포함한다. */
  readonly storage?: () => Storage;
  readonly events?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

/** 기본 브라우저 adapter. 외부 변경은 실제 저장값과 이벤트가 일치할 때만 전달한다. */
export function createBrowserSessionStore<C extends Credentials>(
  options: BrowserSessionStoreOptions<C>,
): SessionStore<C> & { readonly dispose: () => void } {
  let memory: StoredSession<C> | null = null;
  let lastPersisted: string | null | undefined;
  let behind = false;
  let disposed = false;
  const listeners = new Set<(value: StoredSession<C> | null) => void>();
  const storage = options.storage ?? (() => window.localStorage);
  const events = options.events ?? (typeof window === 'undefined' ? undefined : window);
  /** 빈 값·잘못된 형식과 읽기 불가를 구분한다. */
  function raw(): string | null | undefined {
    try {
      return storage().getItem(options.key);
    } catch {
      return undefined;
    }
  }
  /** 키트 envelope와 제품 자격증명 형식을 함께 확인한다. */
  function decode(value: string | null): StoredSession<C> | null {
    if (value === null) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('sessionId' in parsed) ||
        typeof parsed.sessionId !== 'string' ||
        !('credentials' in parsed)
      )
        return null;
      const result = options.credentials['~standard'].validate(parsed.credentials);
      if (result instanceof Promise) throw new Error('credentials schema must be synchronous');
      return result.issues === undefined ? { sessionId: parsed.sessionId, credentials: result.value } : null;
    } catch {
      return null;
    }
  }
  /** 실패한 쓰기보다 이전 영속값이 최신 세션으로 되돌아오지 않게 한다. */
  function read() {
    if (disposed) return null;
    const value = raw();
    if (value === undefined) return options.unreadable === 'memory' ? memory : null;
    if (behind) return memory;
    // 읽기는 대기 중인 외부 알림을 소비하지 않는다. 초기 기준만 정한다.
    if (lastPersisted === undefined) lastPersisted = value;
    memory = decode(value);
    return memory;
  }
  /** 한 세션을 한 키에 원자적으로 쓰고 실패해도 논리 상태를 유지한다. */
  function write(value: StoredSession<C> | null) {
    if (disposed) return;
    if (lastPersisted === undefined) lastPersisted = raw();
    memory = value;
    try {
      const encoded = value === null ? null : JSON.stringify({ ...value, revision: globalThis.crypto.randomUUID() });
      if (encoded === null) storage().removeItem(options.key);
      else storage().setItem(options.key, encoded);
      lastPersisted = encoded;
      behind = false;
    } catch {
      behind = true;
    }
  }
  /** 늦은 이벤트는 실제 현재 저장값과 대조한다. 읽기 불가를 외부 로그아웃으로 추측하지 않는다. */
  function changed(event: Event) {
    if (disposed) return;
    const change = event as StorageEvent;
    if (change.key !== null && change.key !== options.key) return;
    try {
      if (change.storageArea !== null && change.storageArea !== storage()) return;
    } catch {
      return;
    }
    const current = raw();
    if (current === undefined || current !== change.newValue || current === lastPersisted) return;
    lastPersisted = current;
    behind = false;
    memory = decode(current);
    for (const listener of [...listeners]) listener(memory);
  }
  read();
  events?.addEventListener('storage', changed);
  return {
    read,
    write,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      events?.removeEventListener('storage', changed);
      listeners.clear();
      memory = null;
    },
  };
}
