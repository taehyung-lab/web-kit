// 파일 책임: 작은 표현 항목의 속성·포커스·오류 연결 적합성을 실제 복사본에서 검사한다.
import { afterEach, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { checkConfirmDialogAdapter, checkRetryFocusAdapter, type RetryAdapterProps } from '../adapters';
import { conformanceTitle, type ConformanceTarget } from '../target.mjs';
import { dialogDefaultsWrapper, type DialogDefaultsParts } from '../copy-defaults';
import type * as Inputs from '../contracts/ui/inputs';
import type * as Dialog from '../contracts/ui/dialog';
import type * as Retry from '../contracts/ui/retry';
import type * as PendingContract from '../contracts/ui/pending';
import type * as Filter from '../contracts/search/filter-error';
/** 확인창의 처음 초점과 저장 중 재실행·닫기 차단을 검사한다. */
export function checkDialogConformance({ ConfirmDialog, ...copy }: { ConfirmDialog: typeof Dialog.ConfirmDialog } & DialogDefaultsParts, target: ConformanceTarget) {
  const Root = dialogDefaultsWrapper(copy);
  afterEach(cleanup);
  it(conformanceTitle('dialog-unit', target, '확인창 진입과 저장 관문'), async () => {
    const view = render(<ConfirmDialog open title="확인" onConfirm={() => undefined} onCancel={() => undefined} />, { wrapper: Root });
    expect(screen.getByRole('alertdialog').contains(document.activeElement)).toBe(true);
    view.unmount();
    await checkConfirmDialogAdapter((props) => <Root><ConfirmDialog {...props} title="확인" /></Root>, { confirm: '확인', cancel: '취소' });
  });
  // 2026-11-05 사용자 결정: 대화창 버튼 문구는 앱 맨 위 DialogDefaults 한 곳에서 받고, 공급이 없으면 바로 오류로 알린다.
  it(conformanceTitle('dialog-defaults', target, '확인창 버튼·진행 문구는 앱 공급을 쓰고 화면 값이 그 창에서만 앞서며, 공급이 없으면 오류'), () => {
    const labels = { close: 'Close', confirm: 'Proceed', cancel: 'Dismiss', pending: 'Working' };
    const English = ({ children }: { readonly children: ReactNode }) => <copy.DialogDefaults labels={labels}>{children}</copy.DialogDefaults>;
    const view = render(<ConfirmDialog open pending title="Delete?" onConfirm={() => undefined} onCancel={() => undefined} />, { wrapper: English });
    expect(screen.getByRole('button', { name: 'Proceed' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Working');
    expect(document.body.textContent).not.toMatch(/[가-힣]/);
    view.rerender(<ConfirmDialog open title="Delete?" cancelLabel="Keep" onConfirm={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Keep' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Proceed' })).toBeTruthy();
    view.unmount();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => render(<ConfirmDialog open title="Delete?" onConfirm={() => undefined} onCancel={() => undefined} />)).toThrow(/DialogDefaults/);
    } finally {
      errors.mockRestore();
    }
  });
}
/** 재시도 버튼이 없어질 때의 초점과 외부 초점 보존을 검사한다. */
export function checkRetryConformance({ RetryRegion }: { RetryRegion: typeof Retry.RetryRegion }, target: ConformanceTarget) {
  afterEach(cleanup);
  it(conformanceTitle('retry-unit', target, '재시도 초점 복원'), async () => {
    await checkRetryFocusAdapter((props: RetryAdapterProps) => <RetryRegion {...props}><input id={props.controlId} /></RetryRegion>);
  });
}
/** 기본 버튼의 암묵 제출 방지와 입력·체크 속성을 검사한다. */
export function checkInputsConformance({ Button, Input, Checkbox }: Pick<typeof Inputs, 'Button' | 'Input' | 'Checkbox'>, target: ConformanceTarget) {
  afterEach(cleanup);
  it(conformanceTitle('inputs-unit', target, '기본 type과 입력 접근성 속성'), () => {
    render(<><Button>작업</Button><Input aria-label="입력" required disabled /><Checkbox aria-label="체크" indeterminate /></>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
    expect(screen.getByRole('textbox').hasAttribute('required')).toBe(true);
    expect(screen.getByRole('textbox').hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('mixed');
  });
}
/** 진행 문구가 상태 영역에 전달되는지 검사한다. */
export function checkPendingConformance({ Pending }: { Pending: typeof PendingContract.Pending }, target: ConformanceTarget) {
  afterEach(cleanup);
  it(conformanceTitle('pending-unit', target, '진행 문구 상태 영역'), () => {
    render(<Pending label="실행 중" />); expect(screen.getByRole('status').textContent).toContain('실행 중');
  });
}
/** 오류 참조 대상이 표시되고 해제되면 제거되는지 검사한다. */
export function checkFilterErrorConformance({ FilterError }: { FilterError: typeof Filter.FilterError }, target: ConformanceTarget) {
  afterEach(cleanup);
  it(conformanceTitle('filter-error-unit', target, '오류 대상 표시와 해제'), () => {
    const view = render(<FilterError id="error" message="오류" />);
    expect(screen.getByRole('alert').id).toBe('error');
    view.rerender(<FilterError id="error" />); expect(screen.queryByRole('alert')).toBeNull();
  });
}
