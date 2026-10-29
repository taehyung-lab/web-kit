// @vitest-environment jsdom
// 파일 책임: 공용 선택 칸의 leaf 저장·삼상태·모양 교체와 늦은 서버 응답 보호를 관찰한다.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { Choice, type ChoiceProps, type ChoiceValue } from '../../ui-registry/src/ui/choice';
const nodes = [
  {
    label: '전체',
    children: [
      {
        label: '그룹',
        children: [
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ],
      },
      { value: 'c', label: 'Gamma' },
    ],
  },
];
afterEach(cleanup);
/** 값은 화면에 출력하여 UI 입력의 결과만 관찰한다. */
function Harness(props: Partial<ChoiceProps>) {
  const [value, setValue] = useState<ChoiceValue>(props.multiple ? [] : undefined);
  return (
    <>
      <Choice label="선택" nodes={nodes} appearance="vertical" {...props} value={value} onValueChange={setValue} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}
it('가지의 일부/전체/없음을 구분하고 leaf ID만 저장한다', () => {
  render(<Harness multiple />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha' }));
  expect(screen.getByRole('checkbox', { name: '그룹' }).getAttribute('aria-checked')).toBe('mixed');
  expect(screen.getByRole('checkbox', { name: '전체' }).getAttribute('aria-checked')).toBe('mixed');
  fireEvent.click(screen.getByRole('checkbox', { name: '그룹' }));
  expect(screen.getByTestId('value').textContent).toBe('["a","b"]');
  expect(screen.getByRole('checkbox', { name: '그룹' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('checkbox', { name: '전체' }));
  expect(screen.getByTestId('value').textContent).toBe('["a","b","c"]');
  fireEvent.click(screen.getByRole('checkbox', { name: '전체' }));
  expect(screen.getByTestId('value').textContent).toBe('[]');
});
it('단일 선택에서 가지는 저장할 수 없고 모양을 바꿔도 값은 유지된다', () => {
  const view = render(<Harness />);
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  fireEvent.click(screen.getByRole('radio', { name: 'Beta' }));
  expect(screen.getByTestId('value').textContent).toBe('"b"');
  view.rerender(<Harness appearance="dropdown" />);
  expect(screen.getByRole('button', { name: '선택' }).textContent).toBe('Beta');
  expect(screen.getByTestId('value').textContent).toBe('"b"');
});
it('서버 검색은 입력 정지를 기다리고 늦은 이전 결과로 현재 결과를 덮지 않는다', async () => {
  const pending = new Map<string, (nodes: ChoiceProps['nodes']) => void>();
  const search = vi.fn((text: string) => new Promise<ChoiceProps['nodes']>((resolve) => pending.set(text, resolve)));
  render(<Harness appearance="search" search={search} debounceMs={20} />);
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  fireEvent.click(screen.getByRole('button', { name: '선택' }));
  fireEvent.change(input, { target: { value: 'a' } });
  fireEvent.change(input, { target: { value: 'ab' } });
  await waitFor(() => expect(pending.has('ab')).toBe(true));
  expect(search.mock.calls.some(([text]) => text === 'a')).toBe(false);
  fireEvent.change(input, { target: { value: 'abc' } });
  await waitFor(() => expect(pending.has('abc')).toBe(true));
  await act(async () => pending.get('abc')!([{ value: 'new', label: 'New result' }]));
  await act(async () => pending.get('ab')!([{ value: 'old', label: 'Old result' }]));
  expect(screen.queryByText('Old result')).toBeNull();
  expect(screen.getByText('New result')).toBeTruthy();
});

it('검색 팝업이 열린 뒤 비활성화해도 선택 값이 바뀌지 않는다', async () => {
  const view = render(<Harness appearance="search" />);
  fireEvent.click(screen.getByRole('button', { name: '선택' }));
  await screen.findByRole('option', { name: 'Alpha' });
  view.rerender(<Harness appearance="search" disabled />);
  const option = screen.queryByRole('option', { name: 'Alpha' });
  if (option !== null) fireEvent.click(option);
  expect(screen.getByTestId('value').textContent).toBe('');
});
it('단일 선택의 radio는 id 생략 시에도 같은 칸끼리만 묶인다', () => {
  render(
    <>
      <Harness />
      <Harness />
    </>,
  );
  const radios = screen.getAllByRole('radio') as HTMLInputElement[];
  expect(radios[0]!.name).not.toBe('');
  expect(radios[0]!.name).toBe(radios[1]!.name);
  expect(radios[0]!.name).not.toBe(radios[3]!.name);
});

it('함수 객체만 바뀌는 렌더는 진행 요청을 보존하고 검색 맥락 변경만 취소한다', async () => {
  const pending: { signal: AbortSignal; resolve: (nodes: ChoiceProps['nodes']) => void }[] = [];
  const search = (_text: string, signal: AbortSignal) => new Promise<ChoiceProps['nodes']>((resolve) => pending.push({ signal, resolve }));
  const view = render(<Harness appearance="search" search={(text, signal) => search(text, signal)} searchKey={['A']} debounceMs={1} />);
  fireEvent.click(screen.getByRole('button', { name: '선택' }));
  await waitFor(() => expect(pending).toHaveLength(1));
  view.rerender(<Harness appearance="search" search={(text, signal) => search(text, signal)} searchKey={['A']} debounceMs={1} />);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(pending).toHaveLength(1);
  expect(pending[0]!.signal.aborted).toBe(false);
  view.rerender(<Harness appearance="search" search={(text, signal) => search(text, signal)} searchKey={['B']} debounceMs={1} />);
  await waitFor(() => expect(pending).toHaveLength(2));
  expect(pending[0]!.signal.aborted).toBe(true);
  await act(async () => pending[1]!.resolve([{ value: 'new', label: 'Current' }]));
  await act(async () => pending[0]!.resolve([{ value: 'old', label: 'Previous' }]));
  expect(screen.getByText('Current')).toBeTruthy();
  expect(screen.queryByText('Previous')).toBeNull();
});
it('해제 이름을 명시한 단일 칸은 다른 값에 손대지 않고 비울 수 있다', () => {
  render(<Harness clearLabel="전체 분류" />);
  fireEvent.click(screen.getByRole('radio', { name: 'Beta' }));
  fireEvent.click(screen.getByRole('button', { name: '전체 분류' }));
  expect(screen.getByTestId('value').textContent).toBe('');
});
