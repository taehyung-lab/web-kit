// @vitest-environment jsdom
/** 기본 폼과 실제 메모리 Router를 소비해 입력·저장·이탈의 화면 결과를 검사한다. */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { FormNavigation, SaveForm, FormDialog } from '../src/form/ui';
import { useState, type ReactNode } from 'react';
afterEach(cleanup);
beforeAll(() => {
  window.scrollTo = vi.fn();
});
const schema = z.object({ name: z.string().min(1, '이름 필요'), contact: z.string(), needed: z.boolean() });
const values = { name: 'A', contact: '', needed: false };
/** 두 경로를 실제 Router에 연결한다. */
async function mount(node: ReactNode) {
  const root = createRootRoute({
    component: () => (
      <FormNavigation>
        <Outlet />
      </FormNavigation>
    ),
  });
  const edit = createRoute({ getParentRoute: () => root, path: '/', component: () => node });
  const done = createRoute({ getParentRoute: () => root, path: '/done', component: () => <h1>완료 화면</h1> });
  const router = createRouter({ routeTree: root.addChildren([edit, done]), history: createMemoryHistory({ initialEntries: ['/'] }) });
  await act(async () => {
    render(<RouterProvider router={router} />);
    await router.load();
  });
  return router;
}
it('기본 입력은 오류 focus와 동적 필수 의미를 연결하고 입력을 재마운트하지 않는다', async () => {
  const save = vi.fn(async () => undefined);
  await mount(
    <SaveForm schema={schema} source={{ id: 1, values }} save={save}>
      {(f) => (
        <>
          <f.Text name="name" label="이름" required />
          <f.Checkbox name="needed" label="필요" />
          <f.Text name="contact" label="연락처" required={(v) => v.needed} />
          <f.Actions />
        </>
      )}
    </SaveForm>,
  );
  const input = screen.getByRole('textbox', { name: '이름' });
  fireEvent.change(input, { target: { value: '' } });
  expect(screen.getByRole('textbox', { name: '이름' })).toBe(input);
  fireEvent.click(screen.getByLabelText('필요'));
  expect(screen.getByRole('textbox', { name: '연락처' }).getAttribute('aria-required')).toBe('true');
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect(document.activeElement).toBe(input));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toBe('이름 필요');
});
it('저장 중 추가 수정은 완료 이동에서 한 번 확인하고 취소하면 입력을 보존한다', async () => {
  let resolve!: () => void;
  const pending = new Promise<void>((r) => {
    resolve = r;
  });
  await mount(
    <SaveForm
      schema={schema}
      source={{ id: 1, values }}
      save={() => pending}
      completion={() => ({ kind: 'navigate', destination: { to: '/done' } })}
    >
      {(f) => (
        <>
          <f.Text name="name" label="이름" />
          <f.Actions />
        </>
      )}
    </SaveForm>,
  );
  fireEvent.change(screen.getByRole('textbox', { name: '이름' }), { target: { value: 'B' } });
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect((screen.getByText('저장') as HTMLButtonElement).disabled).toBe(true));
  fireEvent.change(screen.getByRole('textbox', { name: '이름' }), { target: { value: 'C' } });
  await act(async () => resolve());
  await screen.findByRole('alertdialog');
  fireEvent.click(screen.getByText('계속 편집'));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect((screen.getByRole('textbox', { name: '이름' }) as HTMLInputElement).value).toBe('C');
});
it('수정 없는 저장 완료는 확인 없이 이동한다', async () => {
  await mount(
    <SaveForm
      schema={schema}
      source={{ id: 1, values }}
      save={async () => undefined}
      completion={() => ({ kind: 'navigate', destination: { to: '/done' } })}
    >
      {(f) => (
        <>
          <f.Text name="name" label="이름" />
          <f.Actions />
        </>
      )}
    </SaveForm>,
  );
  fireEvent.change(screen.getByRole('textbox', { name: '이름' }), { target: { value: 'B' } });
  fireEvent.click(screen.getByText('저장'));
  await screen.findByText('완료 화면');
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
it('다이얼로그 닫기는 바깥 폼을 버리지 않고 안쪽 여러 폼을 한 번 확인한다', async () => {
  function Example() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <SaveForm schema={schema} source={{ id: 'outer', values }} save={async () => undefined}>
          {(f) => <f.Text name="name" label="바깥" />}
        </SaveForm>
        <FormDialog open={open} onClosed={() => setOpen(false)} title="편집">
          <SaveForm schema={schema} source={{ id: 'inner', values }} save={async () => undefined}>
            {(f) => <f.Text name="name" label="안쪽" />}
          </SaveForm>
        </FormDialog>
      </>
    );
  }
  await mount(<Example />);
  fireEvent.change(screen.getByLabelText('안쪽'), { target: { value: 'B' } });
  fireEvent.click(screen.getByText('닫기'));
  await screen.findByText('입력을 버리고 이동할까요?');
  fireEvent.click(screen.getByText('이동'));
  await waitFor(() => expect(screen.queryByText('편집')).toBeNull());
  expect(screen.getByLabelText('바깥')).toBeTruthy();
});

it('저장 확인은 앱에서 하나이며 저장 중 snapshot과 닫기 차단을 유지한다', async () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  await mount(
    <>
      <SaveForm schema={schema} source={{ id: 1, values }} save={() => promise} confirm confirmation={(v) => <p>{v.name}</p>}>
        {(f) => (
          <>
            <f.Text name="name" label="첫 이름" />
            <f.Actions submitLabel="첫 저장" />
          </>
        )}
      </SaveForm>
      <SaveForm schema={schema} source={{ id: 2, values }} save={async () => undefined} confirm>
        {(f) => <f.Actions submitLabel="둘째 저장" />}
      </SaveForm>
    </>,
  );
  fireEvent.click(screen.getByText('첫 저장'));
  await screen.findByRole('alertdialog');
  fireEvent.click(screen.getByText('둘째 저장'));
  expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect((screen.getByText('취소') as HTMLButtonElement).disabled).toBe(true));
  expect(screen.getByRole('alertdialog').textContent).toContain('A');
  fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  await act(async () => resolve());
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});
