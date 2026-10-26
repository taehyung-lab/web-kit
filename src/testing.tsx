// 파일 책임: 프로젝트 UI adapter가 키트 보장(필드 접근성 연결·확인 관문·재시도 focus)을 깨지 않는지 실제 DOM으로 검사한다.
// 테스트 러너에 의존하지 않는다. 각 검사는 위반 시 이유를 담은 Error로 거절하고, 통과하면 undefined로 끝난다.
import type { StandardSchemaV1 } from '@tanstack/react-form';
import { act, useState, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { formFieldControlId, useSaveForm } from './form/save-form';

/** 필드 adapter가 받는 검사 입력. id는 formFieldControlId(formId, name)이며 control이 이 id를 가져야 한다. */
export interface FieldAdapterCase {
  readonly formId: string;
  readonly name: string;
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly message?: string;
}

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

async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.click());
  await settle();
}

function fail(message: string): never {
  throw new Error(`[web-kit/testing] ${message}`);
}

function describedBy(control: Element): string[] {
  return (control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
}

/** control의 접근 가능한 이름 출처(label[for]·aria-labelledby·aria-label) 텍스트. */
function labelText(control: HTMLElement): string {
  const byFor = Array.from(document.querySelectorAll('label')).filter((label) => label.htmlFor === control.id);
  const byRef = (control.getAttribute('aria-labelledby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id))
    .filter((element): element is HTMLElement => element !== null);
  return [...byFor, ...byRef].map((element) => element.textContent ?? '').join(' ') + (control.getAttribute('aria-label') ?? '');
}

/** 한 필드의 연결을 검사하고 오류를 가리키는 참조 id를 돌려준다. */
function checkFieldConnection(field: FieldAdapterCase): string | undefined {
  const matches = document.querySelectorAll(`[id="${CSS.escape(field.id)}"]`);
  if (matches.length === 0) fail(`control #${field.id} not found; use formFieldControlId(formId, name) as the control id`);
  if (matches.length > 1) fail(`control id #${field.id} is not unique`);
  const control = matches[0] as HTMLElement;
  if (!labelText(control).includes(field.label)) fail(`control #${field.id} is not labelled by "${field.label}"`);
  const refs = describedBy(control);
  const targets = refs.map((id) => {
    const target = document.getElementById(id);
    if (target === null) fail(`aria-describedby of #${field.id} references missing #${id}`);
    return target;
  });
  if (!targets.some((target) => target.textContent?.includes(field.description)))
    fail(`aria-describedby of #${field.id} does not reference the description`);
  if (field.message === undefined) {
    if (control.getAttribute('aria-invalid') === 'true') fail(`#${field.id} is aria-invalid without an error`);
    return undefined;
  }
  const index = targets.findIndex((target) => target.textContent?.includes(field.message ?? ''));
  if (index < 0) fail(`aria-describedby of #${field.id} does not reference the error message`);
  if (control.getAttribute('aria-invalid') !== 'true') fail(`#${field.id} with an error is not aria-invalid`);
  return refs[index];
}

/**
 * 필드 adapter 검사: 키트 id 규칙의 control, 라벨 연결, 설명·오류의 aria-describedby 실재,
 * 오류가 사라지면 오류 참조·aria-invalid 제거, 같은 이름의 두 폼 필드 id 분리.
 */
export async function checkFieldAdapter(Field: ComponentType<FieldAdapterCase>): Promise<void> {
  const base = { name: 'title', label: 'Title label', description: 'Title description' };
  const first: FieldAdapterCase = { ...base, formId: 'check-a', id: formFieldControlId('check-a', base.name), message: 'Title error' };
  const second: FieldAdapterCase = { ...base, formId: 'check-b', id: formFieldControlId('check-b', base.name) };
  const view = (a: FieldAdapterCase) => (
    <>
      <Field {...a} />
      <Field {...second} />
    </>
  );
  const mounted = await mount(view(first));
  try {
    const errorRef = checkFieldConnection(first);
    checkFieldConnection(second);
    const cleared: FieldAdapterCase = { ...first, message: undefined };
    await mounted.rerender(view(cleared));
    checkFieldConnection(cleared);
    const control = document.getElementById(first.id);
    if (control !== null && errorRef !== undefined && describedBy(control).includes(errorRef))
      fail(`error reference #${errorRef} remains on #${first.id} after the error cleared`);
  } finally {
    await mounted.unmount();
  }
}

interface CheckValues {
  readonly name: string;
}

const passthrough: StandardSchemaV1<CheckValues, CheckValues> = {
  '~standard': { version: 1, vendor: 'web-kit-testing', validate: (value) => ({ value: value as CheckValues }) },
};

/** 확인 관문 검사용 화면. 실제 useSaveForm stage로 adapter를 연다. */
function ConfirmHarness({
  Dialog,
  save,
}: {
  readonly Dialog: ComponentType<ConfirmDialogAdapterProps>;
  readonly save: (values: CheckValues) => Promise<void>;
}) {
  const form = useSaveForm<CheckValues, CheckValues>({
    schema: passthrough,
    source: { id: 'check', values: { name: 'shown-snapshot' } },
    confirm: true,
    save: async (values) => save(values),
  });
  const [shown, setShown] = useState<string | undefined>(undefined);
  if (form.stage.kind === 'confirming' && shown !== form.stage.values.name) setShown(form.stage.values.name);
  const open = form.stage.kind !== 'idle';
  return (
    <>
      <button type="button" data-web-kit-check="submit" onClick={() => void form.submit()}>
        submit
      </button>
      <button type="button" data-web-kit-check="change" onClick={() => form.form.setFieldValue('name', 'changed')}>
        change
      </button>
      <Dialog open={open} pending={form.isSaving} onConfirm={() => void form.confirm()} onCancel={form.cancel}>
        {open ? shown : null}
      </Dialog>
    </>
  );
}

function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"],[role="alertdialog"]');
}

function button(scope: HTMLElement, text: string): HTMLElement {
  const found = Array.from(scope.querySelectorAll<HTMLElement>('button,[role="button"]')).find((element) =>
    element.textContent?.includes(text),
  );
  return found ?? fail(`dialog has no "${text}" button`);
}

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
