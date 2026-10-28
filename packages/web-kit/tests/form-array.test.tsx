// @vitest-environment jsdom
// 파일 책임: 행을 늘리고 줄이는 입력의 규칙(값을 목록에 넣는 [추가] 칸의 Enter = 추가 버튼, 프로젝트가 정한 최소·최대 줄 수)을 실제 DOM으로 검사한다.
import { useForm } from '@tanstack/react-form';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { FormArrayField } from '../src/form/array';

afterEach(cleanup);

interface Values {
  rows: { name: string }[];
}

/**
 * 입력한 값을 [추가]가 목록에 넣는 칸(제목 입력 + [추가]). 추가 버튼은 빈 값이면 오류를 보이고 막는다. Enter도 같은 일을 해야 한다.
 * 줄 안 칸에는 `enterAdds`를 걸지 않는다(그 칸의 Enter는 페이지 폼 제출, skill web-kit-form 「Enter」).
 */
function Harness({ maxItems, onSubmit }: { readonly maxItems?: number; readonly onSubmit?: () => void }) {
  const form = useForm({ defaultValues: { rows: [] } as Values });
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <FormArrayField form={form} name="rows" maxItems={maxItems}>
        {(rows) => {
          const add = () => {
            if (draft.trim() === '') return setError('이름을 입력하세요');
            setError('');
            rows.append({ name: draft.trim() });
            setDraft('');
          };
          return (
            <>
              <input aria-label="새 이름" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={rows.enterAdds(add)} />
              <button type="button" onClick={add}>
                추가
              </button>
              <p role="alert">{error}</p>
              {rows.items.map((item, i) => (
                <div key={i}>
                  <input
                    aria-label={`이름 ${i + 1}`}
                    value={item.name}
                    onChange={(event) => form.setFieldValue(`rows[${i}].name`, event.target.value)}
                  />
                  {rows.canRemove ? <button type="button" onClick={() => rows.remove(i)}>{`삭제 ${i + 1}`}</button> : null}
                </div>
              ))}
            </>
          );
        }}
      </FormArrayField>
    </form>
  );
}

/** 최소 줄 수의 기본값과 프로젝트 지정값을 실제 추가·삭제 버튼으로 관찰한다. */
function MinimumHarness({ minItems, initialNames }: { readonly minItems?: number; readonly initialNames: readonly string[] }) {
  const form = useForm({ defaultValues: { rows: initialNames.map((name) => ({ name })) } });
  return (
    <FormArrayField form={form} name="rows" minItems={minItems}>
      {(rows) => (
        <>
          {rows.items.map((item, i) => (
            <div key={i}>
              <input aria-label={`이름 ${i + 1}`} value={item.name} readOnly />
              {rows.canRemove ? <button type="button" onClick={() => rows.remove(i)}>{`삭제 ${i + 1}`}</button> : null}
            </div>
          ))}
          <button type="button" onClick={() => rows.append({ name: '새 줄' })}>
            추가
          </button>
        </>
      )}
    </FormArrayField>
  );
}

const rowCount = () => screen.queryAllByLabelText(/^이름 \d+$/).length;
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
/** Enter를 누르고, 브라우저처럼 막히지 않았는지(= 폼 암묵 제출로 이어지는지)를 돌려준다. */
const enter = (label: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter', ...init });

it('F1 값이 있는 [추가] 칸에서 Enter는 추가 버튼을 누른 것과 같이 그 값으로 줄을 더한다', () => {
  render(<Harness />);
  type('새 이름', 'Kim');
  enter('새 이름');
  expect(rowCount()).toBe(1);
  expect((screen.getByLabelText('이름 1') as HTMLInputElement).value).toBe('Kim');
  expect((screen.getByLabelText('새 이름') as HTMLInputElement).value).toBe('');
});

it('F2 비어 있어 추가 버튼이 오류를 보이는 상황이면 Enter도 같은 오류를 보이고 줄을 더하지 않는다', () => {
  render(<Harness />);
  fireEvent.click(screen.getByText('추가'));
  const viaButton = screen.getByRole('alert').textContent;
  expect(viaButton).toBe('이름을 입력하세요');
  type('새 이름', 'Kim');
  fireEvent.click(screen.getByText('추가'));
  expect(screen.getByRole('alert').textContent).toBe('');
  enter('새 이름');
  expect(screen.getByRole('alert').textContent).toBe(viaButton);
  expect(rowCount()).toBe(1);
});

it('F3 [추가] 칸의 Enter는 폼을 제출하지 않는다(브라우저 암묵 제출을 막는다)', () => {
  const onSubmit = vi.fn();
  render(<Harness onSubmit={onSubmit} />);
  type('새 이름', 'Kim');
  expect(enter('새 이름')).toBe(false);
  expect(onSubmit).not.toHaveBeenCalled();
});

it('F4 한글 조합 중의 Enter는 추가하지 않는다', () => {
  render(<Harness />);
  type('새 이름', '김');
  enter('새 이름', { isComposing: true });
  expect(rowCount()).toBe(0);
});

it('F5 최대 줄 수에서는 Enter가 추가도 제출도 하지 않는다', () => {
  const onSubmit = vi.fn();
  render(<Harness maxItems={1} onSubmit={onSubmit} />);
  type('새 이름', 'Kim');
  enter('새 이름');
  type('새 이름', 'Lee');
  expect(enter('새 이름')).toBe(false);
  expect(rowCount()).toBe(1);
  expect(onSubmit).not.toHaveBeenCalled();
});

it('F6 최소 한 줄을 지정하면 한 줄뿐일 때 삭제가 없고, 두 줄에서 하나를 지우면 다시 없다', () => {
  render(<MinimumHarness minItems={1} initialNames={['Kim']} />);
  expect(screen.queryByText(/^삭제/)).toBeNull();
  fireEvent.click(screen.getByText('추가'));
  expect(screen.getAllByText(/^삭제/)).toHaveLength(2);
  fireEvent.click(screen.getByText('삭제 1'));
  expect(rowCount()).toBe(1);
  expect(screen.queryByText(/^삭제/)).toBeNull();
});

it('F7 최소 줄 수를 생략하면 마지막 줄을 삭제하고 빈 목록에서 다시 추가할 수 있다', () => {
  render(<MinimumHarness initialNames={['Kim']} />);
  fireEvent.click(screen.getByRole('button', { name: '삭제 1' }));
  expect(screen.queryAllByLabelText(/^이름 \d+$/)).toHaveLength(0);
  expect(screen.queryByRole('button', { name: /^삭제/ })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  expect(rowCount()).toBe(1);
  expect((screen.getByLabelText('이름 1') as HTMLInputElement).value).toBe('새 줄');
  expect(screen.getByRole('button', { name: '삭제 1' })).toBeDefined();
});

it('F8 최소 두 줄을 지정하면 세 번째 줄을 추가한 뒤 어느 줄이든 삭제해 두 줄까지만 줄일 수 있다', () => {
  render(<MinimumHarness minItems={2} initialNames={['Kim', 'Lee']} />);
  expect(rowCount()).toBe(2);
  expect(screen.queryByRole('button', { name: /^삭제/ })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  expect(screen.getAllByRole('button', { name: /^삭제/ })).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: '삭제 1' }));
  expect(rowCount()).toBe(2);
  expect((screen.getByLabelText('이름 1') as HTMLInputElement).value).toBe('Lee');
  expect(screen.queryByRole('button', { name: /^삭제/ })).toBeNull();
});
