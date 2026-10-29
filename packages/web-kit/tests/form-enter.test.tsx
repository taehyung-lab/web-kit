// @vitest-environment jsdom
// 파일 책임: 폼 안 Enter 규칙을 실제 DOM으로 검사한다 — 일반 칸 Enter는 제출, [추가] 버튼이 딸린 칸(`rows.enterAdds`)의 Enter는 [추가],
// 대화창(`Form.Dialog`) 안 칸의 Enter는 그 대화창 폼의 확인이며 바깥 폼은 제출·검증되지 않는다.
// jsdom은 Enter로 폼을 제출하지 않으므로, 브라우저처럼 "막히지 않은 Enter는 그 칸의 폼을 제출한다"를 `pressEnter`가 흉내 낸다.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { useState } from 'react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { useSaveForm } from '../src/form';
import { Form, FormGuard } from '../../ui-registry/src/form/ui';

afterEach(cleanup);
beforeAll(() => {
  window.scrollTo = vi.fn();
});

/** 브라우저의 Enter: keydown이 막히지 않으면 그 칸이 속한 폼을 제출한다(암묵 제출). */
async function pressEnter(input: HTMLElement) {
  await act(async () => {
    const notPrevented = fireEvent.keyDown(input, { key: 'Enter' });
    if (notPrevented) (input as HTMLInputElement).form?.requestSubmit();
  });
}

const schema = z.object({
  title: z.string().min(1, '제목 필요'),
  tags: z.array(z.object({ key: z.string(), value: z.string() })),
  code: z.string(),
});
type Values = z.input<typeof schema>;
const F = Form.of<Values>();
const inner = z.object({ code: z.string().min(1, '코드 필요') });
const I = Form.of<z.input<typeof inner>>();

/** 일반 칸(제목), [추가]가 딸린 태그 칸, 대화창 안 코드 칸을 가진 화면. */
async function mount(title: string) {
  const outerSave = vi.fn(async () => undefined);
  const innerSave = vi.fn(async () => undefined);
  function Screen() {
    const [open, setOpen] = useState(false);
    const editor = useSaveForm({ schema, source: { id: 1, values: { title, tags: [], code: '' } }, save: outerSave });
    const [draft, setDraft] = useState('');
    return (
      <F editor={editor}>
        <F.Text name="title" label="제목" />
        <F.Array name="tags">
          {(rows) => {
            const add = () => {
              if (draft.trim() === '') return;
              rows.append({ key: draft, value: draft });
              setDraft('');
            };
            return (
              <div>
                <input aria-label="태그" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={rows.enterAdds(add)} />
                <button type="button" onClick={add}>
                  추가
                </button>
                <ul aria-label="태그 목록">
                  {rows.items.map((item) => (
                    <li key={item.key}>{item.value}</li>
                  ))}
                </ul>
              </div>
            );
          }}
        </F.Array>
        <p>코드: {editor.form.state.values.code}</p>
        <button type="button" onClick={() => setOpen(true)}>
          코드 입력
        </button>
        <F.Submit />
        {open ? (
          <F.Dialog title="코드 입력" onClose={() => setOpen(false)}>
            <CodeForm
              save={async (code) => {
                await innerSave();
                editor.form.setFieldValue('code', code);
                setOpen(false);
              }}
            />
          </F.Dialog>
        ) : null}
      </F>
    );
  }
  function CodeForm({ save }: { readonly save: (code: string) => Promise<void> }) {
    const editor = useSaveForm({ schema: inner, source: { id: 'c', values: { code: '' } }, save: async (values) => save(values.code) });
    return (
      <I editor={editor} protect={false}>
        <I.Text name="code" label="코드" />
        <I.Submit>확인</I.Submit>
      </I>
    );
  }
  const root = createRootRoute({ component: () => <FormGuard><Outlet /></FormGuard> });
  const page = createRoute({ getParentRoute: () => root, path: '/', component: Screen });
  const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory({ initialEntries: ['/'] }) });
  await act(async () => {
    render(<RouterProvider router={router} />);
    await router.load();
  });
  return { outerSave, innerSave };
}

const invalidCount = () => document.querySelectorAll('[aria-invalid="true"]').length;

it('일반 칸의 Enter는 폼을 한 번 제출한다', async () => {
  const { outerSave } = await mount('공연');
  await pressEnter(screen.getByLabelText('제목', { exact: false }));
  await waitFor(() => expect(outerSave).toHaveBeenCalledTimes(1));
});

it('[추가]가 딸린 칸의 Enter는 [추가]를 한 번 누른 것과 같고, 폼은 제출·검증되지 않는다', async () => {
  // 제목이 비어 있어 제출되면 검증 오류가 생긴다.
  const { outerSave } = await mount('');
  fireEvent.change(screen.getByLabelText('태그'), { target: { value: 'VIP' } });
  await pressEnter(screen.getByLabelText('태그'));
  expect(within(screen.getByRole('list', { name: '태그 목록' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['VIP']);
  expect((screen.getByLabelText('태그') as HTMLInputElement).value).toBe('');
  await act(async () => undefined);
  expect(outerSave).not.toHaveBeenCalled();
  expect(invalidCount()).toBe(0);
  expect(screen.queryByText('제목 필요')).toBeNull();
});

it('대화창 안 칸의 Enter는 그 대화창 폼의 확인이고, 바깥 폼은 제출·검증되지 않는다', async () => {
  const { outerSave, innerSave } = await mount('');
  fireEvent.click(screen.getByText('코드 입력'));
  const dialog = await screen.findByRole('dialog', { name: '코드 입력' });
  fireEvent.change(within(dialog).getByLabelText('코드', { exact: false }), { target: { value: 'K1' } });
  await pressEnter(within(dialog).getByLabelText('코드', { exact: false }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '코드 입력' })).toBeNull());
  expect(innerSave).toHaveBeenCalledTimes(1);
  expect(screen.getByText('코드: K1')).toBeTruthy();
  expect(outerSave).not.toHaveBeenCalled();
  expect(invalidCount()).toBe(0);
});
