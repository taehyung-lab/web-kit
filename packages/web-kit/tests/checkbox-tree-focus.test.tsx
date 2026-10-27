// @vitest-environment jsdom
// 파일 책임: 폼의 첫 오류 칸이 체크 트리일 때 검증 실패가 그 트리로 focus를 옮기는지 실제 DOM으로 검사한다.
import type { StandardSchemaV1 } from '@tanstack/react-form';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { CheckboxTree } from '../src/CheckboxTree';
import { useSaveForm } from '../src/form/save-form';

afterEach(cleanup);

interface Values {
  readonly name: string;
  readonly categories: string[];
}

/** 이름과 분류가 모두 필수인 Standard Schema. */
const schema: StandardSchemaV1<Values, Values> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value) => {
      const values = value as Values;
      const issues = [
        ...(values.name === '' ? [{ message: 'name', path: ['name'] }] : []),
        ...(values.categories.length === 0 ? [{ message: 'categories', path: ['categories'] }] : []),
      ];
      return issues.length > 0 ? { issues } : { value: values };
    },
  },
};

function Screen() {
  const save = useSaveForm({
    schema,
    source: { id: 1, values: { name: 'ok', categories: [] } },
    save: async () => undefined,
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save.submit();
      }}
    >
      <save.form.Field name="categories">
        {(field) => (
          <CheckboxTree
            id={save.fieldId('categories')}
            labelledBy="categories-label"
            values={field.state.value}
            onValueChange={field.handleChange}
            nodes={[{ label: 'Office', children: [{ label: 'Paper', value: 'paper' }] }]}
            renderCheckbox={({ label, checked, toggle }) => (
              <input type="checkbox" aria-label={label} checked={checked} onChange={toggle} />
            )}
          />
        )}
      </save.form.Field>
      <button type="submit">save</button>
    </form>
  );
}

it('T1 첫 오류가 분류 트리이면 검증 실패 뒤 focus가 그 트리로 간다', async () => {
  render(<Screen />);
  await act(async () => {
    fireEvent.click(screen.getByText('save'));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(document.activeElement).toBe(screen.getByRole('group'));
});
