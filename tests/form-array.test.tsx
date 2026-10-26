// @vitest-environment jsdom
// 파일 책임: 행을 늘리고 줄이는 입력의 규칙(Enter = 추가 버튼, 한 줄뿐이면 삭제 없음)을 실제 DOM으로 검사한다.
import { useForm } from '@tanstack/react-form';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { FormArrayField } from '../src/form/array';

afterEach(cleanup);

interface Values {
  rows: { name: string }[];
}

/** 추가 버튼이 빈 이름이면 오류를 보이고 막는 화면. Enter도 같은 일을 해야 한다. */
function Harness({ maxItems, onSubmit }: { readonly maxItems?: number; readonly onSubmit?: () => void }) {
  const form = useForm({ defaultValues: { rows: [{ name: '' }] } as Values });
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <FormArrayField form={form} name="rows" minItems={1} maxItems={maxItems}>
        {(rows) => {
          const add = () => {
            if (rows.items.at(-1)?.name.trim() === '') return setError('이름을 입력하세요');
            setError('');
            rows.append({ name: '' });
          };
          return (
            <>
              {rows.items.map((item, i) => (
                <div key={i}>
                  <input
                    aria-label={`이름 ${i + 1}`}
                    value={item.name}
                    onChange={(event) => form.setFieldValue(`rows[${i}].name`, event.target.value)}
                    onKeyDown={rows.enterAdds(add)}
                  />
                  {rows.canRemove ? <button type="button" onClick={() => rows.remove(i)}>{`삭제 ${i + 1}`}</button> : null}
                </div>
              ))}
              <button type="button" onClick={add}>추가</button>
              <p role="alert">{error}</p>
            </>
          );
        }}
      </FormArrayField>
    </form>
  );
}

const rowCount = () => screen.getAllByLabelText(/^이름 \d+$/).length;
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const enter = (label: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter', ...init });

it('F1 값이 있는 줄에서 Enter는 추가 버튼을 누른 것과 같이 줄을 더한다', () => {
  render(<Harness />);
  type('이름 1', 'Kim');
  enter('이름 1');
  expect(rowCount()).toBe(2);
});

it('F2 비어 있어 추가 버튼이 오류를 보이는 상황이면 Enter도 같은 오류를 보이고 줄을 더하지 않는다', () => {
  render(<Harness />);
  fireEvent.click(screen.getByText('추가'));
  const viaButton = screen.getByRole('alert').textContent;
  fireEvent.change(screen.getByLabelText('이름 1'), { target: { value: '' } });
  enter('이름 1');
  expect(viaButton).toBe('이름을 입력하세요');
  expect(screen.getByRole('alert').textContent).toBe(viaButton);
  expect(rowCount()).toBe(1);
});

it('F3 줄 안 입력의 Enter는 폼을 제출하지 않는다', () => {
  const onSubmit = vi.fn();
  render(<Harness onSubmit={onSubmit} />);
  type('이름 1', 'Kim');
  enter('이름 1');
  expect(onSubmit).not.toHaveBeenCalled();
});

it('F4 한글 조합 중의 Enter는 추가하지 않는다', () => {
  render(<Harness />);
  type('이름 1', '김');
  enter('이름 1', { isComposing: true });
  expect(rowCount()).toBe(1);
});

it('F5 최대 줄 수에서는 Enter가 추가도 제출도 하지 않는다', () => {
  const onSubmit = vi.fn();
  render(<Harness maxItems={1} onSubmit={onSubmit} />);
  type('이름 1', 'Kim');
  enter('이름 1');
  expect(rowCount()).toBe(1);
  expect(onSubmit).not.toHaveBeenCalled();
});

it('F6 한 줄뿐이면 삭제가 없고, 두 줄이 되면 모두 삭제가 있고, 하나를 지우면 다시 없다', () => {
  render(<Harness />);
  expect(screen.queryByText(/^삭제/)).toBeNull();
  type('이름 1', 'Kim');
  enter('이름 1');
  expect(screen.getAllByText(/^삭제/)).toHaveLength(2);
  fireEvent.click(screen.getByText('삭제 1'));
  expect(rowCount()).toBe(1);
  expect(screen.queryByText(/^삭제/)).toBeNull();
});
