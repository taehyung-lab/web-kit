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
    for (const code of ['12', 'abcdef']) {
      enterCode(code); await click('확인');
      expect(screen.getByLabelText('요청 횟수').textContent).toBe('0');
      expect(screen.getByRole('alert').textContent).toBe('숫자 6자리를 입력하세요');
      for (const input of screen.getAllByRole('textbox')) {
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe('숫자 6자리를 입력하세요');
      }
    }
    enterCode('123456');
    await click('확인'); await click('확인');
    expect(screen.getByLabelText('요청 횟수').textContent).toBe('1');
    expect(screen.getByText('진행 중')).toBeTruthy();
    await click('방식 전환'); await click('응답 성공');
    expect(screen.getByLabelText('적용 코드').textContent).toBe('');
    await click('확인'); await click('응답 실패');
    expect(screen.getByRole('alert').textContent).toBe('확인 실패');
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
    await click('전체 기한 경과');
    expect(screen.getByRole('timer').textContent).toBe('남은 시간 5');
    expect(screen.getByText('만료됨')).toBeTruthy();
    expect((screen.getByRole('button', { name: '확인' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '재전송' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it(conformanceTitle('auth-concurrency', target, '확인·재전송은 서로 막지 않고 같은 종류만 막는다'), async () => {
    for (const first of ['확인', '재전송']) {
      const view = render(<Page />);
      await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
      enterCode('123456');
      const second = first === '확인' ? '재전송' : '확인';
      await click(first);
      expect((screen.getByRole('button', { name: second }) as HTMLButtonElement).disabled).toBe(false);
      await click(second); await click(first); await click(second);
      expect(screen.getByLabelText('요청 횟수').textContent).toBe('1');
      expect(screen.getByLabelText('재전송 횟수').textContent).toBe('1');
      view.unmount();
    }
  });

  it(conformanceTitle('auth-failures', target, '다른 종류 요청은 기존 실패 안내를 지우지 않는다'), async () => {
    render(<Page />);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    enterCode('123456');
    await click('확인'); await click('응답 실패');
    expect(screen.getByText('확인 실패')).toBeTruthy();
    await click('재전송');
    expect(screen.getByText('확인 실패')).toBeTruthy();
    await click('응답 성공');
    expect(screen.getByText('확인 실패')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await click('재전송'); await click('응답 실패');
    expect(screen.getByText('확인 실패')).toBeTruthy();
    expect(screen.getByText('재전송 실패')).toBeTruthy();
    await click('확인');
    expect(screen.queryByText('확인 실패')).toBeNull();
    expect(screen.getByText('재전송 실패')).toBeTruthy();
    await click('응답 실패');
    await click('재전송');
    expect(screen.getByText('확인 실패')).toBeTruthy();
    expect(screen.queryByText('재전송 실패')).toBeNull();
    await click('응답 실패');
    await click('확인'); await click('응답 성공');
    expect(screen.queryByText('확인 실패')).toBeNull();
    expect(screen.getByText('재전송 실패')).toBeTruthy();
  });

}
