// 파일 책임: 폼 의존 없이 확인 실행과 재시도 UI의 DOM 보장을 검사한다.
import { act, useState, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { useConfirmationState } from '../confirmation';

/** 확인창 adapter. 열림은 open만 따르고, 닫기 요청(취소·Escape·바깥 클릭)은 onCancel로만 전달한다. */
export interface ConfirmDialogAdapterProps {
  readonly open: boolean;
  readonly pending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly children: ReactNode;
}

/** 재시도 adapter. failed면 다시 시도 버튼, 아니면 controlId를 가진 control을 그린다. */
export interface RetryAdapterProps {
  readonly failed: boolean;
  readonly onRetry: () => void;
  readonly controlId: string;
}

interface Mounted {
  readonly rerender: (element: ReactElement) => Promise<void>;
  readonly unmount: () => Promise<void>;
}

/** act 환경에서 문서에 붙여 렌더한다. */
async function mount(element: ReactElement): Promise<Mounted> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return {
    rerender: async (next) => act(async () => root.render(next)),
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

/** 예약된 작업(setTimeout 0)과 그 렌더가 끝날 때까지 기다린다. */
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i += 1)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

/** DOM 클릭과 그 뒤 렌더가 끝날 때까지 기다린다. */
async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.click());
  await settle();
}

/** 위반 이유를 호출자에게 돌려준다. */
function fail(message: string): never {
  throw new Error(`[web-kit/testing] ${message}`);
}

interface CheckValues {
  readonly name: string;
}

/** 확인 관문 검사용 화면. 실제 확인 실행 상태로 adapter를 연다. */
function ConfirmHarness({
  Dialog,
  save,
}: {
  readonly Dialog: ComponentType<ConfirmDialogAdapterProps>;
  readonly save: (values: CheckValues) => Promise<void>;
}) {
  const [values, setValues] = useState<CheckValues>({ name: 'shown-snapshot' });
  const confirmation = useConfirmationState<CheckValues, string>({ run: save, onError: () => ({ kind: 'show', failure: 'failed' }) });
  const state = confirmation.state;
  const open = state.kind === 'open';
  return (
    <>
      <button type="button" data-web-kit-check="submit" onClick={() => confirmation.request(values)}>
        submit
      </button>
      <button type="button" data-web-kit-check="change" onClick={() => setValues({ name: 'changed' })}>
        change
      </button>
      <Dialog open={open} pending={open && state.pending} onConfirm={() => void confirmation.confirm()} onCancel={confirmation.close}>
        {open ? state.values.name : null}
      </Dialog>
    </>
  );
}

/** 현재 열린 대화창을 찾는다. */
function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"],[role="alertdialog"]');
}

/** 주어진 문구의 대화창 버튼을 찾는다. */
function button(scope: HTMLElement, text: string): HTMLElement {
  const found = Array.from(scope.querySelectorAll<HTMLElement>('button,[role="button"]')).find((element) =>
    element.textContent?.includes(text),
  );
  return found ?? fail(`dialog has no "${text}" button`);
}

/** 검사 화면의 동작 버튼을 찾는다. */
function harnessButton(name: string): HTMLElement {
  return document.querySelector<HTMLElement>(`[data-web-kit-check="${name}"]`) ?? fail(`harness ${name} missing`);
}

/**
 * 확인창 adapter 검사: 확인 대기에서 열리고 snapshot을 보임, 취소는 저장 없이 닫음,
 * 저장 중에는 Escape·바깥 클릭·취소·재확인이 닫거나 다시 실행하지 않음, 실행 값 = 보여 준 snapshot.
 */
export async function checkConfirmDialogAdapter(
  Dialog: ComponentType<ConfirmDialogAdapterProps>,
  labels: { readonly confirm: string; readonly cancel: string },
): Promise<void> {
  const executed: CheckValues[] = [];
  let finish: () => void = () => undefined;
  const save = (values: CheckValues) =>
    new Promise<void>((resolve) => {
      executed.push(values);
      finish = resolve;
    });
  const mounted = await mount(<ConfirmHarness Dialog={Dialog} save={save} />);
  try {
    await click(harnessButton('submit'));
    const opened = dialog() ?? fail('dialog did not open on the confirming stage');
    if (!opened.textContent?.includes('shown-snapshot')) fail('dialog does not show the confirmed snapshot');
    await click(button(opened, labels.cancel));
    if (dialog() !== null) fail('cancel did not close the dialog before saving');
    if (executed.length > 0) fail('cancel executed the save');

    await click(harnessButton('submit'));
    await click(harnessButton('change'));
    await click(button(dialog() ?? fail('dialog did not reopen'), labels.confirm));
    if (executed.length !== 1) fail(`confirm executed ${executed.length} saves`);

    const target = document.activeElement ?? document.body;
    await act(async () => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await settle();
    if (dialog() === null) fail('dialog closed on Escape while saving');
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click'])
      await act(async () => {
        document.body.dispatchEvent(new MouseEvent(type, { bubbles: true }));
      });
    await settle();
    if (dialog() === null) fail('dialog closed on an outside click while saving');
    const saving = dialog() ?? fail('dialog missing while saving');
    await click(button(saving, labels.cancel));
    if (dialog() === null) fail('cancel closed the dialog while saving');
    await click(button(dialog() ?? saving, labels.confirm));
    if (executed.length !== 1) fail('confirm re-ran the save while saving');
    if (executed[0]?.name !== 'shown-snapshot') fail('executed values differ from the shown snapshot');

    await act(async () => finish());
    await settle();
    if (dialog() !== null) fail('dialog did not close after the save finished');
  } finally {
    await mounted.unmount();
  }
}

/** 재시도 검사용 화면. 재시도는 다음 작업에서 성공한다. */
function RetryHarness({ Adapter }: { readonly Adapter: ComponentType<RetryAdapterProps> }) {
  const [failed, setFailed] = useState(true);
  return (
    <>
      <button type="button" data-web-kit-check="outside">
        outside
      </button>
      <div data-web-kit-check="adapter">
        <Adapter failed={failed} controlId="web-kit-retry-control" onRetry={() => setTimeout(() => setFailed(false), 0)} />
      </div>
    </>
  );
}

/** 실패 상태의 재시도 버튼을 찾는다. */
function retryButton(): HTMLElement {
  const scope = harnessButton('adapter');
  return scope.querySelector<HTMLElement>('button,[role="button"]') ?? fail('adapter shows no retry button while failed');
}

/**
 * 재시도 focus 검사: 다시 시도 버튼에 focus가 있었고 버튼이 사라진 경우에만 control로 옮기고,
 * 그 밖에는 focus를 움직이지 않는다.
 */
export async function checkRetryFocusAdapter(Adapter: ComponentType<RetryAdapterProps>): Promise<void> {
  let mounted = await mount(<RetryHarness Adapter={Adapter} />);
  try {
    const retry = retryButton();
    await act(async () => retry.focus());
    await click(retry);
    if (document.activeElement?.id !== 'web-kit-retry-control')
      fail('focus did not move to the control after the focused retry button disappeared');
  } finally {
    await mounted.unmount();
  }
  mounted = await mount(<RetryHarness Adapter={Adapter} />);
  try {
    const outside = harnessButton('outside');
    await act(async () => outside.focus());
    await click(retryButton());
    if (document.activeElement !== outside) fail('focus moved although it was not on the retry button');
  } finally {
    await mounted.unmount();
  }
}
