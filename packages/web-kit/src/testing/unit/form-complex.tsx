// 파일 책임: form-complex 복사본의 공통 적합성 기준과 단언을 소유한다.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeAll, expect, it as baseIt, vi } from 'vitest';
import { z } from 'zod';
import { RequestFailure } from '../../failure';
import { FormRejection, useSaveForm, type FormFileValue } from '../../form';
import type * as Contract0 from '../contracts/form/ui';
import { conformanceTitle, type ConformanceTarget } from '../target.mjs';

/** 소비처가 넘긴 실제 복사본으로 form-complex 보장 전체를 등록한다. */
export function checkFormComplexConformance({ Form, FormGuard }: { Form: typeof Contract0.Form; FormGuard: typeof Contract0.FormGuard }, target: ConformanceTarget) {
  const it = baseIt;
  const title = (id: string, label: string) => conformanceTitle(id, target, label);
// @vitest-environment jsdom
// 파일 책임: 복잡한 폼(공연 폼 같은 배열·모달·파일)의 키트 보장을 실제 DOM으로 검사한다(3.0 6단계 C1~C3·C5·C7·C9).
// 배열 줄 작업 뒤 오류 위치(중첩 포함), 저장 중 줄 작업 뒤 늦은 서버 오류, 모달 하위 폼 격리, 파일 보존, 저장 중 표시.

afterEach(cleanup);
beforeAll(() => {
  window.scrollTo = vi.fn();
});

/** 실제 메모리 Router + FormGuard 위에 화면 하나를 올린다. */
async function mount(node: () => ReactNode) {
  const root = createRootRoute({ component: () => <FormGuard><Outlet /></FormGuard> });
  const page = createRoute({ getParentRoute: () => root, path: '/', component: node });
  const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory({ initialEntries: ['/'] }) });
  await act(async () => {
    render(<RouterProvider router={router} />);
    await router.load();
  });
  return router;
}

/** 서버 필드 오류 거절. */
const rejected = (...fields: string[]) =>
  new RequestFailure({ kind: 'validation', status: 400, fieldErrors: fields.map((field) => ({ field, code: 'INVALID' })) });

/** 밖에서 끝낼 수 있는 저장. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const invalid = (label: string) => screen.getByLabelText(label, { exact: false }).getAttribute('aria-invalid') === 'true';

// ─── 배열 ─────────────────────────────────────────────────────────────────

const row = z.object({ key: z.string(), v: z.string().min(1, '값 필요') });
const nestedSchema = z.object({ groups: z.array(z.object({ name: z.string(), keys: z.array(row) })) });
type Nested = z.input<typeof nestedSchema>;
const N = Form.of<Nested>();

/** 판매처 API 대화창 모양: 묶음(바깥 줄)마다 키 줄(안쪽 줄)을 더하고 지우고 옮긴다. 칸 이름은 줄 key로 붙인다. */
function NestedEditor({ save, initial }: { readonly save: (values: Nested) => Promise<unknown>; readonly initial: Nested }) {
  const editor = useSaveForm({
    schema: nestedSchema,
    source: { id: 1, values: initial },
    save: async (_values, submitted) => {
      await save(submitted);
    },
    fieldError: (error) => ({ field: error.field as never, message: `서버:${error.field}` }),
  });
  return (
    <N editor={editor} protect={false}>
      <N.Failure />
      {editor.form.state.values.groups.map((group, g) => (
        <N.Array key={group.name} name={`groups[${g}].keys` as never}>
          {(rows) =>
            (rows.items as Nested['groups'][number]['keys']).map((item, k) => (
              <div key={item.key}>
                <N.Text name={`groups[${g}].keys[${k}].v` as never} label={`키 ${item.key}`} />
                <button type="button" onClick={() => rows.remove(k)}>{`지우기 ${item.key}`}</button>
                <button type="button" onClick={() => rows.move(k, 0)}>{`맨 위로 ${item.key}`}</button>
              </div>
            ))
          }
        </N.Array>
      ))}
      <N.Submit />
    </N>
  );
}

const NESTED: Nested = {
  groups: [
    { name: 'g0', keys: [{ key: 'a', v: 'a' }, { key: 'b', v: '' }, { key: 'c', v: 'c' }] },
    { name: 'g1', keys: [{ key: 'd', v: 'd' }, { key: 'e', v: 'e' }] },
  ],
};

it(title('G041', 'C1 중첩 배열에서 줄을 지우고 옮겨도 클라이언트 오류는 그 줄의 칸에 남는다'), async () => {
  const save = vi.fn(async () => undefined);
  await mount(() => <NestedEditor save={save} initial={NESTED} />);
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect(invalid('키 b')).toBe(true));
  expect(save).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByText('지우기 a')));
  await waitFor(() => expect(invalid('키 b')).toBe(true));
  expect(['키 c', '키 d', '키 e'].filter(invalid)).toEqual([]);
  await act(async () => fireEvent.click(screen.getByText('맨 위로 c')));
  await waitFor(() => expect(invalid('키 b')).toBe(true));
  expect(['키 c', '키 d', '키 e'].filter(invalid)).toEqual([]);
});

it(title('G042', 'C2 서버 오류는 지목한 중첩 줄의 칸에 붙고, 줄을 지우거나 옮겨도 그 줄을 따라가며 다른 묶음의 오류를 끌어오지 않는다'), async () => {
  const save = vi.fn(async () => {
    throw rejected('groups[0].keys[2].v', 'groups[1].keys[1].v');
  });
  await mount(() => <NestedEditor save={save} initial={NESTED} />);
  fireEvent.change(screen.getByLabelText('키 b', { exact: false }), { target: { value: 'b' } });
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await waitFor(() => expect(invalid('키 c')).toBe(true));
  expect(['키 a', '키 b', '키 c', '키 d', '키 e'].filter(invalid)).toEqual(['키 c', '키 e']);
  // 바깥 묶음 번호를 잘못 바꾸는 작업이면 g1의 1번 줄(e) 오류가 g0의 1번 줄로 복사되거나 c의 오류가 사라진다.
  await act(async () => fireEvent.click(screen.getByText('지우기 b')));
  expect(['키 a', '키 c', '키 d', '키 e'].filter(invalid)).toEqual(['키 c', '키 e']);
  await act(async () => fireEvent.click(screen.getByText('맨 위로 c')));
  expect(['키 a', '키 c', '키 d', '키 e'].filter(invalid)).toEqual(['키 c', '키 e']);
  expect(within(screen.getByLabelText('키 c', { exact: false }).parentElement!).getByRole('alert').textContent).toBe('서버:groups[0].keys[2].v');
  await act(async () => fireEvent.click(screen.getByText('지우기 d')));
  expect(['키 a', '키 c', '키 e'].filter(invalid)).toEqual(['키 c', '키 e']);
});

const flatSchema = z.object({ rows: z.array(row) });
type Flat = z.input<typeof flatSchema>;
const R = Form.of<Flat>();

/** 회차 줄 모양(한 단계 배열). 저장은 밖에서 끝낸다. */
function FlatEditor({ save, initial }: { readonly save: () => Promise<unknown>; readonly initial: Flat }) {
  const editor = useSaveForm({
    schema: flatSchema,
    source: { id: 1, values: initial },
    save: async () => {
      await save();
    },
    fieldError: (error) => ({ field: error.field as never, message: '서버 거절' }),
  });
  return (
    <R editor={editor} protect={false}>
      <R.Failure />
      <R.Array name="rows">
        {(rows) =>
          rows.items.map((item, i) => (
            <div key={item.key}>
              <R.Text name={`rows[${i}].v`} label={`회차 ${item.key}`} />
              <button type="button" onClick={() => rows.remove(i)}>{`지우기 ${item.key}`}</button>
              <button type="button" onClick={() => rows.move(i, rows.items.length - 1)}>{`맨 아래로 ${item.key}`}</button>
            </div>
          ))
        }
      </R.Array>
      <R.Submit />
    </R>
  );
}

// 같은 값(종료 시각 18:00)을 가진 줄이 있다. 번호만 보고 붙이면 저장 중 앞 줄을 지웠을 때 다른 줄에 붙는다.
const FLAT: Flat = { rows: [{ key: 'w', v: '17:00' }, { key: 'x', v: '19:00' }, { key: 'y', v: '18:00' }, { key: 'z', v: '18:00' }] };

it(title('G043', 'C3 저장 중 앞 줄을 지운 뒤 온 서버 오류는 제출한 그 줄(지금 위치)에 붙고, 같은 값의 다른 줄에 붙지 않는다'), async () => {
  const pending = deferred();
  await mount(() => <FlatEditor save={() => pending.promise} initial={FLAT} />);
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await act(async () => fireEvent.click(screen.getByText('지우기 w')));
  await act(async () => pending.reject(rejected('rows[2].v')));
  await waitFor(() => expect(invalid('회차 y')).toBe(true));
  expect(invalid('회차 z')).toBe(false);
  expect(invalid('회차 x')).toBe(false);
  expect(screen.queryByText('저장하지 못했습니다. 입력을 확인해 주세요.')).toBeNull();
});

it(title('G044', 'C3 저장 중 옮긴 줄은 옮긴 자리에서, 지운 줄의 서버 오류는 칸 대신 폼 한 줄로 알린다'), async () => {
  const first = deferred();
  const second = deferred();
  const saves = [first, second];
  await mount(() => <FlatEditor save={() => saves.shift()!.promise} initial={FLAT} />);
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await act(async () => fireEvent.click(screen.getByText('맨 아래로 y')));
  await act(async () => first.reject(rejected('rows[2].v')));
  await waitFor(() => expect(invalid('회차 y')).toBe(true));
  expect(['회차 w', '회차 x', '회차 z'].filter(invalid)).toEqual([]);

  await act(async () => fireEvent.click(screen.getByText('저장')));
  await act(async () => fireEvent.click(screen.getByText('지우기 x')));
  await act(async () => second.reject(rejected('rows[1].v')));
  await screen.findByText('저장하지 못했습니다. 입력을 확인해 주세요.');
  expect(['회차 w', '회차 y', '회차 z'].filter(invalid)).toEqual([]);
});

it(title('G045', 'C3 화면 절차 거절(FormRejection)도 저장 중 옮긴 줄을 따라 지금 자리에 붙고, root는 폼 한 줄에 보인다'), async () => {
  const pending = deferred();
  await mount(() => <FlatEditor save={() => pending.promise} initial={FLAT} />);
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await act(async () => fireEvent.click(screen.getByText('맨 아래로 y')));
  await act(async () => pending.reject(new FormRejection([{ field: 'rows[2].v', message: '절차 거절' }], '입장 정보를 확인하지 못했습니다')));
  await waitFor(() => expect(invalid('회차 y')).toBe(true));
  expect(['회차 w', '회차 x', '회차 z'].filter(invalid)).toEqual([]);
  expect(within(screen.getByLabelText('회차 y', { exact: false }).parentElement!).getByRole('alert').textContent).toBe('절차 거절');
  await screen.findByText('입장 정보를 확인하지 못했습니다');
});

// ─── 모달 하위 폼 ───────────────────────────────────────────────────────────

const outerSchema = z.object({ title: z.string().min(1, '제목 필요'), keys: z.string() });
type Outer = z.input<typeof outerSchema>;
const innerSchema = z.object({ key: z.string().min(1, '키 필요') });
type Inner = z.input<typeof innerSchema>;
const O = Form.of<Outer>();
const I = Form.of<Inner>();

it(title('G046', 'C5 모달 하위 폼의 제출(Enter)은 하위 폼만 검증·저장하고, 바깥 폼의 오류·저장·이탈 확인과 섞이지 않는다'), async () => {
  const outerSave = vi.fn(async () => undefined);
  const innerSave = vi.fn(async () => undefined);
  function Screen() {
    const [open, setOpen] = useState(false);
    const outer = useSaveForm({ schema: outerSchema, source: { id: 'o', values: { title: '', keys: '' } }, save: outerSave });
    return (
      <O editor={outer}>
        <O.Text name="title" label="제목" />
        <p>키: {outer.form.state.values.keys}</p>
        <button type="button" onClick={() => setOpen(true)}>
          키 입력
        </button>
        <O.Submit />
        {open ? (
          <O.Dialog title="키 입력" onClose={() => setOpen(false)}>
            <InnerForm
              save={async (key) => {
                await innerSave();
                outer.form.setFieldValue('keys', key);
                setOpen(false);
              }}
            />
          </O.Dialog>
        ) : null}
      </O>
    );
  }
  function InnerForm({ save }: { readonly save: (key: string) => Promise<void> }) {
    const inner = useSaveForm({ schema: innerSchema, source: { id: 'i', values: { key: '' } }, save: async (values) => save(values.key) });
    return (
      <I editor={inner}>
        <I.Text name="key" label="키" />
        <I.Submit>확인</I.Submit>
        <I.Cancel>닫기</I.Cancel>
      </I>
    );
  }
  await mount(() => <Screen />);
  // 바깥은 제목이 비어 무효이고, 다른 칸 입력으로 dirty다.
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect(invalid('제목')).toBe(true));
  fireEvent.change(screen.getByLabelText('제목', { exact: false }), { target: { value: 'T' } });
  fireEvent.change(screen.getByLabelText('제목', { exact: false }), { target: { value: '' } });
  fireEvent.click(screen.getByText('키 입력'));
  const dialog = await screen.findByRole('dialog', { name: '키 입력' });
  const key = within(dialog).getByLabelText('키', { exact: false });

  // Enter(빈 값): 하위 폼만 검증한다. 바깥 저장·확인창 없음, 바깥 오류 그대로(새로 생기거나 사라지지 않음).
  await act(async () => fireEvent.submit(key.closest('form')!));
  await waitFor(() => expect(key.getAttribute('aria-invalid')).toBe('true'));
  expect(document.activeElement).toBe(key);
  expect(innerSave).not.toHaveBeenCalled();
  expect(outerSave).not.toHaveBeenCalled();

  // 닫기: 하위 폼이 비어 있으면 바깥이 dirty여도 묻지 않고 닫는다.
  fireEvent.click(within(dialog).getByText('닫기'));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '키 입력' })).toBeNull());
  expect(screen.queryByRole('alertdialog')).toBeNull();

  // 다시 열어 Enter로 확인: 하위 저장 1회, 바깥 저장 0회, 바깥 값에 들어가고 이탈 확인 없이 닫힌다.
  fireEvent.click(screen.getByText('키 입력'));
  const again = await screen.findByRole('dialog', { name: '키 입력' });
  fireEvent.change(within(again).getByLabelText('키', { exact: false }), { target: { value: 'K1' } });
  await act(async () => fireEvent.submit(within(again).getByLabelText('키', { exact: false }).closest('form')!));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '키 입력' })).toBeNull());
  expect(innerSave).toHaveBeenCalledTimes(1);
  expect(outerSave).not.toHaveBeenCalled();
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.getByText('키: K1')).toBeTruthy();
  expect(invalid('제목')).toBe(true);
});

// ─── 파일 ─────────────────────────────────────────────────────────────────

const fileSchema = z.object({
  title: z.string().min(1, '제목 필요'),
  seat: z.custom<FormFileValue>((value) => (value as FormFileValue).kind === 'selected' || (value as FormFileValue).kind === 'existing', '파일 필요'),
});
type WithFile = z.input<typeof fileSchema>;
const P = Form.of<WithFile>();

/** 좌석도 파일과 제목. 파일 칸은 숨기거나(재마운트) 대화창을 열고 닫을 수 있다. */
function FileEditor({ save }: { readonly save: (values: WithFile) => Promise<unknown> }) {
  const [shown, setShown] = useState(true);
  const [open, setOpen] = useState(false);
  const editor = useSaveForm({
    schema: fileSchema,
    source: { id: 1, values: { title: '', seat: { kind: 'empty' } } },
    save: async (_values, submitted) => {
      await save(submitted);
    },
  });
  return (
    <P editor={editor}>
      <P.Failure />
      <P.Text name="title" label="제목" />
      {shown ? <P.File name="seat" label="좌석도" accept=".png" /> : null}
      <button type="button" onClick={() => setShown((value) => !value)}>
        좌석도 접기
      </button>
      <button type="button" onClick={() => setOpen(true)}>
        대화창 열기
      </button>
      {open ? (
        <P.Dialog title="다른 입력" onClose={() => setOpen(false)}>
          <p>대화창</p>
        </P.Dialog>
      ) : null}
      <P.Submit />
    </P>
  );
}

const fileInput = () => screen.getByLabelText(/좌석도/) as HTMLInputElement;
const choose = (file: File | undefined) =>
  fireEvent.change(fileInput(), { target: { files: file === undefined ? [] : [file] } });

it(title('G047', 'C7 파일은 다른 칸 오류·재마운트·대화창 열고 닫기·저장 실패 뒤에도 같은 File로 남고, 다시 저장하면 그 File을 보낸다'), async () => {
  const seat = new File(['png'], 'seat-a.png', { type: 'image/png' });
  const sent: WithFile[] = [];
  const save = vi
    .fn<(values: WithFile) => Promise<unknown>>()
    .mockImplementationOnce(async (values) => {
      sent.push(values);
      throw new RequestFailure({ kind: 'server-error', status: 500 });
    })
    .mockImplementationOnce(async (values) => {
      sent.push(values);
    });
  await mount(() => <FileEditor save={save} />);
  // 파일 칸 필수 표시도 schema(비어 있음 거부)에서 나온다.
  expect(fileInput().getAttribute('aria-required')).toBe('true');
  choose(seat);
  expect(screen.getByText('seat-a.png')).toBeTruthy();
  // 선택 창 취소(파일 없는 change)는 값을 지우지 않는다.
  choose(undefined);
  expect(screen.getByText('seat-a.png')).toBeTruthy();
  expect(fileInput().getAttribute('aria-describedby')).toContain(screen.getByText('seat-a.png').id);
  // 다른 칸 오류.
  fireEvent.click(screen.getByText('저장'));
  await waitFor(() => expect(invalid('제목')).toBe(true));
  expect(screen.getByText('seat-a.png')).toBeTruthy();
  // 재마운트.
  fireEvent.click(screen.getByText('좌석도 접기'));
  fireEvent.click(screen.getByText('좌석도 접기'));
  expect(screen.getByText('seat-a.png')).toBeTruthy();
  // 대화창 열고 닫기.
  fireEvent.click(screen.getByText('대화창 열기'));
  const dialog = await screen.findByRole('dialog', { name: '다른 입력' });
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '다른 입력' })).toBeNull());
  expect(screen.getByText('seat-a.png')).toBeTruthy();
  // 저장 실패 → 남음 → 다시 저장은 같은 File.
  fireEvent.change(screen.getByLabelText('제목', { exact: false }), { target: { value: 'T' } });
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await screen.findByText('저장하지 못했습니다. 입력을 확인해 주세요.');
  expect(screen.getByText('seat-a.png')).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(sent.map((values) => values.seat)).toEqual([
    { kind: 'selected', file: seat },
    { kind: 'selected', file: seat },
  ]);
  expect((sent[1]!.seat as { file: File }).file).toBe(seat);
});

it(title('G048', 'C7 저장 중 다른 파일로 바꾸면 늦은 성공이 덮지 않고, 제거 버튼만 기존 파일을 지운다'), async () => {
  const pending = deferred();
  function Editor() {
    const editor = useSaveForm({
      schema: fileSchema,
      source: { id: 1, values: { title: 'T', seat: { kind: 'existing', name: 'old.png' } } },
      save: () => pending.promise,
    });
    return (
      <P editor={editor}>
        <P.File name="seat" label="좌석도" />
        <P.Submit />
        <p>{editor.isDirty ? '바뀜' : '같음'}</p>
      </P>
    );
  }
  await mount(() => <Editor />);
  expect(screen.getByText('old.png')).toBeTruthy();
  choose(new File(['a'], 'a.png'));
  await act(async () => fireEvent.click(screen.getByText('저장')));
  choose(new File(['b'], 'b.png'));
  await act(async () => pending.resolve());
  expect(screen.getByText('b.png')).toBeTruthy();
  expect(screen.getByText('바뀜')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '파일 삭제' }));
  expect(screen.queryByText('b.png')).toBeNull();
  expect(screen.queryByRole('button', { name: '파일 삭제' })).toBeNull();
});

// ─── 저장 중 표시 ────────────────────────────────────────────────────────────

it(title('G049', 'C9 저장 중에는 저장·취소 버튼이 잠기고 그 옆에 진행 표시(화면 낭독기 문구)가 보이며, 끝나면 사라진다'), async () => {
  const pending = deferred();
  function Editor() {
    const editor = useSaveForm({ schema: outerSchema, source: { id: 1, values: { title: 'T', keys: '' } }, save: () => pending.promise });
    return (
      <O editor={editor} messages={{ saving: '저장하는 중' }}>
        <O.Text name="title" label="제목" />
        <O.Submit />
        <O.Cancel>취소</O.Cancel>
      </O>
    );
  }
  await mount(() => <Editor />);
  expect(screen.queryByRole('status')).toBeNull();
  await act(async () => fireEvent.click(screen.getByText('저장')));
  const status = screen.getByRole('status');
  expect(status.className).toBe('wk-spinner');
  expect(within(status).getByText('저장하는 중').className).toBe('wk-visually-hidden');
  expect(screen.getByText('저장').getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByText('취소').getAttribute('aria-disabled')).toBe('true');
  expect(status.previousElementSibling).toBe(screen.getByText('저장'));
  await act(async () => pending.resolve());
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  expect(screen.getByText('저장').getAttribute('aria-disabled')).toBeNull();
});

it(title('G050', 'C9 저장 확인창으로 저장하는 동안에는 확인창 버튼 옆에 같은 진행 표시가 보인다'), async () => {
  const pending = deferred();
  function Editor() {
    const editor = useSaveForm({ schema: outerSchema, source: { id: 1, values: { title: 'T', keys: '' } }, confirm: true, save: () => pending.promise });
    return (
      <O editor={editor}>
        <O.Submit />
        <O.Confirm />
      </O>
    );
  }
  await mount(() => <Editor />);
  fireEvent.click(screen.getByText('저장'));
  const confirm = await screen.findByRole('alertdialog');
  expect(within(confirm).queryByRole('status')).toBeNull();
  await act(async () => fireEvent.click(within(confirm).getByRole('button', { name: '저장' })));
  expect(within(confirm).getByRole('status').className).toBe('wk-spinner');
  expect(within(confirm).getByText('저장 중입니다.').className).toBe('wk-visually-hidden');
  await act(async () => pending.resolve());
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});
}
