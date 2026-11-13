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

/**
 * 저장 위치 adapter. 다른 탭의 실제 변경만 subscribe로 알리고, 이 탭의 write는 알리지 않는다.
 * 영속 저장 실패 뒤 read는 최신 논리 값 또는 null을 반환해야 하며 이전 값을 새 회전으로 내보내지 않는다.
 * write(null) 뒤에는 다른 탭의 실제 쓰기가 오기 전까지 read도 null이다.
 * 저장 오류 처리는 adapter가 맡는다. 저장소 읽기 불가 때의 세션 유지/종료는 프로젝트 정책이다.
 */
export interface SessionStore<C extends Credentials> {
  readonly read: () => StoredSession<C> | null;
  readonly write: (value: StoredSession<C> | null) => void;
  readonly subscribe: (listener: (value: StoredSession<C> | null) => void) => () => void;
}

/** 세대가 바뀌는 사건. 같은 세션의 토큰 회전은 사건이 아니다. */
export type SessionChange =
  | { readonly kind: 'started' }
  | { readonly kind: 'replaced' }
  /** by: 이 탭이 끝냄(local), 유휴 마감으로 끝남(idle), 다른 탭이 끝냄(other-tab), 서버 인증 계약으로 끝남(server). */
  | { readonly kind: 'ended'; readonly by: 'local' | 'idle' | 'other-tab' | 'server'; readonly cause?: unknown };

/** 구독 순서. cleanup(캐시 비움 같은 정리)은 notify(안내·이동)보다 항상 먼저 돈다. */
export type SessionListenerPhase = 'cleanup' | 'notify';

export interface Session<C extends Credentials> {
  /** 로그인·계정 교체. 새 세대를 연다. */
  readonly start: (credentials: C) => void;
  /** 로그아웃 등 이 탭의 종료. 세대마다 한 번만 알린다. */
  readonly end: (cause?: unknown) => void;
  /** 유휴 마감으로 끝낸다. `/session/idle`이 부른다. */
  readonly expireIdle: (cause?: unknown) => void;
  /** 서버 인증 계약이 세션 종료를 알렸을 때(결과 코드 표의 종료 행). http가 부른다. */
  readonly expire: (cause: unknown) => void;
  readonly current: () => StoredSession<C> | null;
  /** 앱 소유 수명을 끝낸다. 영속 세션을 로그아웃하지 않고 외부 구독과 늦은 결과만 해제한다. */
  readonly dispose: () => void;
  readonly generation: () => number;
  /** 그 세대에서 usedToken으로는 안 될 때 새 access token을 얻는다. origin은 재발급을 일으킨 요청 실패(없을 수 있음). 세대가 바뀌면 cancelled. */
  readonly refresh: (generation: number, usedToken: string, origin?: RequestFailure) => Promise<string>;
  readonly subscribe: (listener: (change: SessionChange) => void, phase?: SessionListenerPhase) => () => void;
}

/**
 * 재발급 응답 전용 종료 해석. 같은 결과 코드가 일반 요청에서는 "재발급하라"지만 재발급 응답에서는 "세션 끝"을 뜻할 때 넘긴다.
 * 일반 요청용 결과 코드 표와 따로 둔다. 키와 문구 키는 프로젝트의 서버 계약에서 옮겨 적는다.
 */
export interface ReissueEndCodes {
  /** 재발급 실패의 결과 코드 → 종료 문구 키. 표에 있는 코드면 HTTP status와 관계없이 그 문구 키로 세션을 끝낸다. */
  readonly codes: Readonly<Record<string, string>>;
  /** 표에 없는 재발급 401의 종료 문구 키. 생략하면 401의 종료 사유는 원 요청 실패(없으면 재발급 실패)다. */
  readonly unauthorizedMessageKey?: string;
}

/** 재발급 실패에 재발급 응답 전용 종료 해석을 적용한다. 해당 없으면 받은 실패 그대로다. */
function applyReissueEnd(error: unknown, table: ReissueEndCodes | undefined): unknown {
  if (table === undefined || !isRequestFailure(error)) return error;
  const byCode = error.code !== undefined && Object.hasOwn(table.codes, error.code) ? table.codes[error.code] : undefined;
  const messageKey = byCode ?? (error.status === 401 ? table.unauthorizedMessageKey : undefined);
  if (messageKey === undefined) return error;
  return new RequestFailure({
    kind: error.kind,
    status: error.status,
    code: error.code,
    requestId: error.requestId,
    messageKey,
    endsSession: true,
    fieldErrors: error.fieldErrors,
    resultUnknown: error.resultUnknown,
  });
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
 * reissueEnd는 재발급 응답에서만 쓰는 결과 코드→종료 문구 키 표다. 표에 걸린 실패는 그 문구 키의 종료 행으로 본다.
 * signOut은 이 탭이 끝낸 세션(local·idle)의 서버 로그아웃이다. 로컬 종료와 알림이 끝난 뒤 한 번 보내고, 실패는 종료를 되돌리지 않는다.
 */
export function createSession<C extends Credentials>({
  store,
  reissue,
  signOut,
  reissueEnd,
}: {
  readonly store: SessionStore<C>;
  readonly reissue: (credentials: C) => Promise<C>;
  readonly signOut?: (credentials: C) => Promise<unknown>;
  readonly reissueEnd?: ReissueEndCodes;
}): Session<C> {
  let current = store.read();
  let generation = 0;
  let disposed = false;
  let inFlight: { readonly generation: number; readonly promise: Promise<string> } | undefined;
  const listeners: Record<SessionListenerPhase, Set<(change: SessionChange) => void>> = {
    cleanup: new Set(),
    notify: new Set(),
  };

  /** 세대를 올리고 정리 구독 → 앱 구독 순서로 알린다. */
  function advance(change: SessionChange) {
    generation += 1;
    inFlight = undefined;
    for (const listener of [...listeners.cleanup, ...listeners.notify]) listener(change);
  }

  /** 다른 탭 알림과 lock 안 저장 재확인이 같은 세대 판정을 쓴다. */
  function acceptStored(value: StoredSession<C> | null) {
    if (disposed) return;
    if (value !== null && current !== null && value.sessionId === current.sessionId) {
      current = value;
      return;
    }
    if (value === null && current === null) return;
    current = value;
    advance(value === null ? { kind: 'ended', by: 'other-tab' } : { kind: 'replaced' });
  }
  const unsubscribeStore = store.subscribe(acceptStored);

  function start(credentials: C) {
    if (disposed) return;
    current = { sessionId: newSessionId(), credentials };
    store.write(current);
    advance({ kind: 'started' });
  }

  /** 세대마다 한 번만 끝낸다. 이 탭이 끝낸 세션은 잡아 둔 자격증명으로 서버 로그아웃을 한 번 보낸다. */
  function endBy(by: 'local' | 'idle' | 'server', cause: unknown) {
    if (current === null) return;
    const ended = current.credentials;
    current = null;
    store.write(null);
    advance(cause === undefined ? { kind: 'ended', by } : { kind: 'ended', by, cause });
    if (by === 'server' || signOut === undefined) return;
    try {
      void signOut(ended).catch(() => undefined);
    } catch {
      // 서버 로그아웃 실패는 로컬 종료를 되돌리지 않는다.
    }
  }

  /** lock 안에서 한 번 실행한다. 저장값을 다시 읽어 다른 탭의 회전 결과가 있으면 재사용한다. */
  async function reissueOnce(started: number, usedToken: string, origin: RequestFailure | undefined): Promise<string> {
    if (generation !== started || current === null) throw cancelled();
    const stored = store.read();
    if (stored?.sessionId !== current.sessionId) {
      acceptStored(stored);
      throw cancelled();
    }
    if (stored !== null && stored.sessionId === current.sessionId && stored.credentials.accessToken !== usedToken) {
      current = stored;
      return stored.credentials.accessToken;
    }
    const session = current;
    let next: C;
    try {
      next = await reissue(session.credentials);
    } catch (thrown: unknown) {
      if (generation !== started) throw cancelled();
      const error = applyReissueEnd(thrown, reissueEnd);
      const latest = store.read();
      if (latest?.sessionId !== session.sessionId) {
        acceptStored(latest);
        throw cancelled();
      }
      if (isRequestFailure(error) && error.rejectsAuthentication) {
        endBy('server', error.endsSession ? error : (origin ?? error));
        throw cancelled();
      }
      // 재발급의 403은 원 요청의 권한 판정이 아니다.
      if (isRequestFailure(error) && error.status === 403)
        throw new RequestFailure({ kind: 'contract', status: 403, code: error.code, requestId: error.requestId });
      throw error;
    }
    if (generation !== started) throw cancelled();
    // storage 이벤트가 큐에 남아 있어도 다른 계정·종료 값을 덮지 않는다.
    const latest = store.read();
    if (latest?.sessionId !== session.sessionId) {
      acceptStored(latest);
      throw cancelled();
    }
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
    expireIdle: (cause) => endBy('idle', cause),
    expire: (cause) => endBy('server', cause),
    current: () => current,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubscribeStore();
      current = null;
      generation += 1;
      inFlight = undefined;
      listeners.cleanup.clear();
      listeners.notify.clear();
    },
    generation: () => generation,
    refresh,
    subscribe: (listener, phase = 'notify') => {
      listeners[phase].add(listener);
      return () => listeners[phase].delete(listener);
    },
  };
}
