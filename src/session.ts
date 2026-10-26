// 파일 책임: 세션 수명(세대·시작/종료 진입점·다른 탭 변경 감지·재발급 단일 비행)을 한 곳에서 판정한다.
// 요청 전송과 실패 변환은 http가 맡고, 여기에는 "지금 세대와 토큰"과 "재발급"만 묻는다.
import { isRequestFailure, RequestFailure } from './failure';

/** 세션이 가진 자격증명. access token 외의 값(재발급 본문에 필요한 ID 등)은 프로젝트가 정한다. */
export interface Credentials {
  readonly accessToken: string;
}

/** 저장 단위. sessionId는 키트가 시작 때 만들고 같은 세션의 회전에는 유지한다. */
export interface StoredSession<C extends Credentials> {
  readonly sessionId: string;
  readonly credentials: C;
}

/** 저장 위치 adapter. 다른 탭에서 저장값이 바뀌었다는 사실과 그 값만 알린다. 판정은 하지 않는다. */
export interface SessionStore<C extends Credentials> {
  readonly read: () => StoredSession<C> | null;
  readonly write: (value: StoredSession<C> | null) => void;
  readonly subscribe: (listener: (value: StoredSession<C> | null) => void) => () => void;
}

/** 세대가 바뀌는 사건. 같은 세션의 토큰 회전은 사건이 아니다. */
export type SessionChange =
  | { readonly kind: 'started' }
  | { readonly kind: 'replaced' }
  /** by: 이 탭이 끝냄(local), 다른 탭이 끝냄(other-tab), 서버 인증 계약으로 끝남(server). */
  | { readonly kind: 'ended'; readonly by: 'local' | 'other-tab' | 'server'; readonly cause?: unknown };

export interface Session<C extends Credentials> {
  /** 로그인·계정 교체. 새 세대를 연다. */
  readonly start: (credentials: C) => void;
  /** 로그아웃 등 이 탭의 종료. 세대마다 한 번만 알린다. */
  readonly end: (cause?: unknown) => void;
  /** 서버 인증 계약이 세션 종료를 알렸을 때(결과 코드 표의 종료 행). http가 부른다. */
  readonly expire: (cause: unknown) => void;
  readonly current: () => StoredSession<C> | null;
  readonly generation: () => number;
  /** 그 세대에서 usedToken으로는 안 될 때 새 access token을 얻는다. origin은 재발급을 일으킨 요청 실패(없을 수 있음). 세대가 바뀌면 cancelled. */
  readonly refresh: (generation: number, usedToken: string, origin?: RequestFailure) => Promise<string>;
  readonly subscribe: (listener: (change: SessionChange) => void) => () => void;
}

/** 탭 간 재발급 직렬화에 쓰는 Web Locks 이름. 같은 origin의 탭끼리만 공유된다. */
const REISSUE_LOCK = 'web-kit-session-reissue';

function cancelled(): RequestFailure {
  return new RequestFailure({ kind: 'cancelled' });
}

function newSessionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 세션 수명을 만든다. reissue는 프로젝트의 재발급 호출이며 같은 세션의 새 자격증명을 돌려준다.
 * 재발급 실패는 인증 계약으로 판정한다: 401(자격증명 거부) 또는 결과 코드 표의 세션 종료 행이면 끝낸다(E2 확인 대상).
 * 종료 사유는 종료 행이면 그 재발급 실패, 아니면 원 요청 실패(없으면 재발급 실패)다. 그 밖의 실패는 세션을 유지한다.
 */
export function createSession<C extends Credentials>({
  store,
  reissue,
}: {
  readonly store: SessionStore<C>;
  readonly reissue: (credentials: C) => Promise<C>;
}): Session<C> {
  let current = store.read();
  let generation = 0;
  let inFlight: { readonly generation: number; readonly promise: Promise<string> } | undefined;
  const listeners = new Set<(change: SessionChange) => void>();

  /** 세대를 올리고 구독자에게 알린다. */
  function advance(change: SessionChange) {
    generation += 1;
    inFlight = undefined;
    for (const listener of [...listeners]) listener(change);
  }

  // 다른 탭의 저장값: 같은 sessionId면 회전, 아니면 세션 교체 또는 종료다.
  store.subscribe((value) => {
    if (value !== null && current !== null && value.sessionId === current.sessionId) {
      current = value;
      return;
    }
    if (value === null && current === null) return;
    current = value;
    advance(value === null ? { kind: 'ended', by: 'other-tab' } : { kind: 'replaced' });
  });

  function start(credentials: C) {
    current = { sessionId: newSessionId(), credentials };
    store.write(current);
    advance({ kind: 'started' });
  }

  /** 세대마다 한 번만 끝낸다. */
  function endBy(by: 'local' | 'server', cause: unknown) {
    if (current === null) return;
    current = null;
    store.write(null);
    advance(cause === undefined ? { kind: 'ended', by } : { kind: 'ended', by, cause });
  }

  /** lock 안에서 한 번 실행한다. 저장값을 다시 읽어 다른 탭의 회전 결과가 있으면 재사용한다. */
  async function reissueOnce(started: number, usedToken: string, origin: RequestFailure | undefined): Promise<string> {
    if (generation !== started || current === null) throw cancelled();
    const stored = store.read();
    if (stored !== null && stored.sessionId === current.sessionId && stored.credentials.accessToken !== usedToken) {
      current = stored;
      return stored.credentials.accessToken;
    }
    const session = current;
    let next: C;
    try {
      next = await reissue(session.credentials);
    } catch (error: unknown) {
      if (generation !== started) throw cancelled();
      if (isRequestFailure(error) && (error.status === 401 || error.endsSession)) {
        endBy('server', error.endsSession ? error : (origin ?? error));
        throw cancelled();
      }
      // 재발급의 403은 원 요청의 권한 판정이 아니다.
      if (isRequestFailure(error) && error.status === 403)
        throw new RequestFailure({ kind: 'contract', status: 403, code: error.code, requestId: error.requestId });
      throw error;
    }
    if (generation !== started) throw cancelled();
    current = { sessionId: session.sessionId, credentials: next };
    store.write(current);
    return next.accessToken;
  }

  function refresh(started: number, usedToken: string, origin?: RequestFailure): Promise<string> {
    if (started !== generation) return Promise.reject(cancelled());
    if (inFlight?.generation === started) return inFlight.promise;
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    const run = () => reissueOnce(started, usedToken, origin);
    // Web Locks가 없는 환경은 이 탭 안의 단일 비행만 남는다.
    const promise = (async () => (locks === undefined ? run() : await locks.request(REISSUE_LOCK, run)))().finally(() => {
      if (inFlight?.promise === promise) inFlight = undefined;
    });
    inFlight = { generation: started, promise };
    return promise;
  }

  return {
    start,
    end: (cause) => endBy('local', cause),
    expire: (cause) => endBy('server', cause),
    current: () => current,
    generation: () => generation,
    refresh,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
