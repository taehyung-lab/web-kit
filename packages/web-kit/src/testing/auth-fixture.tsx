// 인증 복사본 적합성 검사를 위한 공통 입력·요청·시간 조작 화면이다.
import { useState, type ComponentType } from 'react';
import { useAuthChallenge } from '../auth';
import { createServerClock } from '../server-clock';

export interface AuthConformanceFormProps {
  readonly model: ReturnType<typeof useAuthChallenge>;
  readonly codeLength: number;
  readonly labels: { readonly code: string; readonly confirm: string; readonly resend: string;
    readonly expired: string; readonly pending: string; readonly verifyFailure: string; readonly resendFailure: string; readonly invalidCode: string;
    readonly remaining: (seconds: number) => string; readonly resendWait: (seconds: number) => string };
}

/** 실제 복사본을 꽂으며, 요청 결과와 기한 변경은 눈에 보이는 출력으로 검증한다. */
export function createAuthConformancePage(Form: ComponentType<AuthConformanceFormProps>) {
  /** 테스트 버튼은 서버 응답·로그인 방식 전환·시계 보정을 대신한다. */
  return function AuthConformancePage() {
    const [clock] = useState(() => createServerClock({ key: 'auth-conformance', storage: () => ({
      getItem: () => null, setItem: () => undefined,
    }) as unknown as Storage }));
    const [scope, setScope] = useState(0);
    const [deadlines, setDeadlines] = useState(() => ({ expiresAt: undefined as number | undefined, codeExpiresAt: clock.now() + 5000, resendAvailableAt: clock.now() + 3000 }));
    const [requests, setRequests] = useState(0);
    const [resends, setResends] = useState(0);
    const [applied, setApplied] = useState('');
    const [response, setResponse] = useState<{ resolve: () => void; reject: () => void }>();
    const model = useAuthChallenge({ scope, clock, ...deadlines, codeLength: 6,
      verify: (code) => {
        setRequests((count) => count + 1);
        return new Promise<string>((resolve, reject) => setResponse({ resolve: () => resolve(code), reject: () => reject(new Error('rejected')) }));
      },
      onVerified: (code) => { setApplied(code); },
      resend: () => {
        setResends((count) => count + 1);
        return new Promise<void>((resolve, reject) => setResponse({ resolve, reject: () => reject(new Error('rejected')) }));
      },
      onResent: () => { setDeadlines((previous) => ({ ...previous, codeExpiresAt: clock.now() + 5000, resendAvailableAt: clock.now() + 3000 })); },
    });
    return <>
      <Form model={model} codeLength={6} labels={{ code: '코드', confirm: '확인', resend: '재전송', expired: '만료됨', pending: '진행 중', verifyFailure: '확인 실패', resendFailure: '재전송 실패', invalidCode: '숫자 6자리를 입력하세요', remaining: (value) => `남은 시간 ${value}`, resendWait: (value) => `대기 ${value}` }} />
      <output aria-label="요청 횟수">{requests}</output><output aria-label="재전송 횟수">{resends}</output>
      <output aria-label="적용 코드">{applied}</output>
      <button onClick={() => response?.resolve()}>응답 성공</button>
      <button onClick={() => response?.reject()}>응답 실패</button>
      <button onClick={() => { model.invalidate(); setScope((value) => value + 1); }}>방식 전환</button>
      <button onClick={() => setDeadlines((previous) => ({ ...previous, expiresAt: clock.now(), codeExpiresAt: clock.now() + 5000, resendAvailableAt: clock.now() }))}>전체 기한 경과</button>
      <button onClick={() => clock.observe(6000)}>시간 경과</button>
    </>;
  };
}
