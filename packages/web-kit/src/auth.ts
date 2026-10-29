// 로그인 전 코드의 기한과 단일 요청 진행을 관리한다. 서버 요청·화면 이동·문구는 소비자가 소유한다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ServerClock } from './server-clock';

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

export interface AuthChallengeOptions<Result, Resent> extends AuthDeadlines {
  /** 같은 로그인·방식 동안 유지한다. 취소·새 로그인·방식 전환 때 새 값으로 교체한다. */
  readonly scope: unknown;
  readonly clock: ServerClock;
  readonly codeLength: number;
  /** 서버 계정 잠금 등 프로젝트가 판정한 제출 차단이다. */
  readonly blocked?: boolean;
  readonly verify: (code: string) => Promise<Result>;
  readonly onVerified: (result: Result) => void | Promise<void>;
  readonly resend?: () => Promise<Resent>;
  /** 성공한 현재 요청만 호출한다. 새 기한은 이 콜백에서 프로젝트가 갱신한다. */
  readonly onResent?: (result: Resent) => void | Promise<void>;
}

/** 인증 화면 상위에서 사용한다. 메모리에만 보관하며 세션 저장·이동은 유효 응답 콜백에 연결한다. */
export function useAuthChallenge<Result, Resent = void>(options: AuthChallengeOptions<Result, Resent>) {
  const current = useRef(options);
  const active = useRef<object | null>(null);
  const mounted = useRef(true);
  const [pending, setPending] = useState<'verify' | 'resend' | null>(null);
  const [failure, setFailure] = useState<unknown>();
  const [, setTick] = useState(0);
  /** 취소·이동 시작 시 호출하여 늦은 성공·실패가 화면에 들어오지 않게 한다. */
  const invalidate = useCallback(() => {
    active.current = null;
    setPending(null);
    setFailure(undefined);
  }, []);
  useLayoutEffect(() => {
    if (!Object.is(current.current.scope, options.scope)) invalidate();
    current.current = options;
  });
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; active.current = null; };
  }, []);
  useEffect(() => {
    const tick = () => setTick((value) => value + 1);
    const timer = setInterval(tick, 1000);
    const unsubscribe = options.clock.subscribe(tick);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('pageshow', tick);
    return () => {
      clearInterval(timer); unsubscribe();
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('pageshow', tick);
    };
  }, [options.clock]);
  /** 요청 시작부터 결과 적용 완료까지 한 요청만 소유한다. */
  async function run(kind: 'verify' | 'resend', code = ''): Promise<void> {
    const input = current.current;
    const timing = getAuthTiming(input, input.clock.now());
    if (!mounted.current || active.current !== null || input.blocked) return;
    if (kind === 'verify' && (!timing.canSubmit || !isAuthCode(code, input.codeLength))) return;
    if (kind === 'resend' && (!timing.canResend || input.resend === undefined)) return;
    const owner = {};
    active.current = owner;
    setPending(kind); setFailure(undefined);
    const live = () => mounted.current && active.current === owner &&
      Object.is(current.current.scope, input.scope) && !current.current.blocked &&
      !getAuthTiming(current.current, current.current.clock.now()).expired;
    try {
      if (kind === 'verify') {
        const result = await input.verify(code);
        if (live()) await input.onVerified(result);
      } else {
        const result = await input.resend!();
        if (live()) await input.onResent?.(result);
      }
    } catch (error: unknown) {
      if (live()) setFailure(error);
    } finally {
      if (mounted.current && active.current === owner) { active.current = null; setPending(null); }
    }
  }
  const timing = getAuthTiming(options, options.clock.now());
  return { ...timing, pending, failure, invalidate,
    canSubmit: timing.canSubmit && !options.blocked && pending === null,
    canResend: timing.canResend && !options.blocked && pending === null && options.resend !== undefined,
    submit: (code: string) => run('verify', code), resend: () => run('resend') };
}
