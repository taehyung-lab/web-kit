// 로그인 전 코드의 기한과 단일 요청 진행을 관리한다. 서버 요청·화면 이동·문구는 소비자가 소유한다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ServerClock } from './server-clock';
import type { CompletionStep } from './completion';
export type { CompletionStep } from './completion';

export interface AuthDeadlines {
  readonly expiresAt?: number;
  readonly codeExpiresAt?: number;
  readonly resendAvailableAt?: number;
}

/** 절대 시각을 남은 초로 바꾸며, 기한이 없으면 시간 정책을 적용하지 않는다. */
export function remainingAuthSeconds(expiresAt: number | undefined, now: number): number | undefined {
  return expiresAt === undefined ? undefined : Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

/** 로그인 전체 기한과 코드 기한, 재전송 대기를 서로 독립적으로 계산한다. */
export function getAuthTiming(deadlines: AuthDeadlines, now: number) {
  const remainingSeconds = remainingAuthSeconds(deadlines.codeExpiresAt, now);
  const challengeRemainingSeconds = remainingAuthSeconds(deadlines.expiresAt, now);
  const resendRemainingSeconds = remainingAuthSeconds(deadlines.resendAvailableAt, now) ?? 0;
  const expired = challengeRemainingSeconds === 0;
  return { remainingSeconds, challengeRemainingSeconds, resendRemainingSeconds, expired,
    codeExpired: remainingSeconds === 0,
    canSubmit: !expired && remainingSeconds !== 0,
    canResend: !expired && resendRemainingSeconds === 0 };
}

/** 프로젝트가 정한 자리수의 숫자만 서버에 보낸다. */
export function isAuthCode(code: string, length: number): boolean {
  return Number.isInteger(length) && length > 0 && code.length === length && /^\d+$/.test(code);
}

/** 저장된 인증 대기. `scope`는 같은 로그인 동안(새로 고침 포함) 같고 새 로그인마다 새 값이다. */
export interface StoredAuthChallenge<Data> extends AuthDeadlines {
  readonly scope: string;
  readonly data: Data;
}

export interface AuthChallengeStoreOptions<Data> {
  readonly key: string;
  /** 저장된 값이 이 프로젝트의 형식인지 확인하여 돌려주고, 아니면 null. 비밀번호·토큰은 담지 않는다. */
  readonly parse: (value: unknown) => Data | null;
  /** 기본은 탭 저장소(sessionStorage): 새로 고침은 잇고, 탭을 닫으면 사라지며 다른 탭과 섞이지 않는다. */
  readonly storage?: () => Storage;
}

const DEADLINE_KEYS = ['expiresAt', 'codeExpiresAt', 'resendAvailableAt'] as const;

function deadlinesOf(value: Record<string, unknown>): AuthDeadlines | null {
  const deadlines: Record<string, number> = {};
  for (const key of DEADLINE_KEYS) {
    const item = value[key];
    if (item === undefined) continue;
    if (typeof item !== 'number' || !Number.isFinite(item)) return null;
    deadlines[key] = item;
  }
  return deadlines;
}

/**
 * 로그인 성공 전 인증 대기를 보관한다. 새로 고침해도 같은 `scope`와 절대 기한으로 이어 가며,
 * 기한이 지난 대기도 그대로 돌려준다(화면은 만료 안내와 막힌 확인 버튼을 보인다). 지우는 것은 취소·성공·새 로그인이다.
 */
export function createAuthChallengeStore<Data>({ key, parse, storage = () => sessionStorage }: AuthChallengeStoreOptions<Data>) {
  function read(): StoredAuthChallenge<Data> | null {
    try {
      const raw = storage().getItem(key);
      const value: unknown = raw === null ? null : JSON.parse(raw);
      if (typeof value !== 'object' || value === null) return null;
      const record = value as Record<string, unknown>;
      if (typeof record.scope !== 'string') return null;
      const deadlines = deadlinesOf(record);
      const data = parse(record.data);
      if (deadlines === null || data === null) return null;
      return { ...deadlines, scope: record.scope, data };
    } catch {
      return null;
    }
  }
  function write(value: StoredAuthChallenge<Data> | null): void {
    try {
      if (value === null) storage().removeItem(key);
      else storage().setItem(key, JSON.stringify(value));
    } catch {
      // 저장하지 못하면 이 화면은 이어지고 새로 고침 뒤에는 로그인부터 다시 한다.
    }
  }
  return {
    /** 새 로그인: 새 `scope`와 새 기한으로 교체한다. */
    start(data: Data, deadlines: AuthDeadlines): StoredAuthChallenge<Data> {
      const challenge = { ...deadlines, scope: crypto.randomUUID(), data };
      write(challenge);
      return challenge;
    },
    current: read,
    /** 재전송 성공 등으로 기한만 바꾼다. `scope`는 유지한다. */
    update(deadlines: AuthDeadlines): StoredAuthChallenge<Data> | null {
      const challenge = read();
      if (challenge === null) return null;
      const next = { ...challenge, ...deadlines };
      write(next);
      return next;
    },
    clear(): void { write(null); },
  };
}

export type AuthChallengeStore<Data> = ReturnType<typeof createAuthChallengeStore<Data>>;

export interface AuthChallengeOptions<Result, Resent> extends AuthDeadlines {
  /** 같은 로그인·방식 동안 유지한다. 취소·새 로그인·방식 전환 때 새 값으로 교체한다. */
  readonly scope: unknown;
  readonly clock: ServerClock;
  readonly codeLength: number;
  /** 서버 계정 잠금 등 프로젝트가 판정한 제출 차단이다. */
  readonly blocked?: boolean;
  readonly verify: (code: string) => Promise<Result>;
  /**
   * 추가 await 뒤의 효과는 step.isCurrent()로 현재 시도인지 확인한다. 이 콜백이 실패하면 확인 성공 결과를 보관하고,
   * 다음 제출은 코드를 다시 보내지 않고 이 콜백만 다시 실행한다(서버가 쓴 코드를 거절하는 것을 피한다).
   * 다시 시도할 수 없는 결과면 필요한 정리·이동을 마치고 정상 반환한다.
   */
  readonly onVerified: (result: Result, step: CompletionStep) => void | Promise<void>;
  readonly resend?: () => Promise<Resent>;
  /** 성공한 현재 요청만 호출한다. 새 기한은 이 콜백에서 프로젝트가 갱신한다. */
  readonly onResent?: (result: Resent, step: CompletionStep) => void | Promise<void>;
}

/** 인증 화면 상위에서 사용한다. 인증 대기는 `createAuthChallengeStore`에서 읽어 넘기고, 세션 저장·이동은 유효 응답 콜백에 연결한다. */
export function useAuthChallenge<Result, Resent = void>(options: AuthChallengeOptions<Result, Resent>) {
  const current = useRef(options);
  const active = useRef<{ verify: object | null; resend: object | null }>({
    verify: null,
    resend: null,
  });
  const mounted = useRef(true);
  /** 확인 성공 결과는 완료가 끝날 때까지 보관한다. 완료 실패 뒤 재시도에는 코드를 다시 보내지 않는다. */
  const verified = useRef<{ readonly scope: unknown; readonly result: Result } | null>(null);
  const [awaitingCompletion, setAwaitingCompletion] = useState(false);
  const [running, setRunning] = useState({ verify: false, resend: false });
  const [failures, setFailures] = useState<{ verify: unknown; resend: unknown }>({
    verify: undefined,
    resend: undefined,
  });
  const [, setTick] = useState(0);

  /** 취소·이동 시작 시 예전 요청과 보관한 확인 결과를 무효화한다. */
  const invalidate = useCallback(() => {
    active.current = { verify: null, resend: null };
    verified.current = null;
    setAwaitingCompletion(false);
    setRunning({ verify: false, resend: false });
    setFailures({ verify: undefined, resend: undefined });
  }, []);

  useLayoutEffect(() => {
    if (!Object.is(current.current.scope, options.scope)) invalidate();
    current.current = options;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current = { verify: null, resend: null };
      verified.current = null;
    };
  }, []);

  useEffect(() => {
    const tick = () => setTick((value) => value + 1);
    const timer = setInterval(tick, 1000);
    const unsubscribe = options.clock.subscribe(tick);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('pageshow', tick);
    return () => {
      clearInterval(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('pageshow', tick);
    };
  }, [options.clock]);

  /** 확인과 재전송은 각각 요청 시작부터 성공 후 처리 완료까지 한 번만 실행한다. */
  async function run(kind: 'verify' | 'resend', code = ''): Promise<void> {
    const input = current.current;
    const timing = getAuthTiming(input, input.clock.now());
    if (!mounted.current || active.current[kind] !== null || input.blocked) return;

    const accepted = verified.current;
    const retry = kind === 'verify' && accepted !== null && Object.is(accepted.scope, input.scope)
      ? accepted
      : null;
    if (kind === 'verify') {
      // 완료만 다시 할 때는 코드가 필요 없으므로 전체 기한만 확인한다.
      if (retry !== null) {
        if (timing.expired) return;
      } else if (!timing.canSubmit || !isAuthCode(code, input.codeLength)) {
        return;
      }
    } else if (!timing.canResend || input.resend === undefined) {
      return;
    }

    // 요청마다 다른 표식을 써서 옛 요청이 새 요청의 결과·진행 상태를 바꾸지 못하게 한다.
    const owner = {};
    active.current[kind] = owner;
    setRunning((previous) => ({ ...previous, [kind]: true }));
    setFailures((previous) => ({ ...previous, [kind]: undefined }));

    const isCurrent = () => {
      const latest = current.current;
      return mounted.current && active.current[kind] === owner &&
        Object.is(latest.scope, input.scope) && !latest.blocked &&
        !getAuthTiming(latest, latest.clock.now()).expired;
    };

    try {
      if (kind === 'verify') {
        const result = retry === null ? await input.verify(code) : retry.result;
        if (!isCurrent()) return;
        verified.current = { scope: input.scope, result };
        await input.onVerified(result, { isCurrent });
        if (isCurrent()) {
          verified.current = null;
          setAwaitingCompletion(false);
        }
      } else {
        const result = await input.resend!();
        if (isCurrent()) await input.onResent?.(result, { isCurrent });
      }
    } catch (error: unknown) {
      if (isCurrent()) {
        setFailures((previous) => ({ ...previous, [kind]: error }));
        if (kind === 'verify') setAwaitingCompletion(verified.current !== null);
      }
    } finally {
      if (mounted.current && active.current[kind] === owner) {
        active.current[kind] = null;
        setRunning((previous) => ({ ...previous, [kind]: false }));
      }
    }
  }

  const timing = getAuthTiming(options, options.clock.now());
  const canVerify = awaitingCompletion ? !timing.expired : timing.canSubmit;
  const pending = running.verify
    ? (running.resend ? 'both' : 'verify')
    : (running.resend ? 'resend' : null);
  return {
    ...timing,
    pending,
    verifyFailure: failures.verify,
    resendFailure: failures.resend,
    invalidate,
    /** 재전송 함수가 없는 방식에서는 화면도 재전송 버튼을 그리지 않는다. */
    resendable: options.resend !== undefined,
    /** 확인은 성공했고 완료가 실패해 다음 제출이 완료만 다시 실행한다. */
    awaitingCompletion,
    canSubmit: canVerify && !options.blocked && !running.verify,
    canResend: timing.canResend && !options.blocked && !running.resend && options.resend !== undefined,
    submit: (code: string) => run('verify', code),
    resend: () => run('resend'),
  };
}
