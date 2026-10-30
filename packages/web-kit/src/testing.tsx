// 파일 책임: 프로젝트 UI adapter가 키트 보장(필드 접근성 연결·확인 관문·재시도 focus)을 깨지 않는지 실제 DOM으로 검사한다.
// 테스트 러너에 의존하지 않는다. 각 검사는 위반 시 이유를 담은 Error로 거절하고, 통과하면 undefined로 끝난다.
import { act, type ComponentType, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { formFieldControlId } from './form/save-form';

/** 필드 adapter가 받는 검사 입력. id는 formFieldControlId(formId, name)이며 control이 이 id를 가져야 한다. */
export interface FieldAdapterCase {
  readonly formId: string;
  readonly name: string;
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly message?: string;
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

function fail(message: string): never { throw new Error(`[web-kit/testing] ${message}`); }

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

export { checkConfirmDialogAdapter, checkRetryFocusAdapter } from './testing/adapters';
export type { ConfirmDialogAdapterProps, RetryAdapterProps } from './testing/adapters';
