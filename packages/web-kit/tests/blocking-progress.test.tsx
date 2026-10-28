// @vitest-environment jsdom
// 파일 책임: 화면 전체 진행 덮개(BlockingProgress)가 폼 저장(등록·수정)·페이지 첫 조회에서 열리고 닫히는 때, 본문 막기, 문구, 포커스 복원을
// 화면 결과로 검사한다. jsdom은 inert의 클릭·포커스 차단을 하지 않으므로 속성과 포커스 순서만 보고, 실제 차단은 starter e2e가 본다.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { z } from 'zod';
import { RequestFailure } from '../src/failure';
import { useConfirmationState } from '../src/form/confirmation';
import { useSaveForm, type SaveFormOptions } from '../src/form/save-form';
import { Form } from '../src/form/ui';
import { useBlockingProgress } from '../src/progress';
import { useRecord } from '../src/record';
import { defineSearch } from '../src/search/fields';
import { BlockingProgress } from '../src/ui/blocking-progress';
import { ConfirmDialog } from '../src/ui/dialog';
import { useList, type ListPage } from '../src/use-list';

afterEach(cleanup);

const MESSAGES = {
  loading: '데이터를 불러오는 중입니다.',
  create: '등록 중입니다.',
  edit: '수정 중입니다.',
  delete: '삭제 중입니다.',
  wait: '잠시만 기다려 주세요.',
};

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
function overlayOpen() {
  return document.querySelector('.wk-blocking') !== null;
}
function body() {
  return screen.getByTestId('app-body').parentElement!;
}

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

it('P1·P11 등록 폼 저장이 시작되는 렌더에서 덮개가 열리고 본문은 inert·aria-busy, 저장이 끝나는 렌더에서 닫힌다', async () => {
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

it('P2·P3 수정 폼은 수정 문구이고, 덮개를 쓰는 폼은 저장 버튼 옆 진행 표시를 그리지 않으며 버튼은 잠긴다', async () => {
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

it('P3 덮개를 선언하지 않은 폼은 덮개 없이 저장 버튼 옆 진행 표시를 그대로 그린다', async () => {
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

it('P4 확인창 → 확인하면 확인창이 닫히고 덮개 → 저장 끝이면 덮개가 닫히고 완료 창, 둘이 함께 보이지 않는다', async () => {
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

it('P5 저장 절차가 사용자에게 묻는 동안(waitForUser) 덮개를 내리고, 답한 뒤 저장이 이어지면 다시 덮는다', async () => {
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

it('완료 창이 없는 폼은 저장 뒤 완료 처리(이동 등)가 끝날 때까지 덮는다', async () => {
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

it('P6 덮개가 닫힐 때 포커스를 잃었으면(inert가 밀어냄) 본문에서 마지막으로 포커스한 요소로 돌린다', async () => {
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

it('P6 저장 완료 창이 열리면 포커스는 완료 창에 남는다(덮개가 되돌리지 않는다)', async () => {
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

it('P6 서버 필드 오류로 끝나면 포커스는 첫 오류 칸으로 간다(덮개 복원 뒤 오류 포커스)', async () => {
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

/** 본문 버튼과, React 트리로는 본문 안이지만 DOM은 document.body로 나간 portal 버튼. portal 안 포커스도 React 합성 이벤트로 본문 div까지 올라온다. */
function PortalScreen({ active, portal, trigger = true }: { readonly active: boolean; readonly portal: boolean; readonly trigger?: boolean }) {
  function Probe() {
    useBlockingProgress('edit', active);
    return null;
  }
  return (
    <Host>
      <h1>상품 수정</h1>
      {trigger ? <button type="button">저장</button> : null}
      <Probe />
      {portal ? createPortal(<button type="button">확인</button>, document.body) : null}
    </Host>
  );
}

it('P6 portal(확인창) 안 포커스는 본문 마지막 포커스로 기록하지 않는다 — 확인창이 사라진 뒤 덮개가 닫히면 본문 요소로 돌린다', () => {
  const view = render(<PortalScreen active={false} portal />);
  const trigger = screen.getByRole('button', { name: '저장' });
  trigger.focus();
  screen.getByRole('button', { name: '확인' }).focus();
  // 확인하면 확인창이 내려가고 덮개가 열린다. 브라우저는 inert 본문으로 포커스를 돌려주지 못해 문서 본문에 남는다.
  view.rerender(<PortalScreen active portal={false} />);
  expect(overlayOpen()).toBe(true);
  expect(document.activeElement).toBe(document.body);
  view.rerender(<PortalScreen active={false} portal={false} />);
  expect(overlayOpen()).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

it('P6 기록한 본문 요소도 사라졌으면 본문의 첫 제목(h1)으로, 제목도 없으면 본문 영역으로 돌린다 — 문서 본문에 두지 않는다', () => {
  const view = render(<PortalScreen active={false} portal={false} />);
  screen.getByRole('button', { name: '저장' }).focus();
  view.rerender(<PortalScreen active portal={false} trigger={false} />);
  expect(document.activeElement).toBe(document.body);
  view.rerender(<PortalScreen active={false} portal={false} trigger={false} />);
  const heading = screen.getByRole('heading', { name: '상품 수정' });
  expect(document.activeElement).toBe(heading);
  expect(heading.getAttribute('tabindex')).toBe('-1');
  cleanup();

  function Bare({ active, button }: { readonly active: boolean; readonly button: boolean }) {
    function Probe() {
      useBlockingProgress('delete', active);
      return null;
    }
    return (
      <Host>
        {button ? <button type="button">선택 삭제</button> : null}
        <Probe />
      </Host>
    );
  }
  const bare = render(<Bare active={false} button />);
  screen.getByRole('button', { name: '선택 삭제' }).focus();
  bare.rerender(<Bare active button={false} />);
  bare.rerender(<Bare active={false} button={false} />);
  expect(document.activeElement).toBe(body());
});

it('P6 본문에서 아무 요소에도 포커스한 적이 없으면(첫 진입) 덮개가 닫혀도 포커스를 옮기지 않는다', () => {
  const view = render(<PortalScreen active portal={false} />);
  view.rerender(<PortalScreen active={false} portal={false} />);
  expect(document.activeElement).toBe(document.body);
});

it('P10 덮개는 본문만 막고 덮개 밖(portal) 대화창은 막지 않는다 — 덮개 층은 프로젝트 변수로 바꾼다', async () => {
  function Probe() {
    useBlockingProgress('loading', true);
    return null;
  }
  render(
    <>
      <Host>
        <Probe />
      </Host>
      <div role="dialog" aria-label="세션 안내">
        <button type="button">연장</button>
      </div>
    </>,
  );
  expect(overlayOpen()).toBe(true);
  expect(screen.getByRole('button', { name: '연장' }).closest('[inert]')).toBeNull();
  expect(body().hasAttribute('inert')).toBe(true);
});

it('가운데 진행 표시: 기본은 키트 원형 회전 표시, indicator를 주면 그 표시로 바뀌고 문구·본문 막기는 같다', () => {
  function Probe() {
    useBlockingProgress('loading', true);
    return null;
  }
  const { unmount } = render(
    <Host>
      <Probe />
    </Host>,
  );
  const box = () => document.querySelector('.wk-blocking-box')!;
  expect(box().querySelector('.wk-spinner.wk-spinner-large')).not.toBeNull();
  unmount();
  render(
    <BlockingProgress messages={MESSAGES} indicator={<svg data-testid="bars" />}>
      <div data-testid="app-body">
        <Probe />
      </div>
    </BlockingProgress>,
  );
  expect(box().querySelector('[data-testid="bars"]')).not.toBeNull();
  expect(box().querySelector('.wk-spinner')).toBeNull();
  expect(box().closest('[aria-hidden="true"]')).not.toBeNull();
  expect(status().textContent).toContain('데이터를 불러오는 중입니다.');
  expect(body().hasAttribute('inert')).toBe(true);
});

it('저장과 조회가 겹치면 저장 문구가 이긴다, 등록소 밖 훅은 아무 일도 하지 않는다', () => {
  function Probe({ kind }: { readonly kind: 'loading' | 'create' }) {
    useBlockingProgress(kind, true);
    return null;
  }
  const { unmount } = render(
    <Host>
      <Probe kind="loading" />
      <Probe kind="create" />
    </Host>,
  );
  expect(status().textContent).toContain('등록 중입니다.');
  expect(status().textContent).not.toContain('데이터를 불러오는 중입니다.');
  unmount();
  render(<Probe kind="create" />);
  expect(document.querySelector('.wk-blocking')).toBeNull();
});

// ─── 페이지 첫 조회 ─────────────────────────────────────────────────────────

interface Row {
  readonly id: string;
}
const definition = defineSearch({
  fields: {
    page: { schema: z.number().int().min(1), default: 1 },
    size: { schema: z.number().int(), default: 20 },
    q: { schema: z.string(), default: '' },
  },
});
const rows = (...ids: string[]): ListPage<Row> => ({ rows: ids.map((id) => ({ id })), total: ids.length });

let goToPage!: (page: number) => void;
function ListScreen({ fetchRows, progress }: { readonly fetchRows: () => Promise<ListPage<Row>>; readonly progress?: 'page' }) {
  const [search, setSearch] = useState(() => definition.validateSearch({}));
  const list = useList({
    definition,
    search,
    navigate: (next) => setSearch(definition.validateSearch(next as Record<string, unknown>)),
    query: (full) => ({ queryKey: ['rows', full], queryFn: fetchRows }),
    rowId: (row) => row.id,
    progress,
  });
  goToPage = list.goToPage;
  return <p>{list.rows.map((row) => row.id).join(',') || '행 없음'}</p>;
}

let client = new QueryClient();
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
/** 같은 시험 안에서는 같은 QueryClient로 그린다(다시 그려도 캐시가 이어진다). */
function withClient(node: ReactNode) {
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

it('P7 목록 첫 진입은 조회 중 덮고, 페이지 이동(새 조건)은 이전 결과를 보인 채 덮지 않는다', async () => {
  let next = deferred<ListPage<Row>>();
  render(withClient(<Host><ListScreen progress="page" fetchRows={() => next.promise} /></Host>));
  await waitFor(() => expect(overlayOpen()).toBe(true));
  expect(status().textContent).toContain('데이터를 불러오는 중입니다.');
  await act(async () => next.resolve(rows('a', 'b')));
  await waitFor(() => expect(overlayOpen()).toBe(false));
  next = deferred<ListPage<Row>>();
  act(() => goToPage(2));
  await waitFor(() => expect(screen.getByText('a,b')).toBeTruthy());
  expect(overlayOpen()).toBe(false);
  expect(body().hasAttribute('inert')).toBe(false);
  await act(async () => next.resolve(rows('c')));
  await waitFor(() => expect(screen.getByText('c')).toBeTruthy());
  expect(overlayOpen()).toBe(false);
});

it('P7 목록 첫 조회가 실패하면 덮개가 닫히고, 선언하지 않은 목록은 덮지 않는다', async () => {
  const first = deferred<ListPage<Row>>();
  render(withClient(<Host><ListScreen progress="page" fetchRows={() => first.promise} /></Host>));
  await waitFor(() => expect(overlayOpen()).toBe(true));
  await act(async () => first.reject(new RequestFailure({ kind: 'server-error', status: 500 })));
  await waitFor(() => expect(overlayOpen()).toBe(false));
  cleanup();
  render(withClient(<Host><ListScreen fetchRows={() => new Promise(() => undefined)} /></Host>));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(overlayOpen()).toBe(false);
});

let refetchRecord!: () => void;
function RecordScreen({
  id,
  lang,
  load,
  progress,
}: {
  readonly id: string;
  readonly lang: string;
  readonly load: () => Promise<{ name: string }>;
  readonly progress?: 'page';
}) {
  const state = useRecord({ queryKey: ['record', id, lang], queryFn: load }, id, progress === undefined ? undefined : { progress });
  if (state.kind === 'ready') refetchRecord = state.refresh.retry;
  return <p>{state.kind === 'ready' ? state.data.name : state.kind}</p>;
}

it('P7 단건 첫 진입은 덮고, 같은 레코드의 언어 전환·재조회는 내용을 둔 채 덮지 않는다', async () => {
  let next = deferred<{ name: string }>();
  const view = render(withClient(<Host><RecordScreen id="1" lang="ko" progress="page" load={() => next.promise} /></Host>));
  await waitFor(() => expect(overlayOpen()).toBe(true));
  await act(async () => next.resolve({ name: '공연' }));
  await waitFor(() => expect(overlayOpen()).toBe(false));
  next = deferred();
  view.rerender(withClient(<Host><RecordScreen id="1" lang="en" progress="page" load={() => next.promise} /></Host>));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(screen.getByText('공연')).toBeTruthy();
  expect(overlayOpen()).toBe(false);
  cleanup();
});

it('P7 단건 재조회(캐시 있음)는 덮지 않고, 선언하지 않은 단건(대화창 안 조회)은 덮지 않는다', async () => {
  let next = deferred<{ name: string }>();
  render(withClient(<Host><RecordScreen id="1" lang="ko" progress="page" load={() => next.promise} /></Host>));
  await act(async () => next.resolve({ name: '공연' }));
  await waitFor(() => expect(screen.getByText('공연')).toBeTruthy());
  next = deferred();
  act(() => refetchRecord());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(screen.getByText('공연')).toBeTruthy();
  expect(overlayOpen()).toBe(false);
  cleanup();
  render(withClient(<Host><RecordScreen id="2" lang="ko" load={() => new Promise(() => undefined)} /></Host>));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(overlayOpen()).toBe(false);
});

it('P7 단건 첫 조회가 취소되면(세션 전환 등) 덮개가 닫힌다', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Host>
        <RecordScreen id="9" lang="ko" progress="page" load={() => new Promise(() => undefined)} />
      </Host>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(overlayOpen()).toBe(true));
  await act(async () => client.cancelQueries());
  await waitFor(() => expect(overlayOpen()).toBe(false));
});

it('P6·P10 덮개 중 덮개 밖 대화창(세션 안내 등)에 간 포커스는 덮개가 닫혀도 그대로 둔다', async () => {
  function Probe({ active }: { readonly active: boolean }) {
    useBlockingProgress('loading', active);
    return null;
  }
  function Screen({ active }: { readonly active: boolean }) {
    return (
      <>
        <Host>
          <button type="button">본문 버튼</button>
          <Probe active={active} />
        </Host>
        <div role="dialog" aria-label="세션 안내">
          <button type="button">연장</button>
        </div>
      </>
    );
  }
  const view = render(<Screen active={false} />);
  screen.getByRole('button', { name: '본문 버튼' }).focus();
  view.rerender(<Screen active />);
  expect(overlayOpen()).toBe(true);
  screen.getByRole('button', { name: '연장' }).focus();
  view.rerender(<Screen active={false} />);
  expect(overlayOpen()).toBe(false);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '연장' }));
});

// ─── 삭제(확인창을 거친 실행) ────────────────────────────────────────────────

/** 상세의 삭제 버튼과 확인창. progress를 주면 실행 중 덮개를 띄우고 확인창을 내린다. */
function DeleteAction({ run, progress }: { readonly run: () => Promise<void>; readonly progress?: 'delete' }) {
  const confirmation = useConfirmationState<void, string>({
    run,
    progress,
    onError: () => ({ kind: 'show', failure: '삭제하지 못했습니다.' }),
  });
  const { state } = confirmation;
  return (
    <>
      <button type="button" onClick={() => confirmation.request()}>
        삭제
      </button>
      <ConfirmDialog
        open={state.kind === 'open' && !confirmation.covered}
        pending={state.kind === 'open' && state.pending}
        title="삭제할까요?"
        confirmLabel="확인"
        cancelLabel="취소"
        onConfirm={() => void confirmation.confirm()}
        onCancel={confirmation.close}
      >
        {state.kind === 'open' && state.failure !== undefined ? <p role="alert">{state.failure}</p> : null}
      </ConfirmDialog>
    </>
  );
}

it('Q1 삭제: 확인창 → 확인하면 확인창이 내려가고 "삭제 중" 덮개 → 끝나면 덮개가 닫힌다', async () => {
  const pending = deferred<void>();
  render(
    <Host>
      <DeleteAction progress="delete" run={() => pending.promise} />
    </Host>,
  );
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(overlayOpen()).toBe(false);
  fireEvent.click(within(dialog).getByRole('button', { name: '확인' }));
  await waitFor(() => expect(overlayOpen()).toBe(true));
  expect(status().textContent).toContain('삭제 중입니다.');
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(body().hasAttribute('inert')).toBe(true);
  await act(async () => pending.resolve());
  expect(overlayOpen()).toBe(false);
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('Q1 삭제 실패: 덮개가 닫히고 확인창이 실패 문구와 함께 다시 보이며 포커스는 확인창에 있다', async () => {
  const pending = deferred<void>();
  render(
    <Host>
      <DeleteAction progress="delete" run={() => pending.promise} />
    </Host>,
  );
  const opener = screen.getByRole('button', { name: '삭제' });
  opener.focus();
  fireEvent.click(opener);
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '확인' }));
  await waitFor(() => expect(overlayOpen()).toBe(true));
  await act(async () => pending.reject(new Error('down')));
  expect(overlayOpen()).toBe(false);
  const again = await screen.findByRole('alertdialog');
  expect(within(again).getByRole('alert').textContent).toBe('삭제하지 못했습니다.');
  await waitFor(() => expect(again.contains(document.activeElement)).toBe(true));
});

it('Q1 progress를 선언하지 않은 확인 실행(상태 변경 등)은 덮지 않고 확인창 안 진행 표시 그대로다', async () => {
  const pending = deferred<void>();
  render(
    <Host>
      <DeleteAction run={() => pending.promise} />
    </Host>,
  );
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', { name: '확인' }));
  await waitFor(() => expect(dialog.querySelector('.wk-spinner')).not.toBeNull());
  expect(overlayOpen()).toBe(false);
  expect(screen.getByRole('alertdialog')).toBe(dialog);
  await act(async () => pending.resolve());
});

it('Q1 조회 중에 삭제가 시작되면 삭제 문구가 이긴다', () => {
  function Probe({ kind }: { readonly kind: 'loading' | 'delete' }) {
    useBlockingProgress(kind, true);
    return null;
  }
  render(
    <Host>
      <Probe kind="loading" />
      <Probe kind="delete" />
    </Host>,
  );
  expect(status().textContent).toContain('삭제 중입니다.');
  expect(status().textContent).not.toContain('데이터를 불러오는 중입니다.');
});
