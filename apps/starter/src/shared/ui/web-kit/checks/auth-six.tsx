// 검사 전용 여섯 칸 복사본으로, 같은 인증 동작을 독립된 입력 모양에 연결한다.
import { useId, useState } from 'react';
import { isAuthCode } from '@boosterlab/web-kit/auth';
import type { AuthConformanceFormProps as AuthCodeFormProps } from '@boosterlab/web-kit/testing/fixtures';

/** 기한 판정과 제출은 패키지 모델에 연결하고, 입력 모양·문구는 복사본이 맡는다. */
export function SixDigitAuthCodeForm({ model, codeLength, labels }: AuthCodeFormProps) {
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();
  return <form onSubmit={(event) => { event.preventDefault();
    if (!model.canSubmit) return;
    const valid = isAuthCode(code, codeLength);
    setInvalid(!valid);
    if (valid) void model.submit(code); }}>
    <fieldset><legend>{labels.code}</legend>{Array.from({ length: codeLength }, (_, index) =>
      <input key={index} aria-label={`${labels.code} ${index + 1}`} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} inputMode="numeric" maxLength={1}
        value={code[index] ?? ''} onChange={(event) => {
          const next = Array.from({ length: codeLength }, (_, digit) => code[digit] ?? ' ');
          next[index] = event.target.value || ' ';
          setCode(next.join(''));
        }} />)}</fieldset>
    {invalid && <p id={errorId} role="alert">{labels.invalidCode}</p>}
    {model.remainingSeconds !== undefined && <p role="timer">{labels.remaining(model.remainingSeconds)}</p>}
    {(model.expired || model.codeExpired) && <p role="alert">{labels.expired}</p>}
    {model.verifyFailure !== undefined && <p role="alert">{labels.verifyFailure}</p>}
    {model.pending !== null && <p role="status">{labels.pending}</p>}
    <button type="submit" disabled={!model.canSubmit}>{labels.confirm}</button>
    <button type="button" disabled={!model.canResend} onClick={() => { void model.resend(); }}>{labels.resend}</button>
    {model.resendFailure !== undefined && <p role="alert">{labels.resendFailure}</p>}
    {model.resendRemainingSeconds > 0 && <p aria-label="resend-wait">{labels.resendWait(model.resendRemainingSeconds)}</p>}
  </form>;
}
