// 파일 책임: 세션별 마감·연장 시도·탭 수명을 공유하고 시간에 따른 단계와 종료를 판정한다.
import { createServerClock, type ServerClock } from './server-clock';
export { createServerClock, type ServerClock } from './server-clock';
import { isRequestFailure, RequestFailure } from './failure';
import type { Credentials, Session, SessionChange } from './session';

/** 프로젝트가 정하는 경고 길이와 0초 처리. */
export interface IdlePolicy {
  readonly warningMs: number;
  /** 자기 탭의 연장 결과를 기다리거나, 마감에 종료한다. 기본값은 없다. */
  readonly pendingAtDeadline: 'wait' | 'expire';
}
/** 프로젝트가 응답 하나에서 해석한 서버 시각(ms). */
export interface ServerTimeSample {
  readonly sentAt: number;
  readonly deadline?: number;
  readonly clockOffsetMs?: number;
}
export type IdlePhase = 'inactive' | 'active' | 'warning';
export interface IdleState {
  readonly phase: IdlePhase;
  readonly deadline: number | null;
  readonly leader: boolean;
  readonly extending: boolean;
  readonly paused: boolean;
  /** 화면이 닫음·재노출을 판단할 환경 사실. */
  readonly visible: boolean;
  readonly sessionId: string | null;
  readonly deadlineSource: 'server' | 'provisional' | 'grace' | null;
}
/** 요청·채택·경고 해소를 구분한다. 화면의 성공 표시는 프로젝트가 정한다. */
export type ExtendResult =
  | { readonly kind: 'failed'; readonly failure: unknown }
  | { readonly kind: 'no-deadline' }
  | { readonly kind: 'adopted-warning' }
  | { readonly kind: 'adopted-active' };
export interface IdleTimer {
  readonly start: () => void;
  readonly stop: () => void;
  /** 일반 표본은 시계에만 반영한다. 로그인 전에도 관측 가능하다. */
  readonly observe: (sample: ServerTimeSample) => void;
  /** 받은 세션 ID와 서버 마감을 명시적으로 전달한다. start 전에도 저장한다. */
  readonly acceptDeadline: (sessionId: string, sample: ServerTimeSample) => boolean;
  /** 프로젝트가 보정 시계 기준으로 정한 임시 마감. 서버 마감이 있으면 사용하지 않는다. */
  readonly setProvisionalDeadline: (sessionId: string, deadline: number) => void;
  readonly extend: () => Promise<ExtendResult>;
  readonly pause: () => void;
  readonly resume: (options?: { readonly graceMs?: number }) => Promise<ExtendResult>;
  readonly remaining: () => number | null;
  /** 활동 부품이 저장 형식을 몰라도 마지막 시도 간격을 읽을 수 있다. */
  readonly lastAttemptAt: () => number | null;
  readonly state: () => IdleState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly subscribeTick: (listener: () => void) => () => void;
}
export interface IdleEnvironment {
  readonly locks?: LockManager | null;
  readonly storage?: () => Storage;
}
interface LocalDeadline {
  readonly deadline: number;
  readonly baseServer: number | null;
  readonly at: number;
  readonly kind: 'provisional' | 'grace';
}
interface RecordValue {
  readonly sessionId: string;
  readonly server: number | null;
  readonly local: LocalDeadline | null;
  readonly attempt: number | null;
}
const TICK_MS = 1_000;
const FOLLOWER_GRACE_MS = 5_000;

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

/** 저장된 탭 기록을 검증한다. 손상된 값은 마감 근거로 쓰지 않는다. */
function parseRecord(raw: string | null): RecordValue | null {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (!v || typeof v.sessionId !== 'string') return null;
    const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
    // 이전 저장 형식도 세션 ID가 일치하는 경우에만 읽는다.
    if (finite(v.deadline) && finite(v.sentAt)) return { sessionId: v.sessionId, server: v.deadline, local: null, attempt: null };
    if (v.server !== null && !finite(v.server)) return null;
    if (v.attempt !== null && !finite(v.attempt)) return null;
    if (v.local !== null && (!v.local || !finite(v.local.deadline) || !finite(v.local.at) ||
      (v.local.baseServer !== null && !finite(v.local.baseServer)) || !['provisional', 'grace'].includes(v.local.kind))) return null;
    return v as RecordValue;
  } catch { return null; }
}
/** 서버가 세션을 거절했는지 기존 재발급 기준으로 판정한다. */
function rejectsSession(failure: unknown): boolean {
  return isRequestFailure(failure) && (failure.status === 401 || failure.endsSession);
}
/** 타이머는 스스로 마감이나 연장 계기를 만들지 않는다. */
export function createIdleTimer<C extends Credentials>({ session, key, policy, extend: requestExtend, environment = {}, clock: suppliedClock }: {
  readonly session: Session<C>;
  readonly key: string;
  readonly policy: IdlePolicy;
  readonly extend: () => Promise<ServerTimeSample | null>;
  readonly environment?: IdleEnvironment;
  readonly clock?: ServerClock;
}): IdleTimer {
  if (!['wait', 'expire'].includes(policy.pendingAtDeadline)) throw new TypeError('pendingAtDeadline is required');
  const storage = environment.storage ?? (() => window.localStorage);
  const clock = suppliedClock ?? createServerClock({ key: `${key}:clock`, storage });
  const locks = environment.locks !== undefined ? environment.locks : typeof navigator === 'undefined' ? null : (navigator.locks ?? null);
  const writer = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const prefix = `${key}:records:`;
  const memory = new Map<string, RecordValue>();
  let started = false;
  let updatingClock = false;
  let detach: (() => void) | undefined;
  let unsubscribeSession: (() => void) | undefined;
  let releaseLeader: (() => void) | undefined;
  let requestLifetime = 0;
  let inFlight: Promise<ExtendResult> | undefined;
  let resuming: Promise<ExtendResult> | undefined;
  let pauseRequested = false;
  let state: IdleState = { phase: 'inactive', deadline: null, leader: false, extending: false, paused: false,
    deadlineSource: null, visible: typeof document !== 'undefined' && document.visibilityState === 'visible', sessionId: null };
  const listeners = new Set<() => void>();
  const tickListeners = new Set<() => void>();
  const now = clock.now;
  /** 실제 상태 변화만 구독자에게 알린다. */
  function update(patch: Partial<IdleState>) {
    const next = { ...state, ...patch };
    if ((Object.keys(next) as (keyof IdleState)[]).every((name) => next[name] === state[name])) return;
    state = next;
    for (const listener of [...listeners]) listener();
  }
  /** 세션별 독립 writer 기록을 병합한다. 서로 다른 탭은 같은 슬롯을 덮지 않는다. */
  function records(id: string): RecordValue[] {
    const found = new Map(memory);
    try {
      const s = storage();
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k === key || k?.startsWith(prefix)) {
          const r = parseRecord(s.getItem(k));
          if (r) found.set(k, r);
        }
      }
    } catch { /* 저장 불가 환경은 이 탭의 메모리만 유지한다. */ }
    return [...found.values()].filter((r) => r.sessionId === id);
  }
  /** 서버 마감은 비감소, 로컬 시한은 자신이 본 서버 마감 이후의 유예만 유효하다. */
  function merged(id: string) {
    const all = records(id);
    const server = all.reduce<number | null>((v, r) => r.server === null ? v : Math.max(v ?? -Infinity, r.server), null);
    const local = all.map((r) => r.local).filter((l): l is LocalDeadline => l !== null &&
      (l.kind === 'provisional' ? server === null : l.baseServer === server))
      .sort((a, b) => b.at - a.at || b.deadline - a.deadline)[0];
    const attempt = all.reduce<number | null>((v, r) => r.attempt === null ? v : Math.max(v ?? -Infinity, r.attempt), null);
    return { server, deadline: local?.deadline ?? server, source: local?.kind ?? (server === null ? null : 'server' as const), attempt };
  }
  /** 이 타이머 전용 슬롯에만 쓴다. 최대값은 다른 탭이 닫혀도 남는다. */
  function write(id: string, patch: Partial<RecordValue>) {
    const slot = `${prefix}${encodeURIComponent(id)}:${writer}`;
    const previous = memory.get(slot) ?? { sessionId: id, server: null, local: null, attempt: null };
    const value = { ...previous, ...patch };
    memory.set(slot, value);
    try { storage().setItem(slot, JSON.stringify(value)); } catch { /* 메모리 유지 */ }
  }
  /** 종료된 세션의 늦은 탭 쓰기를 차단한다. */
  function ended(id: string): boolean {
    try { return storage().getItem(`${prefix}${encodeURIComponent(id)}:ended`) !== null; } catch { return false; }
  }
  /** 지금 세션의 저장 마감과 환경 사실을 반영한다. */
  function refresh() {
    const id = session.current()?.sessionId;
    if (!id || state.phase === 'inactive') return;
    if (ended(id)) { session.expireIdle(); return; }
    const value = merged(id);
    update({ deadline: value.deadline, deadlineSource: value.source, sessionId: id });
  }
  /** 남은 시간과 자기 탭 요청 선택으로 종료를 판정한다. */
  function evaluate() {
    if (state.phase === 'inactive' || state.paused || state.deadline === null) return;
    const left = state.deadline - now();
    if (left <= 0) {
      if (state.extending && policy.pendingAtDeadline === 'wait') return;
      if (state.leader || left <= -FOLLOWER_GRACE_MS) session.expireIdle();
      return;
    }
    update({ phase: left <= policy.warningMs ? 'warning' : 'active' });
  }
  /** 매초 표시 알림과 상태 판정을 분리한다. */
  function tick() {
    if (updatingClock) return;
    refresh();
    evaluate();
    for (const listener of [...tickListeners]) listener();
  }
  /** 문서 표시 사실만 공개하고 재노출은 화면이 맡는다. */
  function onVisible() {
    update({ visible: document.visibilityState === 'visible' });
    if (state.visible) tick();
  }
  /** 저장 이벤트 순서와 관계없이 현재 기록을 병합한다. */
  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key === key || event.key.startsWith(prefix)) tick();
  }
  /** 대표 잠금을 기다린다. 잠금이 없는 환경에서는 바로 대표다. 이미 쥐었거나 기다리는 중이면 그대로 둔다. */
  function takeLeader() {
    releaseLeader ??= claimLeader();
  }

  /** 대표 잠금과 대기 요청을 반납한다. */
  function dropLeader() {
    releaseLeader?.();
    releaseLeader = undefined;
  }

  /** Web Locks 수명 안에서만 대표 자격을 유지한다. */
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

  /** 세션이 있는 동안 환경 구독과 대표 잠금을 연결한다. */
  function activate() {
    if (detach) return;
    update({ phase: 'active', sessionId: session.current()?.sessionId ?? null });
    refresh();
    if (state.phase === 'inactive' || session.current() === null) return;
    const offClock = clock.subscribe(tick);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('storage', onStorage);
    const stopClock = startClock(tick);
    // 대표 획득이 즉시 만료시킬 수 있으므로 먼저 정리 함수를 준비한다.
    detach = () => {
      offClock(); stopClock(); dropLeader();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('storage', onStorage);
    };
    if (!state.paused) takeLeader();
  }
  /** 연결을 해제하되 저장 마감은 새로고침을 위해 남긴다. */
  function deactivate() {
    detach?.(); detach = undefined;
    update({ phase: 'inactive', deadline: null, deadlineSource: null, sessionId: null, extending: false });
  }
  /** 이전 요청 결과가 새 연결을 바꾸지 못하게 한다. */
  function invalidateRequests() {
    requestLifetime += 1; inFlight = undefined; resuming = undefined; pauseRequested = false;
    update({ extending: false });
  }
  /** 시작·교체는 저장된 값만 이어받고 마감을 생성하지 않는다. */
  function onSessionChange(change: SessionChange) {
    const previous = state.sessionId;
    invalidateRequests();
    if (change.kind === 'ended' && previous) {
      try { storage().setItem(`${prefix}${encodeURIComponent(previous)}:ended`, '1'); } catch { /* 저장 불가 */ }
    }
    deactivate();
    if (change.kind === 'ended') update({ paused: false });
    else { activate(); evaluate(); }
  }
  /** 시계와 마감이 함께 올 때 중간 보정만으로 종료하지 않는다. */
  function applySample(sample: ServerTimeSample, id?: string): boolean {
    updatingClock = true;
    let adopted = false;
    try {
      clock.observe(sample.clockOffsetMs, sample.sentAt);
      if (id && id === session.current()?.sessionId && !ended(id) && sample.deadline !== undefined && Number.isFinite(sample.deadline)) {
        const before = merged(id).server;
        if (before === null || sample.deadline > before) {
          write(id, { server: sample.deadline }); adopted = true;
        }
      }
      refresh();
    } finally { updatingClock = false; }
    evaluate();
    return adopted;
  }
  /** 동기 예외도 비동기 실패로 돌려 요청 정리 순서를 지킨다. */
  async function requestServer() { return requestExtend(); }
  /** 같은 탭의 동시 연장은 한 요청을 공유한다. */
  function extend(): Promise<ExtendResult> {
    if (inFlight) return inFlight;
    const id = session.current()?.sessionId;
    if (state.phase === 'inactive' || !id || ended(id)) return Promise.resolve({ kind: 'failed', failure: new RequestFailure({ kind: 'cancelled' }) });
    const generation = session.generation();
    const lifetime = requestLifetime;
    const isCurrent = () => lifetime === requestLifetime && generation === session.generation() && !ended(id);
    write(id, { attempt: Date.now() });
    update({ extending: true });
    const run = (async (): Promise<ExtendResult> => {
      try {
        const sample = await requestServer();
        if (!isCurrent()) return { kind: 'failed', failure: new RequestFailure({ kind: 'cancelled' }) };
        const adopted = sample !== null && applySample(sample, id);
        if (!adopted) return { kind: 'no-deadline' };
        return { kind: state.deadline !== null && state.deadline - now() > policy.warningMs ? 'adopted-active' : 'adopted-warning' };
      } catch (failure) {
        return { kind: 'failed', failure: isCurrent() ? failure : new RequestFailure({ kind: 'cancelled' }) };
      } finally {
        if (lifetime === requestLifetime && generation === session.generation()) {
          inFlight = undefined; update({ extending: false }); tick();
        }
      }
    })();
    inFlight = run;
    return run;
  }
  return {
    /** 저장된 세션 수명에 연결하고 지난 마감을 동기 판정한다. */
    start() {
      if (started) return;
      started = true;
      unsubscribeSession = session.subscribe(onSessionChange, 'cleanup');
      const id = session.current()?.sessionId;
      if (!id) return;
      const off = clock.subscribe(() => undefined); off();
      if (!state.paused && (ended(id) || (merged(id).deadline !== null && merged(id).deadline! <= now()))) {
        update({ sessionId: id });
        session.expireIdle(); return;
      }
      activate(); evaluate();
    },
    /** 앱 연결만 해제하고 이전 요청을 무효화한다. */
    stop() {
      invalidateRequests(); update({ paused: false }); started = false;
      unsubscribeSession?.(); unsubscribeSession = undefined; deactivate();
    },
    observe: (sample) => { applySample(sample); },
    acceptDeadline: (id, sample) => applySample(sample, id),
    /** 프로젝트가 준 임시 시각만 저장한다. */
    setProvisionalDeadline(id, deadline) {
      if (id !== session.current()?.sessionId || ended(id) || !Number.isFinite(deadline) || merged(id).server !== null) return;
      write(id, { local: { deadline, kind: 'provisional', baseServer: null, at: now() } });
      refresh(); evaluate();
    },
    extend,
    /** 탭의 경고·만료를 멈추고 대표를 반납한다. */
    pause() {
      if (resuming) pauseRequested = true;
      update({ paused: true, phase: state.phase === 'warning' ? 'active' : state.phase });
      dropLeader();
    },
    /** 서버 확인 뒤 현재 수명에 유효한 실패에만 프로젝트 유예를 적용한다. */
    resume(options = {}) {
      pauseRequested = false;
      if (resuming) return resuming;
      if (!state.paused) return Promise.resolve({ kind: 'no-deadline' });
      if (state.phase === 'inactive') { update({ paused: false }); return Promise.resolve({ kind: 'no-deadline' }); }
      const lifetime = requestLifetime;
      const generation = session.generation();
      const resumeId = session.current()!.sessionId;
      const serverBefore = merged(resumeId).server;
      const run = (async () => {
        const result = await extend();
        if (lifetime !== requestLifetime || generation !== session.generation()) return result;
        resuming = undefined;
        if (pauseRequested) { pauseRequested = false; return result; }
        refresh();
        if (state.phase === 'inactive') return result;
        const rest = state.deadline === null ? null : state.deadline - now();
        if (rest === null || rest <= 0) {
          const cancelled = result.kind === 'failed' && isRequestFailure(result.failure) && result.failure.kind === 'cancelled';
          if (result.kind === 'failed' && rejectsSession(result.failure)) { session.expireIdle(); return result; }
          const id = session.current()?.sessionId;
          const transient = result.kind === 'failed' || result.kind === 'no-deadline';
          if (transient && !cancelled && id && !ended(id) && merged(id).server === serverBefore && options.graceMs !== undefined && options.graceMs > 0) {
            write(id, { local: { kind: 'grace', deadline: now() + options.graceMs, baseServer: merged(id).server, at: now() } });
            refresh();
          }
        }
        update({ paused: false });
        if (detach) { takeLeader(); evaluate(); }
        return result;
      })();
      resuming = run;
      return run;
    },
    remaining: () => state.paused || state.phase === 'inactive' || state.deadline === null ? null : state.deadline - now(),
    lastAttemptAt: () => { const id = session.current()?.sessionId; return id ? merged(id).attempt : null; },
    state: () => state,
    /** 상태 변화 구독을 연결한다. */
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** 매초 표시 구독을 연결한다. */
    subscribeTick(listener) { tickListeners.add(listener); return () => { tickListeners.delete(listener); }; },
  };
}
