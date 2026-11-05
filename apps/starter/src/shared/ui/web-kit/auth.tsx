// 프로젝트가 복사해 소유하는 인증 코드 입력·남은 시간·만료·재전송 화면이다.
// 입력·버튼 모양은 프로젝트의 shadcn 기본 부품이 정하고, 여기서는 모델 연결과 배치만 맡는다.
import { useId, useState } from 'react';
import { isAuthCode, type useAuthChallenge } from '@boosterlab/web-kit/auth';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

export interface AuthCodeFormProps {
  readonly model: ReturnType<typeof useAuthChallenge>;
  readonly codeLength: number;
  readonly labels: { readonly code: string; readonly confirm: string; readonly resend: string;
    readonly expired: string; readonly pending: string; readonly verifyFailure: string; readonly resendFailure: string; readonly invalidCode: string;
    readonly remaining: (seconds: number) => string; readonly resendWait: (seconds: number) => string };
}

/** 기한 판정과 제출은 패키지 모델에 연결하고, 입력 모양·문구는 복사본이 맡는다. */
export function AuthCodeForm({ model, codeLength, labels }: AuthCodeFormProps) {
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();
  return <form className="grid gap-3" onSubmit={(event) => { event.preventDefault();
    if (!model.canSubmit) return;
    const valid = isAuthCode(code, codeLength);
    setInvalid(!valid);
    if (valid) void model.submit(code); }}>
    <Label className="grid gap-2">{labels.code}<Input aria-label={labels.code} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} inputMode="numeric" autoComplete="one-time-code"
      maxLength={codeLength} value={code} onChange={(event) => setCode(event.target.value)} /></Label>
    {invalid && <p id={errorId} role="alert" className="text-sm text-destructive">{labels.invalidCode}</p>}
    {model.remainingSeconds !== undefined && <p role="timer" className="text-sm text-muted-foreground">{labels.remaining(model.remainingSeconds)}</p>}
    {(model.expired || model.codeExpired) && <p role="alert" className="text-sm text-destructive">{labels.expired}</p>}
    {model.verifyFailure !== undefined && <p role="alert" className="text-sm text-destructive">{labels.verifyFailure}</p>}
    {model.pending !== null && <p role="status" className="text-sm text-muted-foreground">{labels.pending}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" disabled={!model.canSubmit}>{labels.confirm}</Button>
      {model.resendable && <Button type="button" variant="outline" disabled={!model.canResend} onClick={() => { void model.resend(); }}>{labels.resend}</Button>}
    </div>
    {model.resendFailure !== undefined && <p role="alert" className="text-sm text-destructive">{labels.resendFailure}</p>}
    {model.resendRemainingSeconds > 0 && <p aria-label="resend-wait" className="text-sm text-muted-foreground">{labels.resendWait(model.resendRemainingSeconds)}</p>}
  </form>;
}
