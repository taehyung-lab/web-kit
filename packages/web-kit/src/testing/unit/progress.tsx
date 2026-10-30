// 파일 책임: progress.tsx 조합이 소비 복사본에서 내는 화면 결과를 검사한다.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, expect, it as baseIt } from 'vitest';
import { useBlockingProgress } from '../../progress';
import type * as Contract1 from '../contracts/ui/blocking-progress';
import type * as Contract2 from '../contracts/ui/dialog';
import { conformanceTitle, type ConformanceTarget } from '../target.mjs';
import { useConfirmationState } from '../../confirmation';

/** 필요한 기능의 실제 복사본으로 해당 검사만 등록한다. */
export function checkProgressConformance({ BlockingProgress, ConfirmDialog }: { BlockingProgress: typeof Contract1.BlockingProgress; ConfirmDialog: typeof Contract2.ConfirmDialog }, target: ConformanceTarget) {
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

/** 본문 버튼과, React 트리로는 본문 안이지만 DOM은 document.body로 나간 portal 버튼. portal 안 포커스도 React 합성 이벤트로 본문 div까지 올라온다. */
function PortalScreen({ active, portal, trigger = true }: { readonly active: boolean; readonly portal: boolean; readonly trigger?: boolean }) {
  /** 진행 상태를 실제 등록소에 전달한다. */
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

it(title('G010', 'P6 portal(확인창) 안 포커스는 본문 마지막 포커스로 기록하지 않는다 — 확인창이 사라진 뒤 덮개가 닫히면 본문 요소로 돌린다'), () => {
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

it(title('G011', 'P6 기록한 본문 요소도 사라졌으면 본문의 첫 제목(h1)으로, 제목도 없으면 본문 영역으로 돌린다 — 문서 본문에 두지 않는다'), () => {
  const view = render(<PortalScreen active={false} portal={false} />);
  screen.getByRole('button', { name: '저장' }).focus();
  view.rerender(<PortalScreen active portal={false} trigger={false} />);
  expect(document.activeElement).toBe(document.body);
  view.rerender(<PortalScreen active={false} portal={false} trigger={false} />);
  const heading = screen.getByRole('heading', { name: '상품 수정' });
  expect(document.activeElement).toBe(heading);
  expect(heading.getAttribute('tabindex')).toBe('-1');
  // 받는 동안만 붙인다: 포커스가 다른 곳으로 가면 떼어 클릭·Tab 순서에 남기지 않는다.
  view.rerender(<PortalScreen active={false} portal={false} />);
  screen.getByRole('button', { name: '저장' }).focus();
  expect(heading.hasAttribute('tabindex')).toBe(false);
  cleanup();

  /** 제목 없이 본문 초점 복원을 관찰한다. */
  function Bare({ active, button }: { readonly active: boolean; readonly button: boolean }) {
    /** 진행 상태를 실제 등록소에 전달한다. */
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
  expect(body().getAttribute('tabindex')).toBe('-1');
  bare.rerender(<Bare active={false} button />);
  screen.getByRole('button', { name: '선택 삭제' }).focus();
  expect(body().hasAttribute('tabindex')).toBe(false);
});

it(title('G012', 'P6 본문에서 아무 요소에도 포커스한 적이 없으면(첫 진입) 덮개가 닫혀도 포커스를 옮기지 않는다'), () => {
  const view = render(<PortalScreen active portal={false} />);
  view.rerender(<PortalScreen active={false} portal={false} />);
  expect(document.activeElement).toBe(document.body);
});

it(title('G013', 'P10 덮개는 본문만 막고 덮개 밖(portal) 대화창은 막지 않는다 — 덮개 층은 프로젝트 변수로 바꾼다'), async () => {
  /** 진행 상태를 실제 등록소에 전달한다. */
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

it(title('G014', '가운데 진행 표시: 기본은 키트 원형 회전 표시, indicator를 주면 그 표시로 바뀌고 문구·본문 막기는 같다'), () => {
  /** 진행 상태를 실제 등록소에 전달한다. */
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

it(title('G015', '저장과 조회가 겹치면 저장 문구가 이긴다, 등록소 밖 훅은 아무 일도 하지 않는다'), () => {
  /** 진행 상태를 실제 등록소에 전달한다. */
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

it(title('G021', 'P6·P10 덮개 중 덮개 밖 대화창(세션 안내 등)에 간 포커스는 덮개가 닫혀도 그대로 둔다'), async () => {
  /** 진행 상태를 실제 등록소에 전달한다. */
  function Probe({ active }: { readonly active: boolean }) {
    useBlockingProgress('loading', active);
    return null;
  }
  /** 실제 소비 부품을 검사 입력과 연결한다. */
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

it(title('G022', 'Q1 삭제: 확인창 → 확인하면 확인창이 내려가고 "삭제 중" 덮개 → 끝나면 덮개가 닫힌다'), async () => {
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

it(title('G023', 'Q1 삭제 실패: 덮개가 닫히고 확인창이 실패 문구와 함께 다시 보이며 포커스는 확인창에 있다'), async () => {
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

it(title('G024', 'Q1 progress를 선언하지 않은 확인 실행(상태 변경 등)은 덮지 않고 확인창 안 진행 표시 그대로다'), async () => {
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

it(title('G025', 'Q1 조회 중에 삭제가 시작되면 삭제 문구가 이긴다'), () => {
  /** 진행 상태를 실제 등록소에 전달한다. */
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

}
