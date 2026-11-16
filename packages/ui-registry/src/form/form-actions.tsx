// 파일 책임: 이탈 보호(FormGuard)와 저장 흐름의 버튼·실패 줄·확인창(Submit·Cancel·Failure·Confirm·Saved)·대화창 안 폼(FormDialog).
import { FormGuardProvider, FormDialogScopeProvider, useFormGuardBinding, useFormCancel, useFormDialogScope, useFormConfirmBinding, useFormSavedBinding, useFormSubmitBinding, FormRejection } from '@boosterlab/web-kit/form';
import type { NavigateOptions } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { AlertDialog, ConfirmDialog, Dialog } from '../ui/dialog';
import { Pending } from '../ui/pending';
import { errorClass, useFormContext, type FormConfirmContent, type FormSavedContent } from './form-context';

// ─── 이탈 보호 ───────────────────────────────────────────────────────────────

/** 이탈 확인창 한 종류의 문구. keep은 머무르는 버튼이다. */
export interface FormGuardReasonMessages {
  readonly title: string;
  readonly description: string;
  readonly confirm: string;
  readonly keep: string;
}
/** 이탈 보호 문구 전체. navigate는 Router·브라우저 이탈, cancel은 취소 버튼, navigationFailed는 확인 뒤 이동 실패 안내다. */
export interface FormGuardMessages {
  readonly navigate: FormGuardReasonMessages;
  readonly cancel: FormGuardReasonMessages;
  readonly navigationFailed: string;
}
/** 키트가 제공하는 한국어 이탈 문구. 한국어 앱은 이 값을 FormGuard에 그대로 넘긴다. */
export const defaultFormGuardMessages: FormGuardMessages = {
  navigate: { title: '입력을 버리고 이동할까요?', description: '저장하지 않은 변경이 있습니다.', confirm: '이동', keep: '계속 편집' },
  cancel: { title: '작성을 취소할까요?', description: '입력한 내용은 저장되지 않습니다.', confirm: '취소하기', keep: '계속 작성' },
  navigationFailed: '이동하지 못했습니다. 다시 시도해 주세요.',
};

/**
 * 앱(Router 안)에 한 번 둔다. 등록된 폼 중 하나라도 입력이 기준선과 다르면 Router 이동·브라우저 이탈을 한 번 묻고,
 * 저장 중이면 묻지 않고 거부한다. 확인창은 하나뿐이며 문구는 까닭(이동/취소 버튼)별 값이다.
 * 문구는 전체 집합을 받는다(빠진 문구를 다른 언어로 채우지 않는다).
 */
export function FormGuard({
  children,
  messages: copy,
}: {
  readonly children: ReactNode;
  readonly messages: FormGuardMessages;
}) {
  const owner = useFormGuardBinding();
  const text = copy[owner.reason ?? 'navigate'];
  return (
    <FormGuardProvider binding={owner}>
      {children}
      <ConfirmDialog
        open={owner.pending}
        title={text.title}
        confirmLabel={text.confirm}
        cancelLabel={text.keep}
        onConfirm={owner.confirm}
        onCancel={owner.cancel}
      >
        {text.description}
      </ConfirmDialog>
      {owner.failure !== undefined && (
        <p role="alert" className={errorClass}>
          {copy.navigationFailed}
        </p>
      )}
    </FormGuardProvider>
  );
}

/**
 * Router blocker를 거치지 않는 이탈(취소 버튼, 같은 메뉴 다시 누르기)을 같은 판정으로 묻는다.
 * 저장 중이면 아무것도 하지 않고, 입력이 없으면 바로, 있으면 확인 뒤에 run을 실행한다.
 * run이 Router로 이동하면 이미 물었으므로 `ignoreBlocker: true`로 이동한다.
 */
export { useLeave } from '@boosterlab/web-kit/form';

/**
 * 폼 수준 실패 한 줄. 칸에 붙지 못한 저장 실패와, 저장 뒤 완료 처리 실패(다시 시도 = 완료 처리만 다시)를 보인다.
 * 칸 오류가 모두 칸에 붙은 검증 실패는 칸이 알리므로 여기에 그리지 않는다. 위치는 놓는 곳이 정한다.
 */
export function Failure({ className }: { readonly className?: string }) {
  const { editor, copy, renderFailure, formatError } = useFormContext();
  const save = editor.formFailure === undefined ? undefined : renderFailure(editor.formFailure, 'save');
  const completion = editor.completionFailure === undefined ? undefined : renderFailure(editor.completionFailure, 'completion');
  const showCompletion = editor.completionFailure !== undefined && completion !== null && (!editor.acknowledge || editor.stage.kind === 'idle');
  return (
    <>
      {editor.formFailure !== undefined && save !== null ? (
        <p role="alert" data-slot="form-failure" className={cn(failureClass, className)}>
          {save ??
            (editor.formFailure instanceof FormRejection && editor.formFailure.root !== undefined
              ? formatError([editor.formFailure.root]) ?? editor.formFailure.root
              : undefined) ??
            copy.saveFailed}
        </p>
      ) : null}
      {showCompletion ? (
        <p role="alert" data-slot="form-failure" className={cn(failureClass, 'flex flex-wrap items-center gap-2', className)}>
          {completion ?? (editor.stage.kind === 'idle' ? copy.saveFailed : copy.completionFailed)}
          {editor.stage.kind === 'saved' ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void editor.complete()}>
              {copy.retry}
            </Button>
          ) : null}
        </p>
      ) : null}
    </>
  );
}

/**
 * 저장 버튼. 저장 중·확인 대기·완료 처리 중에는 aria-disabled로 잠근다. disabled로 바꾸면 포커스가 본문으로 떨어져
 * 확인창을 닫은 뒤 돌아올 자리가 사라지고, 열린 직후 Tab이 창 밖에서 시작한다.
 * 저장 요청·완료 처리가 진행 중이면 버튼 바로 뒤에 진행 표시(문구는 화면 낭독기용 `messages.saving`)를 둔다.
 * 등록·수정 폼(`useSaveForm({ progress })`)은 화면 전체 진행 덮개가 대신하므로 그리지 않는다(사용자 결정 2026-10-28, 결정 0007 진행 덮개).
 */
export function Submit({
  children,
  className,
  mode = 'primary',
}: {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly mode?: 'primary' | 'secondary';
}) {
  const { editor, copy, submitOrigin } = useFormContext();
  const binding = useFormSubmitBinding(editor, submitOrigin, mode);
  return (
    <>
      <Button
        {...binding.buttonProps}
        className={cn(lockedClass, className)}
      >
        {children ?? copy.submit}
      </Button>
      {binding.pending ? (
        <Pending label={copy.saving} />
      ) : null}
    </>
  );
}

/**
 * 취소 버튼. 대화창 안이면 그 대화창을, 아니면 `to`로 이동한다. 입력이 있으면 취소 문구로 한 번 묻고, 저장·완료 처리 중이면 잠겨 아무것도 하지 않는다.
 */
export function Cancel({
  to,
  children,
  className,
}: {
  /** 이동할 곳. 앱이 등록한 Router 타입(Register)으로 검사된다. */
  readonly to?: NavigateOptions;
  readonly children?: ReactNode;
  readonly className?: string;
}) {
  const { editor, copy } = useFormContext();
  const cancel = useFormCancel(editor, to);
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(lockedClass, className)}
      aria-disabled={cancel.disabled || undefined}
      onClick={() => {
        cancel.cancel();
      }}
    >
      {children ?? copy.cancel}
    </Button>
  );
}

/**
 * 저장 전 확인창(Form이 그린다). useSaveForm({ confirm: true })일 때 확인 대기·저장 중에 열리고, 보여 준 값으로 저장한다.
 * 등록·수정 폼(progress)은 확인하면 닫히고 화면 전체 진행 덮개가 저장 중을 맡는다(확인창 → 덮개 → 완료 창 순서).
 */
export function Confirm({ title, confirmLabel, cancelLabel, body }: FormConfirmContent<unknown>) {
  const { editor, copy, submitOrigin } = useFormContext();
  const { open, stage } = useFormConfirmBinding(editor);
  return (
    <ConfirmDialog
      open={open}
      pending={editor.isSaving}
      pendingLabel={copy.saving}
      returnFocus={submitOrigin}
      title={title ?? copy.confirmTitle}
      confirmLabel={confirmLabel ?? copy.confirm}
      cancelLabel={cancelLabel ?? copy.cancel}
      onConfirm={() => void editor.confirm()}
      onCancel={editor.cancel}
    >
      {open && 'values' in stage ? body?.(stage.values) : null}
    </ConfirmDialog>
  );
}

/**
 * 저장 완료 확인창(Form이 그린다). useSaveForm({ acknowledge: true })일 때 저장 뒤 열리고, 확인하면 완료 처리(onSaved, 보통 이동)를 한 번 실행한다.
 * 완료 처리가 실패하면 창 안에 알리고 확인이 완료 처리만 다시 한다(저장 요청은 다시 나가지 않는다).
 */
export function Saved({ title, confirmLabel, body }: FormSavedContent) {
  const { editor, copy, renderFailure } = useFormContext();
  const { attempt } = useFormSavedBinding(editor);
  const failure = editor.completionFailure === undefined ? undefined : renderFailure(editor.completionFailure, 'completion');
  const stage = editor.stage;
  return (
    <AlertDialog
      key={attempt}
      open={editor.acknowledge && stage.kind === 'saved'}
      pending={stage.kind === 'saved' && stage.completing}
      pendingLabel={copy.saving}
      title={title ?? copy.savedTitle}
      confirmLabel={confirmLabel ?? copy.savedConfirm}
      onConfirm={() => void editor.complete()}
    >
      {body}
      {editor.completionFailure !== undefined && failure !== null ? (
        <p role="alert" className={errorClass}>
          {failure ?? copy.completionFailed}
        </p>
      ) : null}
    </AlertDialog>
  );
}

/**
 * 대화창 안 폼. 닫기(Esc·바깥·닫기·취소)는 이 대화창 안 폼만 보고 묻는다. 저장 중에는 닫히지 않는다.
 * 대화창이 열릴 때마다 폼을 새로 시작하는 일(열 때 마운트)은 호출자가 한다.
 */
export function FormDialog({
  title,
  onClose,
  children,
  className,
}: {
  readonly title: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const binding = useFormDialogScope(onClose);
  const { busy, requestClose } = binding;
  return (
    <FormDialogScopeProvider binding={binding}>
      <Dialog
        open
        title={title}
        closable={!busy}
        className={className}
        onClose={requestClose}
        footer={null}
      >
        {children}
      </Dialog>
    </FormDialogScopeProvider>
  );
}

// 버튼·실패 줄 표시 클래스.
const failureClass = 'rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive';
/** aria-disabled로 잠근 버튼(포커스는 유지)의 표시. */
const lockedClass = 'aria-disabled:cursor-default aria-disabled:opacity-50';
