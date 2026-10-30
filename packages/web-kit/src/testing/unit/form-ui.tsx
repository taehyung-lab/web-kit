// 파일 책임: form-ui 복사본의 공통 적합성 기준과 단언을 소유한다.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Link, Outlet, RouterProvider } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeAll, expect, it as baseIt, vi } from 'vitest';
import { z } from 'zod';
import { RequestFailure } from '../../failure';
import { useSaveForm, type SaveFormOptions } from '../../form/save-form';
import type * as Contract0 from '../contracts/form/ui';
import { conformanceTitle, type ConformanceTarget } from '../target.mjs';

/** 소비처가 넘긴 실제 복사본으로 form-ui 보장 전체를 등록한다. */
export function checkFormUiConformance({ Form, FormGuard, useLeave }: { Form: typeof Contract0.Form; FormGuard: typeof Contract0.FormGuard; useLeave: typeof Contract0.useLeave }, target: ConformanceTarget) {
  const it = baseIt;
  const title = (id: string, label: string) => conformanceTitle(id, target, label);
// @vitest-environment jsdom
// 파일 책임: Form 묶음 부품과 FormGuard를 실제 메모리 Router 위에서 소비해 입력·저장·확인·이탈의 화면 결과를 검사한다.

afterEach(cleanup);
beforeAll(() => {
  window.scrollTo = vi.fn();
});

// 연락처는 '필요'를 체크했을 때만 필수다(다른 칸 오류가 있어도 도는 규칙).
const schema = z
  .object({ name: z.string().min(1, '이름 필요'), contact: z.string(), needed: z.boolean(), kind: z.string().min(1, '종류 필요') })
  .superRefine(
    (value, ctx) => {
      if (value.needed && value.contact === '') ctx.addIssue({ code: 'custom', path: ['contact'], message: '연락처 필요' });
    },
    { when: () => true },
  );
type Values = z.input<typeof schema>;
const values: Values = { name: 'A', contact: '', needed: false, kind: 'x' };
const F = Form.of<Values>();

/** 편집 화면과 완료 화면 두 경로를 실제 Router에 연결한다. */
// 검사 전용 memory router의 /done은 소비처 Register 타입과 별개다.
async function mount(node: () => ReactNode) {
  const root = createRootRoute({
    component: () => (
      <FormGuard messages={{ cancel: { title: '작성을 취소할까요?' } }}>
        <Link to={'/done' as never}>다른 화면</Link>
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
function Editor(props: Partial<SaveFormOptions<Values, z.output<typeof schema>>> & { readonly children?: ReactNode; readonly protect?: boolean }) {
  const editor = useSaveForm({ schema, source: { id: 1, values }, save: async () => undefined, ...props });
  return (
    <F editor={editor} protect={props.protect} renderFailure={(failure) => (failure instanceof RequestFailure && failure.kind === 'forbidden' ? null : undefined)}>
      <F.Failure />
      <F.Text name="name" label="이름" />
      <F.Checkbox name="needed" label="필요" />
      <F.Text name="contact" label="연락처" />
      <F.Submit />
      <F.Cancel to={{ to: '/done' as never }} />
      {props.children}
    </F>
  );
}

it(title('G063', 'F4 검증 실패는 저장 0건이고 화면 순서의 첫 오류 칸으로 focus하며, 입력 중 칸을 다시 만들지 않는다'), async () => {
  const save = vi.fn(async () => undefined);
  await mount(() => <Editor save={save} />);
  const input = screen.getByRole('textbox', { name: '이름' });
  fireEvent.change(input, { target: { value: '' } });
  expect(screen.getByRole('textbox', { name: '이름' })).toBe(input);
  // 필수 표시는 schema에서 나온다: 이름은 늘, 연락처는 '필요'를 체크했을 때만.
  expect(screen.getByRole('textbox', { name: '이름' }).getAttribute('aria-required')).toBe('true');
  expect(screen.getByRole('textbox', { name: '연락처' }).getAttribute('aria-required')).toBe('false');
  fireEvent.click(screen.getByLabelText('필요', { exact: false }));
  expect(screen.getByRole('textbox', { name: '연락처' }).getAttribute('aria-required')).toBe('true');
  expect(screen.getByText('연락처').querySelector('.wk-required')).not.toBeNull();
  fireEvent.click(screen.getByLabelText('필요', { exact: false }));
  expect(screen.getByRole('textbox', { name: '연락처' }).getAttribute('aria-required')).toBe('false');
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect(document.activeElement).toBe(input));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toBe('이름 필요');
  expect(input.getAttribute('aria-invalid')).toBe('true');
});

it(title('G064', 'F4(5단계 교정) 서버 필드 오류가 고칠 수 없는(disabled) 칸으로 대응되면 칸에 붙은 것으로 세지 않고 폼 한 줄로 알린다'), async () => {
  function Screen() {
    const editor = useSaveForm({
      schema,
      source: { id: 1, values },
      save: async () => {
        throw new RequestFailure({ kind: 'validation', status: 400, fieldErrors: [{ field: 'contact', code: 'Bad' }] });
      },
      fieldError: (error) => (error.field === 'contact' ? { field: 'contact', message: '연락처 거절' } : undefined),
    });
    return (
      <F editor={editor} renderFailure={() => '저장 실패 한 줄'}>
        <F.Failure />
        <F.Text name="name" label="이름" />
        <F.Text name="contact" label="연락처" disabled />
        <F.Submit />
      </F>
    );
  }
  await mount(() => <Screen />);
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await screen.findByText('저장 실패 한 줄');
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.queryByText('연락처 거절')).toBeNull();
});

it(title('G065', 'F5 입력칸을 프로젝트 부품으로 바꿔도 값·검증·오류 focus가 그대로다'), async () => {
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
  const input = screen.getByLabelText('사용자 이름', { exact: false });
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect(document.activeElement).toBe(input));
  expect(save).not.toHaveBeenCalled();
  expect(input.getAttribute('aria-describedby')).toContain('-error');
  fireEvent.change(input, { target: { value: 'B' } });
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
});

it(title('G066', 'F4 필드 오류가 모두 칸에 붙으면 폼 한 줄은 없고, 붙지 못한 실패는 한 줄, renderFailure가 null이면 그리지 않는다. 고칠 수 없는 칸은 오류를 숨긴다'), async () => {
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
      <F
        editor={editor}
        renderFailure={(value) => (value instanceof RequestFailure && value.kind === 'forbidden' ? null : '저장 실패 한 줄')}
      >
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

it(title('G067', 'F6 입력이 있으면 Router 이동을 이동 문구로, 취소 버튼을 취소 문구로 한 번 묻고, 답에 따라 머물거나 떠난다'), async () => {
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

it(title('G068', 'F6 입력이 없으면 묻지 않고, 저장 중 이동은 묻지 않고 거부하며, 저장 성공 뒤 이동은 묻지 않는다'), async () => {
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

it(title('form-protection-optional', '보호를 제외해도 검증·중복 제출·취소 잠금은 남고, dirty·저장 중 Router 이탈은 등록하지 않는다'), async () => {
  let finish!: () => void;
  const save = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  const onSaved = vi.fn();
  const router = await mount(() => <Editor protect={false} save={save} onSaved={onSaved} />);
  const input = screen.getByRole('textbox', { name: '이름' });
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect(document.activeElement).toBe(input));
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'B' } });
  const leave = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leave);
  expect(leave.defaultPrevented).toBe(false);
  await act(async () => { fireEvent.click(screen.getByText('저장')); fireEvent.click(screen.getByText('저장')); });
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.getByText('취소').getAttribute('aria-disabled')).toBe('true');
  await act(async () => fireEvent.click(screen.getByText('취소')));
  expect(router.state.location.pathname).toBe('/');
  await act(async () => fireEvent.click(screen.getByText('다른 화면')));
  await screen.findByText('완료 화면');
  expect(screen.queryByRole('alertdialog')).toBeNull();
  await act(async () => finish());
  expect(onSaved).not.toHaveBeenCalled();
});

it(title('form-protection-optional', '보호를 제외한 dirty 폼의 취소는 확인 없이 이동한다'), async () => {
  await mount(() => <Editor protect={false} />);
  fireEvent.change(screen.getByRole('textbox', { name: '이름' }), { target: { value: 'B' } });
  fireEvent.click(screen.getByText('취소'));
  await screen.findByText('완료 화면');
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it(title('G069', 'F7 저장 완료 확인을 두 번 눌러도 다음 이동은 한 번이고, 그 이동은 묻지 않는다'), async () => {
  const onSaved = vi.fn(async () => {
    await router.navigate({ to: '/done' as never });
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

it(title('G070', 'F3 저장 뒤 완료 처리가 실패하면 저장을 다시 눌러도 요청이 나가지 않고, 다시 시도는 완료 처리만 한다'), async () => {
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

it(title('G071', 'F8 저장 확인창은 제출 값을 보이고, 저장 중에는 Esc로 닫히지 않으며, 저장 버튼은 disabled가 아니라 aria-disabled로 잠긴다'), async () => {
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

it(title('G072', 'F8 확인창은 마지막 버튼의 Tab을 같은 이벤트 안에서 첫 버튼으로, 첫 버튼의 Shift+Tab을 마지막으로 옮긴다(창 밖 guard를 거치지 않는다)'), async () => {
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
  // jsdom에는 배치 계산이 없다. 이 검사에서 보이는 두 버튼의 기하만 제공하며 실제 표시 여부는 브라우저 검사로 검증한다.
  for (const button of [cancel, confirm]) button.getClientRects = () => [new DOMRect(0, 0, 80, 32)] as unknown as DOMRectList;
  confirm.focus();
  const forward = fireEvent.keyDown(confirm, { key: 'Tab' });
  expect(forward).toBe(false);
  expect(document.activeElement).toBe(cancel);
  const backward = fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
  expect(backward).toBe(false);
  expect(document.activeElement).toBe(confirm);
  expect(dialog.contains(document.activeElement)).toBe(true);
});

it(title('G073', '대화창 안 폼의 닫기·취소는 그 안 폼만 보고 묻고, 바깥 폼은 남는다. 안쪽 제출은 바깥 폼을 제출하지 않는다'), async () => {
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
  fireEvent.change(screen.getByLabelText('바깥', { exact: false }), { target: { value: 'O' } });
  await act(async () => fireEvent.click(screen.getByText('안쪽 저장')));
  expect(innerSave).toHaveBeenCalledTimes(1);
  expect(outerSave).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('안쪽', { exact: false }), { target: { value: 'B' } });
  fireEvent.click(screen.getByText('닫기'));
  await screen.findByText('작성을 취소할까요?');
  fireEvent.click(screen.getByText('취소하기'));
  await waitFor(() => expect(screen.queryByText('편집')).toBeNull());
  expect((screen.getByLabelText('바깥', { exact: false }) as HTMLInputElement).value).toBe('O');
});

it(title('G074', '선택은 값이 비었을 때만 빈 선택지를 두고, 선택지 상태(불러오는 중·실패·재시도)를 그 칸 자리에 보인다'), async () => {
  const retry = vi.fn();
  const changed = vi.fn();
  function Screen() {
    const [status, setStatus] = useState<'ready' | 'loading' | { failure: unknown }>('loading');
    const editor = useSaveForm({ schema, source: { id: 1, values: { ...values, kind: '' } }, save: async () => undefined });
    return (
      <F editor={editor} renderFailure={() => '선택지 실패'}>
        <button type="button" onClick={() => setStatus({ failure: new Error('x') })}>
          실패로
        </button>
        <button type="button" onClick={() => setStatus('ready')}>
          준비로
        </button>
        <F.Select name="kind" label="종류" options={[{ value: 'x', label: '엑스' }]} status={status} onRetry={retry} onChange={changed} />
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

it(title('G075', 'useLeave는 Router 밖 이탈(같은 메뉴 다시 누르기)을 같은 판정으로 묻는다'), async () => {
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

it(title('G076', 'Form.Choice는 필수 오류에 초점을 주고 고른 leaf 값으로 저장한다'), async () => {
  const save = vi.fn(async (_values: Values) => undefined);
  /** 공용 선택 입력의 검증과 제출을 실제 폼에 연결한다. */
  function ChoiceEditor() {
    const editor = useSaveForm({ schema, source: { id: 'choice', values: { ...values, kind: '' } }, save });
    return (
      <F editor={editor}>
        <F.Choice name="kind" label="종류" nodes={[{ value: 'x', label: '엑스' }]} appearance="dropdown" placeholder="선택" />
        <F.Submit />
      </F>
    );
  }
  await mount(() => <ChoiceEditor />);
  fireEvent.click(screen.getByText('저장'));
  const trigger = screen.getByRole('button', { name: '종류' });
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(screen.getByRole('alert').textContent).toBe('종류 필요');
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole('radio', { name: '엑스' }));
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0]?.[0]).toMatchObject({ kind: 'x' });
});
it.each(['vertical', 'horizontal', 'dropdown', 'menu'] as const)(title('form-choice-prune', 'Form.Choice %s는 트리 밖 저장값을 사용자 변경 없이 제출에서 뺀다'), async (appearance) => {
  const choiceSchema = z.object({ ids: z.array(z.string()) });
  const C = Form.of<z.input<typeof choiceSchema>>();
  let current!: ReturnType<typeof useSaveForm<z.input<typeof choiceSchema>, z.output<typeof choiceSchema>>>;
  const save = vi.fn(async (_value: z.output<typeof choiceSchema>) => undefined);
  /** 저장된 값에 현재 선택지 밖 ID를 포함한 실제 편집 화면이다. */
  function ChoiceEditor() {
    const editor = useSaveForm({ schema: choiceSchema, source: { id: 'preserve', values: { ids: ['a', 'b', 'x'] } }, save });
    current = editor;
    return <C editor={editor}><C.Choice name="ids" label="분류" multiple appearance={appearance} nodes={[
      { value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' },
    ]} /><C.Submit /></C>;
  }
  const router = await mount(() => <ChoiceEditor />);
  expect(current.form.state.values.ids).toEqual(['a', 'b', 'x']);
  if (appearance === 'dropdown' || appearance === 'menu') expect(screen.getByRole('button', { name: '분류' }).textContent).toBe('Alpha, Beta');
  fireEvent.click(screen.getByRole('link', { name: '다른 화면' }));
  await screen.findByRole('heading', { name: '완료 화면' });
  expect(screen.queryByRole('alertdialog')).toBeNull();
  await act(async () => { await router.navigate({ to: '/' as never }); });
  expect(current.isDirty).toBe(false);
  expect(current.getState().isDirty).toBe(false);
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0]?.[0]).toEqual({ ids: ['a', 'b'] });
  fireEvent.click(screen.getByRole('link', { name: '다른 화면' }));
  await screen.findByRole('heading', { name: '완료 화면' });
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it(title('form-choice-status', '선택지 로딩·실패는 원본·제출을 유지하고 재시도 성공 때만 정리한다'), async () => {
  const schema = z.object({ ids: z.array(z.string()), note: z.string() });
  const C = Form.of<z.input<typeof schema>>();
  const save = vi.fn(async (_input: z.output<typeof schema>) => undefined);
  let current!: ReturnType<typeof useSaveForm<z.input<typeof schema>, z.output<typeof schema>>>;
  let state!: (value: 'loading' | 'ready' | { failure: unknown }) => void;
  /** 같은 칸에서 지연·실패·재시도·성공을 관찰한다. */
  function Editor() {
    const [status, setStatus] = useState<'loading' | 'ready' | { failure: unknown }>('loading');
    state = setStatus;
    current = useSaveForm({ schema, source: { id: 'status', values: { ids: ['a', 'x'], note: '' } }, save });
    return <C editor={current}><C.Text name="note" label="메모" /><C.Choice name="ids" label="분류" multiple status={status} onRetry={() => setStatus('ready')} nodes={status === 'ready' ? [{ value: 'a', label: 'Alpha' }] : []} /><C.Submit /></C>;
  }
  await mount(() => <Editor />);
  expect(screen.getByRole('status').textContent).toBe('불러오는 중입니다.');
  expect(current.form.state.values.ids).toEqual(['a', 'x']);
  await act(async () => current.submit());
  expect(save.mock.lastCall?.[0]).toMatchObject({ ids: ['a', 'x'] });
  act(() => state({ failure: new Error('options') }));
  expect(screen.getByRole('alert').textContent).toContain('선택지를 불러오지 못했습니다.');
  await act(async () => current.submit());
  expect(save.mock.lastCall?.[0]).toMatchObject({ ids: ['a', 'x'] });
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(current.form.state.values.ids).toEqual(['a', 'x']);
  expect(current.getState().isDirty).toBe(false);
  fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: 'edit' } });
  expect(current.getState().isDirty).toBe(true);
  await act(async () => current.submit());
  expect(save.mock.lastCall?.[0]).toEqual({ ids: ['a'], note: 'edit' });
});
it(title('form-choice-search', '서버 검색 결과 밖의 기존 선택은 표시·제출에서 유지한다'), async () => {
  const schema = z.object({ ids: z.array(z.string()) });
  const C = Form.of<z.input<typeof schema>>();
  const save = vi.fn(async (_input: z.output<typeof schema>) => undefined);
  /** 현재 결과에 없는 x도 저장된 선택으로 보여 준다. */
  function Editor() {
    const editor = useSaveForm({ schema, source: { id: 'search', values: { ids: ['a', 'x'] } }, save });
    return <C editor={editor}><C.Choice name="ids" label="분류" multiple appearance="search" nodes={[{ value: 'a', label: 'Alpha' }]} search={async () => [{ value: 'b', label: 'Beta' }]} debounceMs={0} /><C.Submit /></C>;
  }
  await mount(() => <Editor />);
  expect(screen.getByText('Alpha, x')).toBeTruthy();
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.lastCall?.[0]).toEqual({ ids: ['a', 'x'] });
});

it.each(['vertical', 'horizontal', 'dropdown', 'menu', 'search'] as const)(title('form-choice-single', '단일 %s의 없는 저장값은 빈 선택으로 제출한다'), async (appearance) => {
  const schema = z.object({ id: z.string().optional() });
  const C = Form.of<z.input<typeof schema>>();
  const save = vi.fn(async (_input: z.output<typeof schema>) => undefined);
  /** 단일 저장값이 전체 선택지 밖인 화면이다. */
  function Editor() {
    const editor = useSaveForm({ schema, source: { id: 'single', values: { id: 'x' } }, save });
    return <C editor={editor}><C.Choice name="id" label="분류" appearance={appearance} nodes={[{ value: 'a', label: 'Alpha' }]} /><C.Submit /></C>;
  }
  await mount(() => <Editor />);
  if (appearance === 'dropdown' || appearance === 'menu') expect(screen.getByRole('button', { name: '분류' }).textContent).toBe('분류');
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.lastCall?.[0]).toEqual({ id: undefined });
});
it(title('form-choice-empty', '성공한 빈 전체 선택지는 기존 다중 저장값을 빈 배열로 제출한다'), async () => {
  const schema = z.object({ ids: z.array(z.string()) });
  const C = Form.of<z.input<typeof schema>>();
  const save = vi.fn(async (_input: z.output<typeof schema>) => undefined);
  /** ready의 빈 목록은 로딩 중 빈 목록과 구별한다. */
  function Editor() {
    const editor = useSaveForm({ schema, source: { id: 'empty', values: { ids: ['a', 'x'] } }, save });
    return <C editor={editor}><C.Choice name="ids" label="분류" multiple nodes={[]} status="ready" /><C.Submit /></C>;
  }
  await mount(() => <Editor />);
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.lastCall?.[0]).toEqual({ ids: [] });
});

}
