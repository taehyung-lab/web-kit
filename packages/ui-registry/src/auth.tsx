// 프로젝트가 복사해 소유하는 인증 코드 입력·남은 시간·만료·재전송 화면이다.
import { useId, useState } from 'react';
import { isAuthCode, type useAuthChallenge } from '@boosterlab/web-kit/auth';

export interface AuthCodeFormProps {
  readonly model: ReturnType<typeof useAuthChallenge>;
  readonly codeLength: number;
  readonly labels: { readonly code: string; readonly confirm: string; readonly resend: string;
    readonly expired: string; readonly pending: string; readonly failure: string; readonly invalidCode: string;
    readonly remaining: (seconds: number) => string; readonly resendWait: (seconds: number) => string };
}

/** 기한 판정과 제출은 패키지 모델에 연결하고, 입력 모양·문구는 복사본이 맡는다. */
export function AuthCodeForm({ model, codeLength, labels }: AuthCodeFormProps) {
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();
  return <form onSubmit={(event) => { event.preventDefault();
    if (!model.canSubmit) return;
    const valid = isAuthCode(code, codeLength);
    setInvalid(!valid);
    if (valid) void model.submit(code); }}>
    <label>{labels.code}<input aria-label={labels.code} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} inputMode="numeric" autoComplete="one-time-code"
      maxLength={codeLength} value={code} onChange={(event) => setCode(event.target.value)} /></label>
    {invalid && <p id={errorId} role="alert">{labels.invalidCode}</p>}
    {model.remainingSeconds !== undefined && <p role="timer">{labels.remaining(model.remainingSeconds)}</p>}
    {(model.expired || model.codeExpired) && <p role="alert">{labels.expired}</p>}
    {model.failure !== undefined && <p role="alert">{labels.failure}</p>}
    {model.pending !== null && <p role="status">{labels.pending}</p>}
    <button type="submit" disabled={!model.canSubmit}>{labels.confirm}</button>
    <button type="button" disabled={!model.canResend} onClick={() => { void model.resend(); }}>{labels.resend}</button>
    {model.resendRemainingSeconds > 0 && <p aria-label="resend-wait">{labels.resendWait(model.resendRemainingSeconds)}</p>}
  </form>;
}
