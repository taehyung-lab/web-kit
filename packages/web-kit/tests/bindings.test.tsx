// @vitest-environment jsdom
// 파일 책임: 공개 연결 hook을 실제 요소와 연결해 포커스·잠금·요청·목록 동등성을 검사한다.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ListProvider, useListModel, useList, type ListModel } from '../src/list';
import { List, type ListColumn } from '../src/list-ui';
import { defineSearch } from '../src/search';
import { useDialogBinding, useConfirmBinding, useAcknowledgeBinding, useBlockingProgressBinding, BlockingRegistryContext, useBlockingProgress } from '../src/form/confirmation';
import { useRetryFocus } from '../src/record';
import { useOptionsRetryFocus, useFormRootBinding, useFormFieldBinding, useSaveForm, applyFormText } from '../src/form';
import { CheckboxTree } from '../src/CheckboxTree';

afterEach(cleanup);

/** 모델 전달만 바꾼 동일한 목록 화면. */
function ListScreen({ mode, children }: { mode: 'context' | 'props'; children?: ReactNode }) {
  const definition = defineSearch({ fields: {
    q: { schema: z.string(), default: '' }, page: { schema: z.number(), default: 1 }, size: { schema: z.number(), default: 1 },
    sort: { schema: z.string(), default: 'id' }, order: { schema: z.enum(['asc', 'desc']), default: 'asc' },
    from: { schema: z.string(), default: undefined }, to: { schema: z.string(), default: undefined },
  } });
  const [url, navigate] = useState(() => definition.validateSearch({}));
  const list = useList({ definition, search: url, navigate: (next) => {
      navigate(next);
      window.history.replaceState(null, '', '?' + new URLSearchParams(Object.entries(next).map(([key, value]) => [key, String(value)])));
    }, rowId: (row: { id: string }) => row.id,
    query: (search) => ({ queryKey: ['bindings-list', search], queryFn: async () => ({ rows: [{ id: String(search.page) }], total: 3 }) }),
  });
  const props = mode === 'props' ? { model: list } : {};
  const columns: readonly ListColumn<{ id: string }>[] = [{ key: 'id', header: '번호', cell: (row) => row.id }];
  const body = <>
    <List.Filter {...props}><List.Text {...props} name="q" label="검색어" /><List.FilterActions {...props} /></List.Filter>
    <List.Table {...props} columns={columns} rowId={(row) => row.id} selectable />
    <List.Pagination {...props} />
    <output data-testid="url">{JSON.stringify(url)}</output><output data-testid="selection">{list.selection.selectedIds.join(',')}</output>
    {children}
  </>;
  return mode === 'context' ? <ListProvider model={list}>{body}</ListProvider> : body;
}

it('R3 context·props 조립의 URL·선택·페이지 결과가 같다', async () => {
  const results: unknown[] = [];
  const addresses: string[] = [];
  for (const mode of ['context', 'props'] as const) {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><ListScreen mode={mode} /></QueryClientProvider>);
    await screen.findByRole('checkbox', { name: '행 선택' });
    fireEvent.change(screen.getByLabelText('검색어'), { target: { value: 'same' } });
    fireEvent.click(screen.getByText('검색', { selector: 'button' }));
    await waitFor(() => expect(screen.getByTestId('url').textContent).toContain('same'));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: '행 선택' }).getAttribute('data-disabled')).toBeNull());
    fireEvent.click(screen.getByRole('checkbox', { name: '행 선택' }));
    const selected = screen.getByTestId('selection').textContent;
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() => expect(screen.getByRole('cell', { name: '2' }).textContent).toBe('2'));
    addresses.push(window.location.search);
    results.push([screen.getByTestId('url').textContent, selected, screen.getByRole('cell', { name: '2' }).textContent, screen.getByRole('button', { name: '2' }).getAttribute('aria-current')]);
    cleanup(); client.clear();
  }
  expect(addresses).toEqual(['?q=same&page=2', '?q=same&page=2']);
  expect(results[0]).toEqual(results[1]);
  expect(results[0]).toEqual([expect.stringContaining('"page":2'), '1', '2', 'page']);
});

/** 필요한 모델만 만드는 기간 검사 화면. */
function PeriodScreen({ fixed = false }: { fixed?: boolean }) {
  const [draft, patch] = useState({});
  const model = { draft, issues: [], patchDraft: (next: object) => patch((old) => ({ ...old, ...next })) } as unknown as ListModel;
  return <List.Period model={model} from="from" to="to" label="기간"
    {...(fixed ? { timeZone: 'America/Los_Angeles', now: () => new Date('2026-01-01T01:00:00Z'), presets: [{ label: '오늘', value: { unit: 'day' as const, amount: 0 } }] } : {})} />;
}
it('기간은 단축·시간대·시계를 생략해도 직접 입력한다', () => {
  render(<PeriodScreen />);
  fireEvent.change(screen.getByLabelText('기간 시작'), { target: { value: '2026-05-02' } });
  expect((screen.getByLabelText('기간 시작') as HTMLInputElement).value).toBe('2026-05-02');
});
it('기간 단축은 전달된 시각과 시간대의 날짜를 사용한다', () => {
  render(<PeriodScreen fixed />);
  fireEvent.click(screen.getByText('오늘'));
  expect((screen.getByLabelText('기간 시작') as HTMLInputElement).value).toBe('2025-12-31');
  expect((screen.getByLabelText('기간 종료') as HTMLInputElement).value).toBe('2025-12-31');
});
it('명시 model은 context보다 우선하고 없으면 명확히 실패한다', () => {
  function Reader({ model }: { model?: ListModel }) { return <output>{useListModel(model).total}</output>; }
  render(<ListProvider model={{ total: 1 } as ListModel}><Reader model={{ total: 2 } as ListModel} /></ListProvider>);
  expect(screen.getByRole('status').textContent).toBe('2');
  cleanup();
  expect(() => render(<Reader />)).toThrow('model prop or <ListProvider model>');
});

it('대화창 binding은 마운트 즉시 내부 포커스와 Escape 차단을 연결한다', () => {
  const close = vi.fn();
  function Popup() {
    const binding = useDialogBinding({ open: true, closable: false, onClose: close });
    return <div role="dialog" ref={binding.popupRef} tabIndex={binding.popupProps.tabIndex} onKeyDown={binding.popupProps.onKeyDown}><button>안쪽</button></div>;
  }
  render(<Popup />);
  expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  expect(fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })).toBe(false);
  expect(close).not.toHaveBeenCalled();
});
it('확인 binding은 동기 중복 실행·pending 확인·취소를 막는다', async () => {
  const confirm = vi.fn(); const cancel = vi.fn();
  function Confirm({ pending }: { pending: boolean }) {
    const binding = useConfirmBinding({ pending, onConfirm: confirm, onCancel: cancel });
    return <><button onClick={() => { binding.confirm(); binding.confirm(); }}>확인</button><button onClick={binding.cancel}>취소</button></>;
  }
  const view = render(<Confirm pending={false} />);
  fireEvent.click(screen.getByText('확인'));
  expect(confirm).toHaveBeenCalledTimes(1);
  await act(async () => {});
  view.rerender(<Confirm pending />);
  fireEvent.click(screen.getByText('확인')); fireEvent.click(screen.getByText('취소'));
  expect(confirm).toHaveBeenCalledTimes(1); expect(cancel).not.toHaveBeenCalled();
});
it('완료 확인 binding은 열린 주기에 한 번 실행하고 다음 주기에 다시 허용한다', () => {
  const confirm = vi.fn();
  function Done({ open }: { open: boolean }) { const binding = useAcknowledgeBinding({ open, onConfirm: confirm }); return <button onClick={binding.confirm}>완료</button>; }
  const view = render(<Done open />);
  fireEvent.click(screen.getByText('완료')); fireEvent.click(screen.getByText('완료'));
  expect(confirm).toHaveBeenCalledTimes(1);
  view.rerender(<Done open={false} />); view.rerender(<Done open />);
  fireEvent.click(screen.getByText('완료'));
  expect(confirm).toHaveBeenCalledTimes(2);
});
it('진행 binding은 본문을 잠그고 덮개 종료 후 잃은 포커스를 돌린다', () => {
  function Registration({ active }: { active: boolean }) { useBlockingProgress('edit', active); return null; }
  function Progress({ active }: { active: boolean }) {
    const binding = useBlockingProgressBinding();
    return <BlockingRegistryContext.Provider value={binding.registry}><div data-testid="content" ref={binding.contentRef} {...binding.contentProps}><button>본문</button><Registration active={active} /></div></BlockingRegistryContext.Provider>;
  }
  const view = render(<Progress active={false} />);
  screen.getByText('본문').focus();
  view.rerender(<Progress active />);
  expect(screen.getByTestId('content').hasAttribute('inert')).toBe(true);
  expect(screen.getByTestId('content').getAttribute('aria-busy')).toBe('true');
  (document.activeElement as HTMLElement).blur();
  view.rerender(<Progress active={false} />);
  expect(document.activeElement).toBe(screen.getByText('본문'));
  expect(screen.getByTestId('content').hasAttribute('inert')).toBe(false);
});
it('재시도 binding은 사라진 버튼에서 결과로 포커스를 넘긴다', () => {
  function Retry({ failed }: { failed: boolean }) { const binding = useRetryFocus(failed, 'result'); return failed ? <button ref={binding.retryRef}>재시도</button> : <h1 tabIndex={-1} id="result">결과</h1>; }
  const view = render(<Retry failed />); screen.getByText('재시도').focus();
  view.rerender(<Retry failed={false} />);
  expect(document.activeElement).toBe(screen.getByText('결과'));
});
it('선택지 재시도 binding은 상태 영역을 거쳐 준비된 입력으로 복귀한다', () => {
  function Options() {
    const [ready, setReady] = useState(false);
    const binding = useOptionsRetryFocus(() => setReady(true));
    return ready ? <select ref={binding.inputRef} aria-label="선택"><option>A</option></select> : <div role="group" tabIndex={-1}><button onClick={binding.onRetry}>재시도</button></div>;
  }
  render(<Options />); screen.getByText('재시도').focus(); fireEvent.click(screen.getByText('재시도'));
  expect(document.activeElement).toBe(screen.getByLabelText('선택'));
});
it('폼 root·field binding은 제출을 격리하고 화면 값으로 한 번 저장한다', async () => {
  const save = vi.fn(async (_values: { name: string }) => undefined); const outer = vi.fn();
  function Editor() {
    const editor = useSaveForm({ schema: z.object({ name: z.string() }), source: { id: 'x', values: { name: 'before' } }, save });
    const root = useFormRootBinding(editor, false);
    const field = useFormFieldBinding(editor, 'name');
    return <div onSubmit={outer}><form {...root.formProps}><editor.form.Field name="name">{(state) => <input aria-label="이름" value={state.state.value} onChange={(event) => field.change(event.target.value, state.handleChange)} />}</editor.form.Field><button>저장</button></form></div>;
  }
  render(<Editor />); fireEvent.change(screen.getByLabelText('이름'), { target: { value: 'after' } }); fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0]?.[0]).toMatchObject({ name: 'after' });
  expect(outer).not.toHaveBeenCalled();
});
it('텍스트 길이 제한의 공통 계산은 긴 기존 값의 감소를 허용한다', () => {
  function Text() { const [value, set] = useState('long'); return <input aria-label="제한" value={value} onChange={(e) => applyFormText(value, e.target.value, 2, set)} />; }
  render(<Text />); fireEvent.change(screen.getByLabelText('제한'), { target: { value: 'longer' } });
  expect((screen.getByLabelText('제한') as HTMLInputElement).value).toBe('long');
  fireEvent.change(screen.getByLabelText('제한'), { target: { value: 'lon' } });
  expect((screen.getByLabelText('제한') as HTMLInputElement).value).toBe('lon');
});
it('CheckboxTree는 일부 선택을 −로 표시하고 누르면 전부 선택한다', () => {
  function Tree() {
    const [values, set] = useState(['a']);
    return <CheckboxTree nodes={[{ label: '부모', children: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] }]} values={values} onValueChange={set}
      renderCheckbox={(control) => <button type="button" aria-label={control.label} onClick={control.toggle}>{control.mixed ? '−' : control.checked ? '✓' : '없음'}</button>} />;
  }
  render(<Tree />); expect(screen.getByRole('button', { name: '부모' }).textContent).toBe('−');
  fireEvent.click(screen.getByRole('button', { name: '부모' }));
  expect(screen.getByRole('button', { name: '부모' }).textContent).toBe('✓');
  expect(screen.getByRole('button', { name: 'B' }).textContent).toBe('✓');
});
