// 파일 책임: 폼 이탈 보호·제출·입력 적용·대화창 범위의 공통 순서를 연결한다.
import type { ChoiceNode } from '../choice-binding';
import { flushSync } from 'react-dom';
import { getBy, setBy, useSelector } from '@tanstack/react-form';
import { useBlocker, useRouter, type NavigateOptions } from '@tanstack/react-router';
import { createContext, createElement, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { requestFormChange, writeFormValues } from './references';
import { createFormNavigation, type FormNavigation as Navigation, type LeaveReason } from './navigation';
import { lockField, type SaveFormEditor } from './save-form';
type AnyEditor = SaveFormEditor<any, any>;
const GuardContext = createContext<Navigation | undefined>(undefined);
/** 대화창 안 폼의 범위. 닫기는 이 범위의 폼만 묻는다. */
const ScopeContext = createContext<{ readonly id: object; readonly close: () => void } | undefined>(undefined);


/** 보호 등록소와 Router 이탈 요청을 같은 판정으로 연결한다. */
export function useFormGuardBinding() {
  const [owner] = useState(createFormNavigation);
  useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  const blocker = useBlocker({ shouldBlockFn: () => owner.blocked(), withResolver: true, enableBeforeUnload: () => owner.blocked() });
  const proceed = blocker.status === 'blocked' ? blocker.proceed : undefined;
  const reset = blocker.status === 'blocked' ? blocker.reset : undefined;
  useEffect(() => {
    if (proceed === undefined) return;
    // 저장 중이면 'blocked'라 묻지 않고 되돌린다. 입력이 있으면 한 번 묻고, 답에 따라 진행하거나 되돌린다.
    if (owner.request(proceed, { onCancel: reset }) === 'blocked') reset?.();
  }, [owner, proceed, reset]);
  return owner;
}
/** Router 밖 이동도 등록된 폼의 이탈 판정에 연결한다. */
export function useLeave(): (run: () => void | Promise<void>, reason?: LeaveReason) => void {
  const owner = useContext(GuardContext);
  if (owner === undefined) throw new Error('useLeave requires <FormGuard>');
  return (run, reason = 'navigate') => {
    owner.request(run, { reason });
  };
}

/** 고칠 수 없는 칸이면 마운트 동안 폼에 알린다(그 칸으로 대응된 서버 오류는 폼 한 줄로 간다). */
function useLocked(editor: AnyEditor, name: string, disabled: boolean) {
  useLayoutEffect(() => (disabled ? lockField(editor.form, name) : undefined), [editor.form, name, disabled]);
}

/** 오류 값 중 첫 문자열 문구를 고른다. 원시 응답 객체는 보이지 않는다. */
function firstMessage(errors: readonly unknown[]): string | undefined {
  for (const error of errors) {
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  }
  return undefined;
}

/** 저장 요청 또는 저장 뒤 완료 처리(이동 등)가 진행 중인가. 이 동안 버튼은 잠기고 저장 버튼 옆에 진행 표시가 선다. */
function inProgress(editor: AnyEditor): boolean {
  return editor.stage.kind === 'saving' || (editor.stage.kind === 'saved' && editor.stage.completing);
}


/** 폼 등록·최신 상태 알림·제출 전파 차단·버튼 기억을 연결한다. */
export function useFormRootBinding(editor: AnyEditor, protect = true, formatError?: (errors: readonly unknown[]) => string | undefined) {
  const owner = useContext(GuardContext);
  if (protect && owner === undefined) throw new Error('<Form> requires <FormGuard> (or protect={false})');
  const scope = useContext(ScopeContext);
  const current = useRef(editor);
  current.current = editor;
  const [id] = useState(() => ({}));
  const submitOrigin = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!protect || owner === undefined) return;
    return owner.register(id, {
      scope: scope?.id,
      read: () => {
        const state = current.current.getState();
        return { dirty: state.isDirty, busy: state.isSaving, identity: current.current.identity };
      },
    });
  }, [owner, id, scope?.id, protect]);
  useLayoutEffect(() => {
    owner?.changed();
  }, [owner, editor.isDirty, editor.isSaving, editor.identity]);
  return { submitOrigin, formatError: formatError ?? firstMessage, formProps: { noValidate: true,
    onSubmit: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();
      submitOrigin.current = (event.nativeEvent as SubmitEvent).submitter ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      void editor.submit();
    },
  } };
}

/** 칸 등록·필수 여부와 참조 정리 후 원자적인 값 적용 순서를 제공한다. */
export function useFormFieldBinding(editor: AnyEditor, name: string, disabled = false) {
  useLocked(editor, name, disabled);
  const required = useSelector(editor.form.store, () => editor.isRequired(name));
  const visible = useSelector(editor.form.store, () => editor.isVisible(name));
  return { id: editor.fieldId(name), required, visible,
    change: (value: unknown, handleChange: (value: any) => void, onApplied?: () => void) => {
      void requestFormChange(editor.form, setBy(editor.form.state.values, name, value), (accepted) => {
        flushSync(() => {
          writeFormValues(editor.form, accepted);
          handleChange(getBy(accepted, name));
          onApplied?.();
        });
      });
    },
  };
}
/** 문자열 입력에 기존 값과 상한을 반영한 변경 연결을 제공한다. */
export function formTextBinding(value: unknown, maxLength: number | undefined, change: (next: string) => void) {
  const text = typeof value === 'string' ? value : '';
  return {
    value: text,
    change: (next: string) => {
      if (maxLength !== undefined && next.length > Math.max(maxLength, text.length)) return;
      change(next);
    },
  };
}
/** 선택지 재시도 버튼에서 상태 영역, 준비된 입력으로 포커스를 넘긴다. */
export function useOptionsRetryFocus(retry?: () => void) {
  const retried = useRef(false);
  return {
    onRetry: (event: MouseEvent<HTMLButtonElement>) => {
      retried.current = true;
      (event.currentTarget.closest('[role="group"]') as HTMLElement | null)?.focus();
      retry?.();
    },
    inputRef: (node: HTMLSelectElement | null) => {
      if (node === null || !retried.current) return;
      retried.current = false;
      if (document.activeElement === null || document.activeElement === document.body) node.focus();
    },
  };
}

/** 취소 요청은 진행 차단 뒤 현재 범위 닫기 또는 확인된 이동으로 연결한다. */
export function useFormCancel(editor: AnyEditor, to?: NavigateOptions) {
  const owner = useContext(GuardContext);
  const scope = useContext(ScopeContext);
  const router = useRouter();
  return { disabled: inProgress(editor), cancel: () => {
        if (editor.getState().isSaving || inProgress(editor)) return;
        const run =
          scope !== undefined
            ? scope.close
            : () => {
                if (to !== undefined) void router.navigate({ ...to, ignoreBlocker: true });
              };
        if (owner === undefined) run();
        else owner.request(run, { scope: scope?.id, reason: 'cancel' });
  } };
}

/** 중첩 대화창의 범위를 등록하고 자기 범위 이탈만 확인한다. */
export function useFormDialogScope(onClose: () => void) {
  const owner = useContext(GuardContext);
  if (owner === undefined) throw new Error('<Form.Dialog> requires <FormGuard>');
  const parent = useContext(ScopeContext);
  const [id] = useState(() => ({}));
  useLayoutEffect(() => owner.registerScope(id, parent?.id), [owner, id, parent?.id]);
  useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  const busy = owner.busy(id);
  return { scope: { id, close: onClose }, busy, requestClose: () => { owner.request(onClose, { scope: id, reason: 'cancel' }); } };
}

/** 확인 단계와 진행 덮개의 연결로 창 열림을 정한다. */
export function useFormConfirmBinding(editor: AnyEditor) {
  const viaConfirm = useRef(false);
  if (editor.stage.kind === 'confirming') viaConfirm.current = true;
  else if (editor.stage.kind !== 'saving') viaConfirm.current = false;
  const stage = editor.stage;
  const open = stage.kind === 'confirming' || (stage.kind === 'saving' && viaConfirm.current && editor.progress === undefined);
  return { open, stage };
}

/** 완료 처리 실패마다 다시 확인할 수 있도록 확인 주기를 구분한다. */
export function useFormSavedBinding(editor: AnyEditor) {
  const attempts = useRef({ failure: undefined as unknown, count: 0 });
  if (editor.completionFailure !== undefined && editor.completionFailure !== attempts.current.failure)
    attempts.current = { failure: editor.completionFailure, count: attempts.current.count + 1 };
  return { attempt: attempts.current.count };
}

/** 폼 상태와 제출 시작 요소를 표현 설정 없이 전달한다. */
const FormBindingContext = createContext<{ editor: AnyEditor; submitOrigin: { current: HTMLElement | null } } | undefined>(undefined);
/** 같은 편집 상태를 폼의 모든 부품에 전달한다. */
export function FormBindingProvider({ editor, submitOrigin, children }: { editor: AnyEditor; submitOrigin: { current: HTMLElement | null }; children: ReactNode }) {
  return createElement(FormBindingContext.Provider, { value: { editor, submitOrigin } }, children);
}
/** 패키지에서 소유한 현재 폼과 제출 시작점을 읽는다. */
export function useFormBinding() {
  const value = useContext(FormBindingContext);
  if (value === undefined) throw new Error('Form parts require <Form editor>');
  return value;
}
/** 프로젝트가 현재 편집 상태를 직접 읽는다. */
export function useFormEditor<T = unknown>(): SaveFormEditor<T> {
  return useFormBinding().editor as SaveFormEditor<T>;
}
/** 기본·보조 저장 버튼의 잠금과 제출 시작점을 같은 상태에 연결한다. */
export function useFormSubmitBinding(editor: AnyEditor, submitOrigin: { current: HTMLElement | null }, mode: 'primary' | 'secondary') {
  const locked = editor.stage.kind !== 'idle' || (mode === 'secondary' && editor.submitSecondary === undefined);
  return {
    buttonProps: {
      type: mode === 'primary' ? 'submit' as const : 'button' as const,
      'aria-disabled': locked || undefined,
      onClick: mode === 'secondary' ? (event: MouseEvent<HTMLButtonElement>) => {
        if (locked) return;
        submitOrigin.current = event.currentTarget;
        void editor.submitSecondary?.();
      } : undefined,
    },
    pending: editor.progress === undefined && (editor.saveMode ?? 'primary') === mode && inProgress(editor),
  };
}
/** 파일 선택 취소는 값을 유지하고 제거 시 기존 파일과 새 파일을 구분한다. */
export function formFileBinding(value: import('./file').FormFileValue | undefined, change: (value: import('./file').FormFileValue) => void) {
  const current = value ?? { kind: 'empty' as const };
  return {
    name: current.kind === 'selected' ? current.file.name : current.kind === 'existing' ? current.name : undefined,
    inputKey: current.kind === 'selected' ? 'selected' : 'idle',
    select: (file?: File) => { if (file !== undefined) change({ kind: 'selected', file }); },
    remove: () => change(current.kind === 'existing' ? { kind: 'removed' } : { kind: 'empty' }),
  };
}

/** 오류·설명 ID를 입력의 접근성 속성에 연결한다. */
export function formFieldFeedback(id: string, message?: string, describedBy: readonly string[] = []) {
  const errorId = message === undefined ? undefined : id + '-error';
  const ids = errorId === undefined ? describedBy : [...describedBy, errorId];
  return { errorId, control: { id, 'aria-describedby': ids.length === 0 ? undefined : ids.join(' '), 'aria-invalid': message !== undefined } };
}

/** 이탈 보호 hook의 소유자를 배치 없이 자식 폼에 전달한다. */
export function FormGuardProvider({ binding, children }: {
  readonly binding: ReturnType<typeof useFormGuardBinding>;
  readonly children: ReactNode;
}) {
  return createElement(GuardContext.Provider, { value: binding }, children);
}
/** 대화창 hook의 범위를 배치 없이 자식 폼에 전달한다. */
export function FormDialogScopeProvider({ binding, children }: {
  readonly binding: ReturnType<typeof useFormDialogScope>;
  readonly children: ReactNode;
}) {
  return createElement(ScopeContext.Provider, { value: binding.scope }, children);
}

/** 준비된 전체 선택지만 폼의 값 투영에 등록한다. 미준비·서버 검색은 원본을 보존한다. */
export function useFormChoiceBinding(editor: AnyEditor, name: string, nodes: readonly ChoiceNode[] | undefined) {
  const signature = JSON.stringify(nodes);
  useLayoutEffect(() => nodes === undefined ? undefined : editor.registerChoice(name, nodes), [editor.form, name, signature]);
}
