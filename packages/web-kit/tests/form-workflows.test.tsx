// @vitest-environment jsdom
// 파일 책임: 두 저장 방식과 폼 내부 참조의 입력·확인·요청·저장 기준선을 실제 공용 부품으로 검사한다.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Form } from '../src/form/ui';
import { useSaveForm, type SaveFormEditor } from '../src/form/save-form';
import type { FormReference } from '../src/form/references';

afterEach(cleanup);

it.each(['text', 'checkbox'] as const)('%s 원본의 참조 정리는 제출 전 조용하고 제출 실패 후 최종 값의 오류를 표시한다', async (kind) => {
  const schema = z.object({ enabled: z.boolean(), code: z.string(), selected: z.string().min(1, '선택 필요') });
  const C = Form.of<z.input<typeof schema>>();
  /** 참조 정리 뒤에도 기본 폼의 제출 전후 검증 시점을 따른다. */
  function ReferenceValidation() {
    const current = useSaveForm({
      schema,
      source: { id: 1, values: { enabled: true, code: 'a', selected: 'a' } },
      save: async () => { throw new Error('offline'); },
      references: [{ source: (v) => (v.enabled ? [v.code] : []), fields: () => ['selected'], message: '원본 필요' }],
    });
    return (
      <C editor={current} protect={false}>
        <C.Text name="code" label="원본" />
        <C.Checkbox name="enabled" label="사용" />
        <C.Text name="selected" label="참조" />
        <C.Submit>저장</C.Submit>
      </C>
    );
  }
  for (const submitted of [false, true]) {
    const view = render(<ReferenceValidation />);
    if (submitted) await act(async () => fireEvent.click(screen.getByText('저장')));
    if (kind === 'text') fireEvent.change(screen.getByLabelText('원본'), { target: { value: 'b' } });
    else fireEvent.click(screen.getByLabelText('사용'));
    await act(async () => fireEvent.click(screen.getByText('함께 정리')));
    expect((screen.getByLabelText(/^참조/) as HTMLInputElement).value).toBe('');
    if (submitted) expect(screen.getByRole('alert').textContent).toBe('선택 필요');
    else expect(screen.queryByRole('alert')).toBeNull();
    view.unmount();
  }
});

it('두 번째 검증 실패는 오류 칸에 초점을 주고 입력 교정 후 기본 추가 필수 없이 저장한다', async () => {
  const draftSave = vi.fn(async () => undefined);
  /** 임시 저장은 제목만 요구하고 기본 저장은 코드도 요구한다. */
  function DraftValidation() {
    const current = useSaveForm({
      schema: strict,
      source: { id: 1, values: initial },
      save: primary,
      secondary: { schema: loose.extend({ title: z.string().min(1, '임시 제목 필요') }), save: draftSave },
    });
    return (
      <F editor={current} protect={false}>
        <F.Text name="title" label="제목" />
        <F.Text name="code" label="코드" />
        <F.Submit mode="secondary">임시 저장</F.Submit>
      </F>
    );
  }
  render(<DraftValidation />);
  await act(async () => fireEvent.click(screen.getByText('임시 저장')));
  expect(screen.getByRole('alert').textContent).toBe('임시 제목 필요');
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/^제목/)));
  expect(draftSave).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/^제목/), { target: { value: '임시 제목' } });
  await act(async () => fireEvent.click(screen.getByText('임시 저장')));
  expect(draftSave).toHaveBeenCalledTimes(1);
  expect(primary).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).toBeNull();
});
const loose = z.object({
  title: z.string(),
  code: z.string(),
  sources: z.array(z.object({ id: z.string(), label: z.string() })),
  choice: z.string(),
  mirror: z.array(z.string()),
});
const strict = loose.extend({ title: z.string().min(1, '제목 필요'), code: z.string().min(1, '코드 필요') });
type Values = z.input<typeof loose>;
const initial: Values = {
  title: '',
  code: '',
  sources: [
    { id: 'a', label: '첫 항목' },
    { id: 'b', label: '둘째 항목' },
  ],
  choice: 'a',
  mirror: ['a', 'b'],
};
const F = Form.of<Values>();
let editor: SaveFormEditor<Values>;
const primary = vi.fn(async (_values: Values): Promise<void> => undefined);
const secondary = vi.fn(async (_values: Values): Promise<void> => undefined);
afterEach(() => {
  primary.mockClear();
  secondary.mockClear();
});

/** 같은 저장 상태를 사용하는 예시이며 관계와 두 검증만 프로젝트 값으로 제공한다. */
function Example({
  mode = 'clear',
  id = 1,
  confirm = false,
  source = initial,
  rules,
  onSecondarySaved,
}: {
  rules?: readonly FormReference<Values>[];
  onSecondarySaved?: () => void;
  mode?: 'clear' | 'block' | 'validate';
  id?: number;
  confirm?: boolean;
  source?: Values;
}) {
  const references: readonly FormReference<Values>[] = [
    {
      source: (v) => v.sources.map((row) => row.id),
      fields: () => ['choice', 'mirror'],
      onRemove: mode,
      message: '참조를 먼저 바꿔 주세요.',
    },
  ];
  const current = useSaveForm({
    schema: strict,
    source: { id, values: source },
    references: rules ?? references,
    save: primary,
    secondary: { schema: loose, save: secondary, confirm, onSaved: onSecondarySaved },
  });
  editor = current;
  return (
    <F editor={current} protect={false}>
      <F.Text name="title" label="제목" />
      <F.Text name="code" label="코드" />
      <F.Array name="sources">
        {(rows) => (
          <>
            {rows.items.map((row, index) => (
              <div key={row.id}>
                <F.Text name={`sources[${index}].label`} label={`이름 ${row.id}`} />
                <F.Text name={`sources[${index}].id`} label={`ID ${row.id}`} />
                <button type="button" onClick={() => rows.remove(index)}>
                  삭제 {row.id}
                </button>
              </div>
            ))}
          </>
        )}
      </F.Array>
      <F.Choice name="choice" label="선택" nodes={current.form.state.values.sources.map((row) => ({ value: row.id, label: row.label }))} />
      <F.Choice
        name="mirror"
        label="다중"
        multiple
        nodes={current.form.state.values.sources.map((row) => ({ value: row.id, label: row.label }))}
      />
      <F.Failure />
      <F.Submit>정식 저장</F.Submit>
      <F.Submit mode="secondary">임시 저장</F.Submit>
      <F.Confirm />
      <output data-testid="dirty">{String(current.isDirty)}</output>
    </F>
  );
}

it('기본 저장의 필수 오류 뒤에도 두 번째 검증만 통과하면 저장하고 새 입력은 다시 변경 상태다', async () => {
  render(<Example />);
  await act(async () => fireEvent.click(screen.getByText('정식 저장')));
  expect(primary).not.toHaveBeenCalled();
  await screen.findByText('코드 필요');
  await act(async () => fireEvent.click(screen.getByText('임시 저장')));
  expect(secondary).toHaveBeenCalledTimes(1);
  expect(secondary.mock.calls[0]?.[0]).toMatchObject({ title: '', code: '' });
  expect(screen.getByTestId('dirty').textContent).toBe('false');
  fireEvent.change(screen.getByLabelText(/^제목/), { target: { value: '새 입력' } });
  expect(screen.getByTestId('dirty').textContent).toBe('true');
});

it('삭제 확인은 남는 두 참조 칸을 세고 취소는 원본을 보존하며 확인은 한 번에 정리한다', async () => {
  render(<Example />);
  fireEvent.click(screen.getByText('삭제 a'));
  await screen.findByRole('alertdialog', { name: '2곳에서 쓰고 있습니다. 함께 정리할까요?' });
  expect(editor.form.state.values.sources).toHaveLength(2);
  fireEvent.click(screen.getByText('취소'));
  expect(editor.form.state.values.choice).toBe('a');
  fireEvent.click(screen.getByText('삭제 a'));
  await act(async () => fireEvent.click(screen.getByText('함께 정리')));
  expect(editor.form.state.values).toMatchObject({ sources: [{ id: 'b' }], choice: '', mirror: ['b'] });
  await act(async () => fireEvent.click(screen.getByText('임시 저장')));
  expect(secondary.mock.calls[0]?.[0]).toMatchObject({ choice: '', mirror: ['b'] });
});

it('막기는 원본과 참조를 보존하고 저장 시 오류 방식은 원본 삭제를 허용하되 두 번째 저장도 막는다', async () => {
  const view = render(<Example mode="block" />);
  fireEvent.click(screen.getByText('삭제 a'));
  expect(screen.getByRole('alert').textContent).toBe('참조를 먼저 바꿔 주세요.');
  expect(editor.form.state.values.sources).toHaveLength(2);
  view.rerender(<Example mode="validate" />);
  await act(async () => fireEvent.click(screen.getByText('삭제 a')));
  expect(editor.form.state.values.sources).toHaveLength(1);
  await act(async () => fireEvent.click(screen.getByText('임시 저장')));
  expect(secondary).not.toHaveBeenCalled();
  expect(screen.getAllByRole('alert').some((node) => node.textContent === '참조를 먼저 바꿔 주세요.')).toBe(true);
});

it('이름 변경은 선택을 유지하고 ID 변경은 참조 정리를 물으며 다른 입력을 바꾸면 지난 확인은 취소된다', async () => {
  render(<Example />);
  fireEvent.change(screen.getByLabelText('이름 a'), { target: { value: '새 이름' } });
  expect(screen.getByRole('button', { name: '선택' }).textContent).toBe('새 이름');
  expect(editor.form.state.values.choice).toBe('a');
  fireEvent.change(screen.getByLabelText('ID a'), { target: { value: 'c' } });
  const pending = editor.referenceChange!;
  expect(pending.count).toBe(2);
  fireEvent.change(screen.getByLabelText(/^제목/), { target: { value: '다른 입력' } });
  fireEvent.change(screen.getByLabelText(/^제목/), { target: { value: '' } });
  await act(async () => pending.confirm());
  expect(editor.form.state.values.sources[0]?.id).toBe('a');
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('두 번째 저장 확인값은 고정되고 연속·교차 제출은 하나의 저장만 보낸다', async () => {
  let finish!: () => void;
  secondary.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(<Example confirm />);
  await act(async () => fireEvent.click(screen.getByText('임시 저장')));
  const submitted = editor.stage.kind === 'confirming' ? editor.stage.values : undefined;
  fireEvent.change(screen.getByLabelText(/^제목/), { target: { value: '후속 입력' } });
  await act(async () => {
    void editor.confirm();
    void editor.submit();
    void editor.submitSecondary?.();
  });
  expect(secondary).toHaveBeenCalledTimes(1);
  expect(primary).not.toHaveBeenCalled();
  expect(secondary.mock.calls[0]?.[0]).toEqual(submitted);
  await act(async () => finish());
  expect(editor.form.state.values.title).toBe('후속 입력');
  expect(editor.isDirty).toBe(true);
});

it('확인 중 레코드가 바뀌면 이전 참조 변경을 새 폼에 반영하지 않는다', async () => {
  const view = render(<Example />);
  fireEvent.click(screen.getByText('삭제 a'));
  const pending = editor.referenceChange!;
  view.rerender(<Example id={2} source={{ ...initial, title: '다른 원본' }} />);
  await act(async () => pending.confirm());
  await waitFor(() => expect(editor.form.state.values.title).toBe('다른 원본'));
  expect(editor.form.state.values.sources).toHaveLength(2);
});

it('연쇄 참조는 한 번 확인해 모두 정리하고 직접 바꾼 끊긴 참조는 두 저장에서 거절한다', async () => {
  const rules: readonly FormReference<Values>[] = [
    { source: (v) => v.sources.map((row) => row.id), fields: () => ['choice'], message: '원본 필요' },
    { source: (v) => (v.choice === '' ? [] : [v.choice]), fields: () => ['mirror'], message: '선택 필요' },
  ];
  render(<Example rules={rules} source={{ ...initial, title: '제목', code: '코드', mirror: ['a'] }} />);
  fireEvent.click(screen.getByText('삭제 a'));
  expect(editor.referenceChange?.count).toBe(2);
  await act(async () => editor.referenceChange?.confirm());
  expect(editor.form.state.values).toMatchObject({ choice: '', mirror: [] });
  act(() => editor.form.setFieldValue('choice', 'gone'));
  await act(async () => editor.submit());
  await act(async () => editor.submitSecondary?.());
  expect(primary).not.toHaveBeenCalled();
  expect(secondary).not.toHaveBeenCalled();
});

it('함께 삭제되는 행 안의 참조는 남는 참조 칸 수에 넣지 않는다', async () => {
  render(
    <Example
      source={{
        ...initial,
        choice: '',
        mirror: [],
        sources: [
          { id: 'a', label: 'a' },
          { id: 'b', label: 'b' },
        ],
      }}
      rules={[
        {
          source: (v) => v.sources.map((row) => row.id),
          fields: (v) => v.sources.map((_, index) => `sources[${index}].label` as const),
          message: '원본 필요',
        },
      ]}
    />,
  );
  await act(async () => fireEvent.click(screen.getByText('삭제 a')));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(editor.form.state.values.sources).toEqual([{ id: 'b', label: 'b' }]);
});

it('두 번째 저장 실패는 입력과 dirty를 보존하고 언마운트 뒤 성공은 완료 작업을 하지 않는다', async () => {
  secondary.mockRejectedValueOnce(new Error('offline'));
  const completed = vi.fn();
  const view = render(<Example onSecondarySaved={completed} />);
  fireEvent.change(screen.getByLabelText(/^제목/), { target: { value: '보존' } });
  await act(async () => editor.submitSecondary?.());
  expect(editor.isDirty).toBe(true);
  expect(editor.form.state.values.title).toBe('보존');
  expect(screen.getByRole('alert').textContent).toContain('저장하지 못했습니다');
  let finish!: () => void;
  secondary.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    void editor.submitSecondary?.();
  });
  view.unmount();
  await act(async () => finish());
  expect(screen.queryByRole('alert')).toBeNull();
  expect(completed).not.toHaveBeenCalled();
});

it('체크 해제도 같은 확인을 거쳐 참조를 정리한다', async () => {
  const schema = z.object({ enabled: z.boolean(), selected: z.string() });
  const C = Form.of<z.input<typeof schema>>();
  let current!: SaveFormEditor<z.input<typeof schema>>;
  /** 체크로 제공되는 원본과 그 원본을 고른 칸을 연결한다. */
  function CheckboxSource() {
    current = useSaveForm({
      schema,
      source: { id: 1, values: { enabled: true, selected: 'x' } },
      save: async () => undefined,
      references: [{ source: (v) => (v.enabled ? ['x'] : []), fields: () => ['selected'], message: '원본 필요' }],
    });
    return (
      <C editor={current} protect={false}>
        <C.Checkbox name="enabled" label="원본 사용" />
        <C.Text name="selected" label="참조" />
      </C>
    );
  }
  render(<CheckboxSource />);
  fireEvent.click(screen.getByLabelText('원본 사용'));
  expect(current.form.state.values.enabled).toBe(true);
  await act(async () => fireEvent.click(screen.getByText('함께 정리')));
  expect(current.form.state.values).toEqual({ enabled: false, selected: '' });
});

it('두 번째 저장의 폼 전체 검증 문구를 화면에 표시한다', async () => {
  /** 특정 칸이 아닌 작성 내용 전체를 거절하는 프로젝트 검증이다. */
  function RootValidation() {
    const current = useSaveForm({
      schema: loose,
      source: { id: 1, values: initial },
      save: primary,
      secondary: { schema: loose.refine(() => false, '최소 한 가지 내용을 작성해 주세요.'), save: secondary },
    });
    return (
      <F editor={current} protect={false} formatError={() => undefined}>
        <F.Failure />
        <F.Submit mode="secondary">임시 저장</F.Submit>
      </F>
    );
  }
  render(<RootValidation />);
  await act(async () => fireEvent.click(screen.getByText('임시 저장')));
  expect(screen.getByRole('alert').textContent).toBe('최소 한 가지 내용을 작성해 주세요.');
  expect(secondary).not.toHaveBeenCalled();
});

it('다른 응답을 반환하는 두 저장의 완료 처리는 제출 시점의 동작을 유지한다', async () => {
  const completed = vi.fn();
  /** 게시 결과와 임시 저장 결과의 모양 및 완료 동작은 서로 독립적이다. */
  function SeparateResults({ label }: { label: string }) {
    const current = useSaveForm({
      schema: loose,
      source: { id: 1, values: initial },
      save: async () => ({ id: 42 }),
      onSaved: (result) => completed(`publish:${result.id.toFixed(0)}`),
      secondary: {
        schema: loose,
        save: async () => ({ draftId: 'draft-1' }),
        confirm: true,
        acknowledge: true,
        onSaved: (result) => completed(`${label}:${result.draftId.toUpperCase()}`),
      },
    });
    editor = current;
    return (
      <F editor={current} protect={false}>
        <F.Submit mode="secondary">임시 저장</F.Submit>
      </F>
    );
  }
  const view = render(<SeparateResults label="first" />);
  await act(async () => editor.submitSecondary?.());
  view.rerender(<SeparateResults label="later" />);
  await act(async () => editor.confirm());
  expect(completed).not.toHaveBeenCalled();
  await act(async () => editor.complete());
  expect(completed).toHaveBeenCalledExactlyOnceWith('first:DRAFT-1');
  await act(async () => editor.submit());
  expect(completed).toHaveBeenLastCalledWith('publish:42');
});
