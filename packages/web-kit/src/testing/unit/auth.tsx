// 입력 개수 대신 소비자가 제공한 입력 행동으로 인증 복사본의 결과를 검사한다.
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { createAuthConformancePage, type AuthConformanceFormProps } from '../auth-fixture';
import { conformanceTitle, type ConformanceTarget } from '../target.mjs';

/** 입력 조작만 복사본이 연결하고 기한·진행·요청·오류에 대한 기대는 키트가 소유한다. */
export function checkAuthConformance({ Form, enterCode, readCode }: {
  readonly Form: ComponentType<AuthConformanceFormProps>;
  readonly enterCode: (code: string) => void;
  readonly readCode: () => string;
}, target: ConformanceTarget) {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100000); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  const Page = createAuthConformancePage(Form);
  /** 서버 응답까지 기다리는 버튼 행동이다. */
  const click = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole('button', { name })); }); };
  it(conformanceTitle('auth-unit', target, '시간·만료 제출 차단·재전송·응답 격리'), async () => {
    render(<Page />);
    expect(screen.getByRole('timer').textContent).toBe('남은 시간 5');
    expect((screen.getByRole('button', { name: '재전송' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText('resend-wait').textContent).toBe('대기 3');
    enterCode('123456');
    await click('확인'); await click('확인');
    expect(screen.getByLabelText('요청 횟수').textContent).toBe('1');
    expect(screen.getByText('진행 중')).toBeTruthy();
    await click('방식 전환'); await click('응답 성공');
    expect(screen.getByLabelText('적용 코드').textContent).toBe('');
    await click('확인'); await click('응답 실패');
    expect(screen.getByRole('alert').textContent).toBe('실패함');
    await click('확인'); await click('응답 성공');
    expect(screen.getByLabelText('적용 코드').textContent).toBe('123456');
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByRole('timer').textContent).toBe('남은 시간 0');
    expect(screen.getByText('만료됨')).toBeTruthy();
    enterCode('654321'); expect(readCode()).toBe('654321');
    await click('확인'); expect(screen.getByLabelText('요청 횟수').textContent).toBe('3');
    await click('재전송'); await click('응답 실패');
    expect(screen.getByRole('timer').textContent).toBe('남은 시간 0');
    await click('재전송'); await click('재전송'); await click('응답 성공');
    expect(screen.getByLabelText('재전송 횟수').textContent).toBe('2');
    expect(screen.getByRole('timer').textContent).toBe('남은 시간 5');
    expect((screen.getByRole('button', { name: '재전송' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText('resend-wait').textContent).toBe('대기 3');
  });
}
