// 파일 책임: progress-form.tsx 조합이 소비 복사본에서 내는 화면 결과를 검사한다.
import { act, cleanup, fireEvent, render, screen, waitFor, } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, expect, it as baseIt } from 'vitest';
import type * as Contract1 from '../contracts/ui/blocking-progress';
import { conformanceTitle, type ConformanceTarget } from '../target.mjs';
import { z } from 'zod';
import { RequestFailure } from '../../failure';
import { useSaveForm, type SaveFormOptions } from '../../form/save-form';
import type * as Contract0 from '../contracts/form/ui';

/** 필요한 기능의 실제 복사본으로 해당 검사만 등록한다. */
export function checkFormProgressConformance({ Form, BlockingProgress }: { Form: typeof Contract0.Form; BlockingProgress: typeof Contract1.BlockingProgress }, target: ConformanceTarget) {
  const it = baseIt;
  const title = (id: string, label: string) => conformanceTitle(id, target, label);

afterEach(cleanup);

const MESSAGES = {
  loading: '데이터를 불러오는 중입니다.',
  create: '등록 중입니다.',
  edit: '수정 중입니다.',
  delete: '삭제 중입니다.',
  wait: '잠시만 기다려 주세요.',
};

/** 검사에서 완료·실패 시점을 직접 제어할 요청을 만든다. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** 덮개 문구 영역(늘 있음). 닫혀 있으면 비어 있다. */
function status() {
  return document.querySelector<HTMLElement>('.wk-blocking-status')!;
}
/** 실제 덮개 DOM의 열림을 읽는다. */
function overlayOpen() {
  return document.querySelector('.wk-blocking') !== null;
}
/** 덮개가 막는 본문 영역을 찾는다. */
function body() {
  return screen.getByTestId('app-body').parentElement!;
}

/** 소비처 덮개 복사본 안에 검사 본문을 배치한다. */
function Host({ children }: { readonly children: ReactNode }) {
  return (
    <BlockingProgress messages={MESSAGES}>
      <div data-testid="app-body">{children}</div>
    </BlockingProgress>
  );
}

const schema = z.object({ name: z.string().min(1, '이름 필요') });
type Values = z.input<typeof schema>;
const F = Form.of<Values>();

/** 실제 폼 복사본과 저장 수명을 연결한다. */
function Editor(props: Partial<SaveFormOptions<Values, Values, unknown>> & { readonly saved?: boolean }) {
  const editor = useSaveForm<Values, Values, unknown>({
    schema,
    source: { id: 1, values: { name: 'A' } },
    save: async () => undefined,
    ...props,
  });
  return (
    <F editor={editor} protect={false} messages={{ saving: '저장 중' }}>
      <F.Text name="name" label="이름" />
      <F.Submit />
      <F.Confirm title="저장할까요?" />
      {props.saved ? <F.Saved title="저장되었습니다." /> : null}
    </F>
  );
}

it(title('G001', 'P1·P11 등록 폼 저장이 시작되는 렌더에서 덮개가 열리고 본문은 inert·aria-busy, 저장이 끝나는 렌더에서 닫힌다'), async () => {
  const pending = deferred<undefined>();
  render(
    <Host>
      <Editor progress="create" save={() => pending.promise} />
    </Host>,
  );
  expect(overlayOpen()).toBe(false);
  expect(status().textContent).toBe('');
  expect(body().hasAttribute('inert')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(overlayOpen()).toBe(true));
  expect(status().getAttribute('role')).toBe('status');
  expect(status().textContent).toContain('등록 중입니다.');
  expect(status().textContent).toContain('잠시만 기다려 주세요.');
  expect(body().hasAttribute('inert')).toBe(true);
  expect(body().getAttribute('aria-busy')).toBe('true');
  await act(async () => pending.resolve(undefined));
  expect(overlayOpen()).toBe(false);
  expect(body().hasAttribute('inert')).toBe(false);
  expect(body().hasAttribute('aria-busy')).toBe(false);
});

it(title('G002', 'P2·P3 수정 폼은 수정 문구이고, 덮개를 쓰는 폼은 저장 버튼 옆 진행 표시를 그리지 않으며 버튼은 잠긴다'), async () => {
  const pending = deferred<undefined>();
  render(
    <Host>
      <Editor progress="edit" save={() => pending.promise} />
    </Host>,
  );
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(status().textContent).toContain('수정 중입니다.'));
  expect(status().textContent).not.toContain('등록 중입니다.');
  expect(document.querySelectorAll('.wk-blocking-root .wk-spinner')).toHaveLength(0);
  expect(screen.getByRole('button', { name: '저장', hidden: true }).getAttribute('aria-disabled')).toBe('true');
  await act(async () => pending.resolve(undefined));
});

it(title('G003', 'P3 덮개를 선언하지 않은 폼은 덮개 없이 저장 버튼 옆 진행 표시를 그대로 그린다'), async () => {
  const pending = deferred<undefined>();
  render(
    <Host>
      <Editor save={() => pending.promise} />
    </Host>,
  );
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(document.querySelectorAll('.wk-blocking-root .wk-spinner')).toHaveLength(1));
  expect(overlayOpen()).toBe(false);
  expect(body().hasAttribute('inert')).toBe(false);
  await act(async () => pending.resolve(undefined));
});

it(title('G004', 'P4 확인창 → 확인하면 확인창이 닫히고 덮개 → 저장 끝이면 덮개가 닫히고 완료 창, 둘이 함께 보이지 않는다'), async () => {
  const pending = deferred<undefined>();
  render(
    <Host>
      <Editor progress="edit" confirm acknowledge saved save={() => pending.promise} />
    </Host>,
  );
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog.textContent).toContain('저장할까요?');
  expect(overlayOpen()).toBe(false);
  fireEvent.click(screen.getAllByRole('button', { name: '저장' }).find((button) => dialog.contains(button))!);
  await waitFor(() => expect(overlayOpen()).toBe(true));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  await act(async () => pending.resolve(undefined));
  expect(overlayOpen()).toBe(false);
  expect(screen.getByRole('alertdialog').textContent).toContain('저장되었습니다.');
});

it(title('G005', 'P5 저장 절차가 사용자에게 묻는 동안(waitForUser) 덮개를 내리고, 답한 뒤 저장이 이어지면 다시 덮는다'), async () => {
  const answer = deferred<boolean>();
  const request = deferred<undefined>();
  let asked = false;
  render(
    <Host>
      <Editor
        progress="edit"
        save={async (_values, _submitted, { waitForUser }) => {
          asked = true;
          if (!(await waitForUser(answer.promise))) return undefined;
          return request.promise;
        }}
      />
    </Host>,
  );
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(asked).toBe(true));
  expect(overlayOpen()).toBe(false);
  expect(body().hasAttribute('inert')).toBe(false);
  await act(async () => answer.resolve(true));
  expect(overlayOpen()).toBe(true);
  await act(async () => request.resolve(undefined));
  expect(overlayOpen()).toBe(false);
});

it(title('G006', '완료 창이 없는 폼은 저장 뒤 완료 처리(이동 등)가 끝날 때까지 덮는다'), async () => {
  const leaving = deferred<void>();
  render(
    <Host>
      <Editor progress="create" onSaved={() => leaving.promise} />
    </Host>,
  );
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(overlayOpen()).toBe(true));
  await act(async () => leaving.resolve());
  expect(overlayOpen()).toBe(false);
});

it(title('G007', 'P6 덮개가 닫힐 때 포커스를 잃었으면(inert가 밀어냄) 본문에서 마지막으로 포커스한 요소로 돌린다'), async () => {
  const pending = deferred<undefined>();
  render(
    <Host>
      <Editor progress="create" save={() => pending.promise} />
    </Host>,
  );
  const submit = screen.getByRole('button', { name: '저장' });
  submit.focus();
  fireEvent.click(submit);
  await waitFor(() => expect(overlayOpen()).toBe(true));
  // 브라우저는 inert가 된 요소의 포커스를 문서 본문으로 옮긴다(jsdom은 하지 않아 같은 일을 직접 한다).
  submit.blur();
  expect(document.activeElement).toBe(document.body);
  await act(async () => pending.resolve(undefined));
  expect(document.activeElement).toBe(submit);
});

it(title('G008', 'P6 저장 완료 창이 열리면 포커스는 완료 창에 남는다(덮개가 되돌리지 않는다)'), async () => {
  const pending = deferred<undefined>();
  render(
    <Host>
      <Editor progress="create" acknowledge saved save={() => pending.promise} />
    </Host>,
  );
  const submit = screen.getByRole('button', { name: '저장' });
  submit.focus();
  fireEvent.click(submit);
  await waitFor(() => expect(overlayOpen()).toBe(true));
  submit.blur();
  await act(async () => pending.resolve(undefined));
  const alert = screen.getByRole('alertdialog');
  await waitFor(() => expect(alert.contains(document.activeElement)).toBe(true));
});

it(title('G009', 'P6 서버 필드 오류로 끝나면 포커스는 첫 오류 칸으로 간다(덮개 복원 뒤 오류 포커스)'), async () => {
  const pending = deferred<undefined>();
  render(
    <Host>
      <Editor
        progress="create"
        save={() => pending.promise}
        fieldError={(error) => ({ field: error.field as 'name', message: '이미 있는 이름' })}
      />
    </Host>,
  );
  const submit = screen.getByRole('button', { name: '저장' });
  submit.focus();
  fireEvent.click(submit);
  await waitFor(() => expect(overlayOpen()).toBe(true));
  submit.blur();
  await act(async () =>
    pending.reject(new RequestFailure({ kind: 'validation', status: 400, fieldErrors: [{ field: 'name', code: 'duplicate' }] })),
  );
  expect(overlayOpen()).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '이름' })));
});


}
