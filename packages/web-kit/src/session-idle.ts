// 파일 책임: 세션 유휴 마감(로그인과 서버 연장만 마감을 바꿈 — 경고 구간 밖 활동은 서버 연장, 경고 구간 안은 연장 버튼만, 일반 응답·재발급은 늘리지 않음)·경고 구간·대표 탭·만료 종료를 판정한다.
// 세대·저장·종료 순서는 session이 맡고, 경고 화면(팝업·모달·알림)은 프로젝트가 이 상태를 보고 그린다.
import { createServerClock, type ServerClock } from './server-clock';
export { createServerClock, type ServerClock } from './server-clock';
import { RequestFailure } from './failure';
import type { Credentials, Session, SessionChange } from './session';

/** 프로젝트 시간 정책. */
export interface IdlePolicy {
  /** 로그인 직후 마감까지의 길이. 서버 마감이 오기 전 임시 마감과 "N분" 문구의 기본값이다. */
  readonly durationMs: number;
  /** 남은 시간이 이 값 이하면 경고 구간이다. */
  readonly warningMs: number;
  /** 경고 구간 밖의 사용자 조작이 서버 연장을 부르는 최소 간격(탭 사이 공유). */
  readonly activityThrottleMs: number;
}

/** 응답 하나에서 프로젝트가 읽은 서버 시각. 헤더 형식은 서버 계약이라 프로젝트가 숫자로 바꿔 넘긴다. */
export interface ServerTimeSample {
  /** 요청을 보낸 로컬 시각(ms). 표본 순서의 기준이다. */
  readonly sentAt: number;
  /** 서버 시계 기준 세션 마감(ms). 없으면 마감 표본이 아니다. */
  readonly deadline?: number;
  /** 서버 시각 − 로컬 시각(ms). 관측하지 못했으면 생략한다(0으로 채우지 않는다). */
  readonly clockOffsetMs?: number;
}

export type IdlePhase = 'inactive' | 'active' | 'warning';

export interface IdleState {
  readonly phase: IdlePhase;
  /** 서버 시계 기준 마감. 세션이 없으면 null. */
  readonly deadline: number | null;
  /** 세션 길이(문구용). 서버가 더 긴 마감을 주면 그 길이다. */
  readonly durationMs: number;
  /** 이 탭이 경고·만료를 맡는 대표 탭인가. */
  readonly leader: boolean;
  readonly extending: boolean;
  /** 경고 구간에서 사용자가 경고를 닫아 다시 띄우지 않는 대기 상태. */
  readonly dismissed: boolean;
}

/** 연장 결과. 성공은 서버 마감을 채택했고 경고 구간을 벗어났다는 뜻이다. */
export type ExtendResult = { readonly ok: true } | { readonly ok: false; readonly failure?: unknown };

export interface IdleTimer {
  /** 앱이 연결한다. 이미 끝난 세션(이 세션의 마감이 없거나 지남)은 여기서 동기적으로 끝낸다. */
  readonly start: () => void;
  /** 구독·타이머·대표 잠금을 해제한다. 세션을 끝내지 않는다. */
  readonly stop: () => void;
  /** 모든 응답의 서버 시각. 시계만 보정하고, 로그인 직후 첫 표본만 마감을 확정한다. */
  readonly observe: (sample: ServerTimeSample) => void;
  /** 명시적 연장(연장 버튼). */
  readonly extend: () => Promise<ExtendResult>;
  /** 경고 닫기. 연장하지 않고 대기 상태가 된다. */
  readonly dismiss: () => void;
  /** 남은 시간(ms). 세션이 없으면 null. 표시용이며 상태 구독과 따로 쓴다. */
  readonly remaining: () => number | null;
  readonly state: () => IdleState;
  /** 상태가 바뀔 때만 알린다(매초 아님). useSyncExternalStore에 그대로 넘길 수 있다. */
  readonly subscribe: (listener: () => void) => () => void;
  /** 매초 알린다. 카운트다운 표시용이다. */
  readonly subscribeTick: (listener: () => void) => () => void;
}

/** 테스트·격리 환경용 입력. 생략하면 브라우저 전역을 쓴다. */
export interface IdleEnvironment {
  /** null이면 Web Locks가 없는 환경으로 본다(모든 탭이 대표). */
  readonly locks?: LockManager | null;
  readonly storage?: () => Storage;
}

interface Grant {
  readonly sessionId: string;
  readonly deadline: number;
  readonly sentAt: number;
}

const TICK_MS = 1_000;
/** 대표가 아닌 탭은 대표가 끝내지 못한 채 이만큼 지나면 스스로 끝낸다(대표 탭 정지 대비). */
const FOLLOWER_GRACE_MS = 5_000;
/** 세션 연장을 부르는 명시적 조작. mousemove·scroll은 프로그램이나 지나가는 움직임과 구별할 수 없어 뺀다. */
const ACTIVITY_EVENTS = ['click', 'mousedown', 'keydown', 'wheel', 'touchstart', 'popstate'] as const;

/** Worker 1초 tick. 백그라운드 탭의 타이머 지연을 줄인다. 만들 수 없으면 setInterval로 내려간다. */
function startClock(onTick: () => void): () => void {
  let interval: ReturnType<typeof setInterval> | undefined;
  let worker: Worker | undefined;
  const fallback = () => {
    worker?.terminate();
    worker = undefined;
    interval ??= setInterval(onTick, TICK_MS);
  };
  if (typeof Worker === 'undefined' || typeof URL.createObjectURL !== 'function') fallback();
  else {
    try {
      const url = URL.createObjectURL(
        new Blob([`setInterval(function(){postMessage(0)},${TICK_MS})`], { type: 'application/javascript' }),
      );
      worker = new Worker(url);
      URL.revokeObjectURL(url);
      worker.onmessage = onTick;
      worker.onerror = fallback;
    } catch {
      fallback();
    }
  }
  return () => {
    worker?.terminate();
    worker = undefined;
    if (interval !== undefined) clearInterval(interval);
    interval = undefined;
  };
}

/** 저장 접근 실패 때 이 탭의 메모리 값으로 계속한다. */
function createSlot(storage: () => Storage, key: string) {
  let memory: string | null = null;
  return {
    key,
    read(): string | null {
      try {
        return storage().getItem(key);
      } catch {
        return memory;
      }
    },
    write(value: string | null) {
      memory = value;
      try {
        if (value === null) storage().removeItem(key);
        else storage().setItem(key, value);
      } catch {
        // 메모리 값이 이 탭의 기준이다.
      }
    },
  };
}

function parseGrant(raw: string | null): Grant | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { sessionId, deadline, sentAt } = value as Record<string, unknown>;
    if (typeof sessionId !== 'string' || typeof deadline !== 'number' || typeof sentAt !== 'number') return null;
    if (!Number.isFinite(deadline) || !Number.isFinite(sentAt)) return null;
    return { sessionId, deadline, sentAt };
  } catch {
    return null;
  }
}

/**
 * 유휴 타이머를 만든다. 만들기만 하면 아무것도 하지 않고, start()에서 세션에 연결된다.
 * extend는 프로젝트의 서버 연장 호출이며 그 응답의 서버 시각 표본(마감 포함)을 돌려준다. null은 연장 증거가 없다는 뜻이다.
 */
export function createIdleTimer<C extends Credentials>({
  session,
  key,
  policy,
  extend: requestExtend,
  environment = {},
  clock: suppliedClock,
}: {
  readonly session: Session<C>;
  /** 마감·시계 보정을 탭 사이에 공유하는 저장 key와 대표 잠금 이름의 접두. */
  readonly key: string;
  readonly policy: IdlePolicy;
  readonly extend: () => Promise<ServerTimeSample | null>;
  readonly environment?: IdleEnvironment;
  /** 인증 단계와 같은 객체를 전달한다. 생략하면 기존 저장 key를 쓰는 시계를 만든다. */
  readonly clock?: ServerClock;
}): IdleTimer {
  const storage = environment.storage ?? (() => window.localStorage);
  const grantSlot = createSlot(storage, key);
  const clock = suppliedClock ?? createServerClock({ key: `${key}:clock`, storage });
  const locks =
    environment.locks !== undefined ? environment.locks : typeof navigator === 'undefined' ? null : (navigator.locks ?? null);

  let updatingClock = false;
  let started = false;
  let unsubscribeSession: (() => void) | undefined;
  let detach: (() => void) | undefined;
  let grant: Grant | null = null;
  let seedOpenedAt: number | null = null;
  let lastAttemptAt = Number.NEGATIVE_INFINITY;
  let inFlight: Promise<ExtendResult> | undefined;
  let state: IdleState = {
    phase: 'inactive',
    deadline: null,
    durationMs: policy.durationMs,
    leader: false,
    extending: false,
    dismissed: false,
  };
  const listeners = new Set<() => void>();
  const tickListeners = new Set<() => void>();

  const now = clock.now;
  const remaining = () => (state.phase === 'inactive' || state.deadline === null ? null : state.deadline - now());

  /** 상태를 바꾸고, 실제로 바뀌었을 때만 알린다. */
  function update(patch: Partial<IdleState>) {
    const next = { ...state, ...patch };
    if ((Object.keys(next) as (keyof IdleState)[]).every((name) => next[name] === state[name])) return;
    state = next;
    for (const listener of [...listeners]) listener();
  }

  function currentSessionId(): string | undefined {
    return session.current()?.sessionId;
  }

  /** 이 세션의 마감 표본을 받는다. 다른 세션이거나 더 먼저 보낸 요청의 표본은 받지 않는다. */
  function adopt(next: Grant, persist: boolean): boolean {
    if (next.sessionId !== currentSessionId()) return false;
    if (grant !== null && grant.sessionId === next.sessionId && next.sentAt < grant.sentAt) return false;
    grant = next;
    if (persist) grantSlot.write(JSON.stringify(next));
    update({ deadline: next.deadline, durationMs: Math.max(policy.durationMs, next.deadline - now()) });
    evaluate();
    return true;
  }

  /** 서버 표본은 공유 시계 소유자에게 전달한다. */
  function applyOffset(value: number | undefined) {
    updatingClock = true;
    try { clock.observe(value); } finally { updatingClock = false; }
  }

  /** 남은 시간으로 단계를 정하고, 대표 탭이면 만료로 끝낸다. */
  function evaluate() {
    if (state.phase === 'inactive' || state.deadline === null) return;
    const left = state.deadline - now();
    if (left <= 0) {
      if (state.extending) return; // 연장 결과를 본 뒤 다시 판단한다.
      if (state.leader || left <= -FOLLOWER_GRACE_MS) session.expireIdle();
      return;
    }
    const warning = left <= policy.warningMs;
    update({ phase: warning ? 'warning' : 'active', dismissed: warning && state.dismissed });
  }

  function tick() {
    if (updatingClock) return;
    evaluate();
    for (const listener of [...tickListeners]) listener();
  }

  /** 경고 구간 밖의 명시적 조작은 간격마다 서버 연장을 부른다. */
  function onActivity() {
    if (state.phase !== 'active') return;
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
    const localNow = Date.now();
    if (localNow - lastAttemptAt < policy.activityThrottleMs) return;
    if (grant !== null && localNow - grant.sentAt < policy.activityThrottleMs) return;
    lastAttemptAt = localNow;
    void extend();
  }

  /** 다시 보이게 되면 즉시 판단하고, 경고 대기 상태를 푼다. */
  function onVisible() {
    if (document.visibilityState !== 'visible') return;
    if (state.dismissed) update({ dismissed: false });
    tick();
  }

  /** 다른 탭이 쓴 마감·시계를 받는다. */
  function onStorage(event: StorageEvent) {
    if (event.key === grantSlot.key || event.key === null) {
      const stored = parseGrant(grantSlot.read());
      if (stored !== null) adopt(stored, false);
    }
  }

  /** 대표 잠금을 기다린다. 잠금이 없는 환경에서는 바로 대표다. */
  function claimLeader(): () => void {
    if (locks === null) {
      update({ leader: true });
      return () => update({ leader: false });
    }
    const abort = new AbortController();
    let release: (() => void) | undefined;
    locks
      .request(`${key}:leader`, { signal: abort.signal }, () => {
        if (abort.signal.aborted) return undefined;
        update({ leader: true });
        evaluate();
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      })
      .catch(() => undefined);
    return () => {
      abort.abort();
      release?.();
      update({ leader: false });
    };
  }

  /** 세션이 있는 동안의 리스너·시계·대표 잠금을 붙인다. */
  function activate() {
    if (detach !== undefined) return;
    const unsubscribeClock = clock.subscribe(tick);
    update({ phase: 'active' });
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('storage', onStorage);
    const stopClock = startClock(tick);
    const releaseLeader = claimLeader();
    detach = () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('storage', onStorage);
      stopClock();
      unsubscribeClock();
      releaseLeader();
    };
  }

  function deactivate() {
    detach?.();
    detach = undefined;
    grant = null;
    seedOpenedAt = null;
    lastAttemptAt = Number.NEGATIVE_INFINITY;
    update({ phase: 'inactive', deadline: null, durationMs: policy.durationMs, extending: false, dismissed: false });
  }

  /** 로그인: 로컬 시계로 임시 마감을 저장하고, 로그인 뒤 첫 서버 표본으로 확정할 창을 연다. */
  function seed() {
    const sessionId = currentSessionId();
    if (sessionId === undefined) return;
    grant = null;
    activate();
    update({ dismissed: false });
    adopt({ sessionId, deadline: now() + policy.durationMs, sentAt: 0 }, true);
    seedOpenedAt = Date.now();
  }

  function onSessionChange(change: SessionChange) {
    if (change.kind === 'ended') {
      grantSlot.write(null);
      deactivate();
      return;
    }
    if (change.kind === 'started') {
      seed();
      return;
    }
    // replaced: 다른 탭의 다른 계정. 그 탭이 쓴 마감이 있으면 따르고, 아직 없으면 로그인처럼 시작한다.
    deactivate();
    const stored = parseGrant(grantSlot.read());
    if (stored === null || stored.sessionId !== currentSessionId()) seed();
    else {
      activate();
      adopt(stored, false);
    }
  }

  function extend(): Promise<ExtendResult> {
    if (state.phase === 'inactive') return Promise.resolve({ ok: false });
    if (inFlight !== undefined) return inFlight;
    const generation = session.generation();
    update({ extending: true });
    const run = (async (): Promise<ExtendResult> => {
      try {
        const sample = await requestExtend();
        if (generation !== session.generation()) return { ok: false, failure: new RequestFailure({ kind: 'cancelled' }) };
        const sessionId = currentSessionId();
        if (sample !== null && sample.deadline !== undefined && sessionId !== undefined) {
          applyOffset(sample.clockOffsetMs);
          adopt({ sessionId, deadline: sample.deadline, sentAt: sample.sentAt }, true);
        }
        const left = remaining();
        return left !== null && left > policy.warningMs ? { ok: true } : { ok: false };
      } catch (failure: unknown) {
        return { ok: false, failure };
      } finally {
        inFlight = undefined;
        if (generation === session.generation()) {
          update({ extending: false });
          evaluate();
        }
      }
    })();
    inFlight = run;
    return run;
  }

  return {
    start() {
      if (started) return;
      started = true;
      unsubscribeSession = session.subscribe(onSessionChange, 'cleanup');
      const sessionId = currentSessionId();
      if (sessionId === undefined) return;
      const stored = parseGrant(grantSlot.read());
      const refreshClock = clock.subscribe(() => undefined);
      refreshClock();
      if (stored === null || stored.sessionId !== sessionId || stored.deadline - now() <= 0) {
        session.expireIdle();
        return;
      }
      activate();
      adopt(stored, false);
    },
    stop() {
      if (!started) return;
      started = false;
      unsubscribeSession?.();
      unsubscribeSession = undefined;
      deactivate();
    },
    observe(sample) {
      if (state.phase === 'inactive') return;
      applyOffset(sample.clockOffsetMs);
      if (seedOpenedAt !== null && sample.deadline !== undefined && sample.sentAt >= seedOpenedAt) {
        const sessionId = currentSessionId();
        seedOpenedAt = null;
        if (sessionId !== undefined) adopt({ sessionId, deadline: sample.deadline, sentAt: sample.sentAt }, true);
        return;
      }
      evaluate();
    },
    extend,
    dismiss() {
      if (state.phase === 'warning') update({ dismissed: true });
    },
    remaining,
    state: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeTick(listener) {
      tickListeners.add(listener);
      return () => tickListeners.delete(listener);
    },
  };
}
