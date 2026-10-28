// @vitest-environment jsdom
// 파일 책임: Form 묶음 부품과 FormGuard를 실제 메모리 Router 위에서 소비해 입력·저장·확인·이탈의 화면 결과를 검사한다.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Link, Outlet, RouterProvider } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RequestFailure } from '../src/failure';
import { useSaveForm, type SaveFormOptions } from '../src/form/save-form';
import { Form, FormGuard, useLeave } from '../src/form/ui';

afterEach(cleanup);
beforeAll(() => {
  window.scrollTo = vi.fn();
});

const schema = z.object({ name: z.string().min(1, '이름 필요'), contact: z.string(), needed: z.boolean(), kind: z.string().min(1, '종류 필요') });
type Values = z.input<typeof schema>;
const values: Values = { name: 'A', contact: '', needed: false, kind: 'x' };
const F = Form.of<Values>();

/** 편집 화면과 완료 화면 두 경로를 실제 Router에 연결한다. */
async function mount(node: () => ReactNode) {
  const root = createRootRoute({
    component: () => (
      <FormGuard messages={{ cancel: { title: '작성을 취소할까요?' } }}>
        <Link to="/done">다른 화면</Link>
        <Outlet />
      </FormGuard>
    ),
  });
  const edit = createRoute({ getParentRoute: () => root, path: '/', component: node });
  const done = createRoute({ getParentRoute: () => root, path: '/done', component: () => <h1>완료 화면</h1> });
  const router = createRouter({ routeTree: root.addChildren([edit, done]), history: createMemoryHistory({ initialEntries: ['/'] }) });
  await act(async () => {
    render(<RouterProvider router={router} />);
    await router.load();
  });
  return router;
}

/** 이 파일의 기본 화면: 이름·체크·연락처(조건부 필수)·저장·취소. */
function Editor(props: Partial<SaveFormOptions<Values, z.output<typeof schema>>> & { readonly children?: ReactNode }) {
  const editor = useSaveForm({ schema, source: { id: 1, values }, save: async () => undefined, ...props });
  return (
    <F editor={editor} renderFailure={(failure) => (failure instanceof RequestFailure && failure.kind === 'forbidden' ? null : undefined)}>
      <F.Failure />
      <F.Text name="name" label="이름" required />
      <F.Checkbox name="needed" label="필요" />
      <F.Text name="contact" label="연락처" required={(v) => v.needed} />
      <F.Submit />
      <F.Cancel to={{ to: '/done' }} />
      {props.children}
    </F>
  );
}

it('F4 검증 실패는 저장 0건이고 화면 순서의 첫 오류 칸으로 focus하며, 입력 중 칸을 다시 만들지 않는다', async () => {
  const save = vi.fn(async () => undefined);
  await mount(() => <Editor save={save} />);
  const input = screen.getByRole('textbox', { name: '이름' });
  fireEvent.change(input, { target: { value: '' } });
  expect(screen.getByRole('textbox', { name: '이름' })).toBe(input);
  fireEvent.click(screen.getByLabelText('필요'));
  expect(screen.getByRole('textbox', { name: '연락처' }).getAttribute('aria-required')).toBe('true');
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect(document.activeElement).toBe(input));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toBe('이름 필요');
  expect(input.getAttribute('aria-invalid')).toBe('true');
});

it('F5 입력칸을 프로젝트 부품으로 바꿔도 값·검증·오류 focus가 그대로다', async () => {
  const save = vi.fn(async () => undefined);
  function Custom() {
    const editor = useSaveForm({ schema, source: { id: 1, values }, save });
    return (
      <F editor={editor}>
        <F.Field name="name" label="사용자 이름">
          {(control) => (
            <input
              id={control.id}
              aria-invalid={control['aria-invalid']}
              aria-describedby={control['aria-describedby']}
              data-custom
              value={control.value}
              onChange={(event) => control.change(event.target.value)}
              onBlur={control.blur}
            />
          )}
        </F.Field>
        <F.Submit />
      </F>
    );
  }
  await mount(() => <Custom />);
  const input = screen.getByLabelText('사용자 이름');
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect(document.activeElement).toBe(input));
  expect(save).not.toHaveBeenCalled();
  expect(input.getAttribute('aria-describedby')).toContain('-error');
  fireEvent.change(input, { target: { value: 'B' } });
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
});

it('F4 필드 오류가 모두 칸에 붙으면 폼 한 줄은 없고, 붙지 못한 실패는 한 줄, renderFailure가 null이면 그리지 않는다. 고칠 수 없는 칸은 오류를 숨긴다', async () => {
  let failure: unknown = new RequestFailure({ kind: 'validation', status: 400, fieldErrors: [{ field: 'name', code: 'Dup' }] });
  function Screen() {
    const editor = useSaveForm({
      schema,
      source: { id: 1, values },
      save: async () => {
        throw failure;
      },
      fieldError: (error) => (error.field === 'name' ? { field: 'name', message: '중복' } : undefined),
    });
    return (
      <F editor={editor} renderFailure={(value) => (value instanceof RequestFailure && value.kind === 'forbidden' ? null : '저장 실패 한 줄')}>
        <F.Failure />
        <F.Text name="name" label="이름" />
        <F.Text name="contact" label="연락처" disabled />
        <F.Submit />
      </F>
    );
  }
  await mount(() => <Screen />);
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await screen.findByText('중복');
  expect(screen.queryByText('저장 실패 한 줄')).toBeNull();
  failure = new RequestFailure({ kind: 'validation', status: 400, fieldErrors: [{ field: 'contact', code: 'Bad' }] });
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await screen.findByText('저장 실패 한 줄');
  failure = new RequestFailure({ kind: 'forbidden', status: 403 });
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await waitFor(() => expect(screen.queryByText('저장 실패 한 줄')).toBeNull());
  expect(screen.queryAllByRole('alert')).toHaveLength(0);
});

it('F6 입력이 있으면 Router 이동을 이동 문구로, 취소 버튼을 취소 문구로 한 번 묻고, 답에 따라 머물거나 떠난다', async () => {
  const router = await mount(() => <Editor />);
  fireEvent.change(screen.getByRole('textbox', { name: '이름' }), { target: { value: 'B' } });
  fireEvent.click(screen.getByText('다른 화면'));
  await screen.findByText('입력을 버리고 이동할까요?');
  fireEvent.click(screen.getByText('계속 편집'));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(router.state.location.pathname).toBe('/');
  fireEvent.click(screen.getByText('취소'));
  await screen.findByText('작성을 취소할까요?');
  fireEvent.click(screen.getByText('취소하기'));
  await screen.findByText('완료 화면');
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('F6 입력이 없으면 묻지 않고, 저장 중 이동은 묻지 않고 거부하며, 저장 성공 뒤 이동은 묻지 않는다', async () => {
  let resolve!: () => void;
  const pending = new Promise<void>((ok) => {
    resolve = ok;
  });
  const router = await mount(() => <Editor save={() => pending} />);
  fireEvent.change(screen.getByRole('textbox', { name: '이름' }), { target: { value: 'B' } });
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await act(async () => fireEvent.click(screen.getByText('다른 화면')));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(router.state.location.pathname).toBe('/');
  await act(async () => resolve());
  fireEvent.click(screen.getByText('다른 화면'));
  await screen.findByText('완료 화면');
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('F7 저장 완료 확인을 두 번 눌러도 다음 이동은 한 번이고, 그 이동은 묻지 않는다', async () => {
  const onSaved = vi.fn(async () => {
    await router.navigate({ to: '/done' });
  });
  function Screen() {
    const editor = useSaveForm({ schema, source: { id: 1, values }, save: async () => undefined, acknowledge: true, onSaved });
    return (
      <F editor={editor}>
        <F.Text name="name" label="이름" />
        <F.Submit />
        <F.Saved>저장했습니다.</F.Saved>
      </F>
    );
  }
  const router = await mount(() => <Screen />);
  fireEvent.change(screen.getByRole('textbox', { name: '이름' }), { target: { value: 'B' } });
  await act(async () => fireEvent.click(screen.getByText('저장')));
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  await act(async () => {
    fireEvent.click(screen.getByText('확인'));
    fireEvent.click(screen.getByText('확인'));
  });
  await screen.findByText('완료 화면');
  expect(onSaved).toHaveBeenCalledTimes(1);
});

it('F3 저장 뒤 완료 처리가 실패하면 저장을 다시 눌러도 요청이 나가지 않고, 다시 시도는 완료 처리만 한다', async () => {
  const save = vi.fn(async () => undefined);
  let fail = true;
  const onSaved = vi.fn(() => {
    if (fail) throw new Error('이동 실패');
  });
  await mount(() => <Editor save={save} onSaved={onSaved} />);
  fireEvent.change(screen.getByRole('textbox', { name: '이름' }), { target: { value: 'B' } });
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await screen.findByText('저장은 완료됐지만 다음 작업을 진행하지 못했습니다.');
  await act(async () => fireEvent.click(screen.getByText('저장')));
  expect(save).toHaveBeenCalledTimes(1);
  fail = false;
  await act(async () => fireEvent.click(screen.getByText('다시 시도')));
  expect(onSaved).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByText('저장은 완료됐지만 다음 작업을 진행하지 못했습니다.')).toBeNull());
});

it('F8 저장 확인창은 제출 값을 보이고, 저장 중에는 Esc로 닫히지 않으며, 저장 버튼은 disabled가 아니라 aria-disabled로 잠긴다', async () => {
  let resolve!: () => void;
  const promise = new Promise<void>((ok) => {
    resolve = ok;
  });
  function Screen() {
    const editor = useSaveForm({ schema, source: { id: 1, values }, save: () => promise, confirm: true });
    return (
      <F editor={editor}>
        <F.Text name="name" label="이름" />
        <F.Submit>폼 저장</F.Submit>
        <F.Confirm confirmLabel="저장하기">{(v) => <p>{v.name}</p>}</F.Confirm>
      </F>
    );
  }
  await mount(() => <Screen />);
  const submit = screen.getByText('폼 저장') as HTMLButtonElement;
  await act(async () => fireEvent.click(submit));
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog.textContent).toContain('A');
  expect(submit.disabled).toBe(false);
  expect(submit.getAttribute('aria-disabled')).toBe('true');
  expect(dialog.contains(document.activeElement)).toBe(true);
  fireEvent.click(screen.getByText('저장하기'));
  await waitFor(() => expect((screen.getByText('취소') as HTMLButtonElement).disabled).toBe(true));
  fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  await act(async () => resolve());
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

it('F8 확인창은 마지막 버튼의 Tab을 같은 이벤트 안에서 첫 버튼으로, 첫 버튼의 Shift+Tab을 마지막으로 옮긴다(창 밖 guard를 거치지 않는다)', async () => {
  function Screen() {
    const editor = useSaveForm({ schema, source: { id: 1, values }, save: async () => undefined, confirm: true });
    return (
      <F editor={editor}>
        <F.Submit>폼 저장</F.Submit>
        <F.Confirm confirmLabel="저장하기" />
      </F>
    );
  }
  await mount(() => <Screen />);
  await act(async () => fireEvent.click(screen.getByText('폼 저장')));
  const dialog = await screen.findByRole('alertdialog');
  const cancel = screen.getByText('취소');
  const confirm = screen.getByText('저장하기');
  confirm.focus();
  const forward = fireEvent.keyDown(confirm, { key: 'Tab' });
  expect(forward).toBe(false);
  expect(document.activeElement).toBe(cancel);
  const backward = fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
  expect(backward).toBe(false);
  expect(document.activeElement).toBe(confirm);
  expect(dialog.contains(document.activeElement)).toBe(true);
});

it('대화창 안 폼의 닫기·취소는 그 안 폼만 보고 묻고, 바깥 폼은 남는다. 안쪽 제출은 바깥 폼을 제출하지 않는다', async () => {
  const outerSave = vi.fn(async () => undefined);
  const innerSave = vi.fn(async () => undefined);
  function Example() {
    const [open, setOpen] = useState(true);
    const outer = useSaveForm({ schema, source: { id: 'outer', values }, save: outerSave });
    return (
      <F editor={outer}>
        <F.Text name="name" label="바깥" />
        {open ? (
          <F.Dialog title="편집" onClose={() => setOpen(false)}>
            <Inner />
          </F.Dialog>
        ) : null}
      </F>
    );
  }
  function Inner() {
    const inner = useSaveForm({ schema, source: { id: 'inner', values }, save: innerSave });
    return (
      <F editor={inner}>
        <F.Text name="name" label="안쪽" />
        <F.Submit>안쪽 저장</F.Submit>
        <F.Cancel>닫기</F.Cancel>
      </F>
    );
  }
  await mount(() => <Example />);
  fireEvent.change(screen.getByLabelText('바깥'), { target: { value: 'O' } });
  await act(async () => fireEvent.click(screen.getByText('안쪽 저장')));
  expect(innerSave).toHaveBeenCalledTimes(1);
  expect(outerSave).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('안쪽'), { target: { value: 'B' } });
  fireEvent.click(screen.getByText('닫기'));
  await screen.findByText('작성을 취소할까요?');
  fireEvent.click(screen.getByText('취소하기'));
  await waitFor(() => expect(screen.queryByText('편집')).toBeNull());
  expect((screen.getByLabelText('바깥') as HTMLInputElement).value).toBe('O');
});

it('선택은 값이 비었을 때만 빈 선택지를 두고, 선택지 상태(불러오는 중·실패·재시도)를 그 칸 자리에 보인다', async () => {
  const retry = vi.fn();
  const changed = vi.fn();
  function Screen() {
    const [status, setStatus] = useState<'ready' | 'loading' | { failure: unknown }>('loading');
    const editor = useSaveForm({ schema, source: { id: 1, values: { ...values, kind: '' } }, save: async () => undefined });
    return (
      <F editor={editor} renderFailure={() => '선택지 실패'}>
        <button type="button" onClick={() => setStatus({ failure: new Error('x') })}>실패로</button>
        <button type="button" onClick={() => setStatus('ready')}>준비로</button>
        <F.Select
          name="kind"
          label="종류"
          options={[{ value: 'x', label: '엑스' }]}
          status={status}
          onRetry={retry}
          onChange={changed}
        />
        <F.Submit />
      </F>
    );
  }
  await mount(() => <Screen />);
  expect(screen.getByRole('status').textContent).toBe('불러오는 중입니다.');
  fireEvent.click(screen.getByText('실패로'));
  expect(screen.getByRole('alert').textContent).toContain('선택지 실패');
  fireEvent.click(screen.getByText('다시 시도'));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(document.activeElement?.getAttribute('role')).toBe('group');
  fireEvent.click(screen.getByText('준비로'));
  const select = screen.getByRole('combobox', { name: '종류' }) as HTMLSelectElement;
  expect(Array.from(select.options).map((option) => option.value)).toEqual(['', 'x']);
  fireEvent.change(select, { target: { value: 'x' } });
  expect(changed).toHaveBeenCalledWith('x');
  expect(Array.from(select.options).map((option) => option.value)).toEqual(['x']);
});

it('useLeave는 Router 밖 이탈(같은 메뉴 다시 누르기)을 같은 판정으로 묻는다', async () => {
  const run = vi.fn();
  function Menu() {
    const leave = useLeave();
    return (
      <button type="button" onClick={() => leave(run)}>
        메뉴
      </button>
    );
  }
  await mount(() => (
    <>
      <Menu />
      <Editor />
    </>
  ));
  fireEvent.click(screen.getByText('메뉴'));
  expect(run).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole('textbox', { name: '이름' }), { target: { value: 'B' } });
  fireEvent.click(screen.getByText('메뉴'));
  await screen.findByText('입력을 버리고 이동할까요?');
  expect(run).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('이동'));
  expect(run).toHaveBeenCalledTimes(2);
});
