// 파일 책임: 폼 기본 UI의 묶음 부품(Form.*)과 앱에 한 번 두는 이탈 보호(FormGuard).
// 각 부품은 같은 편집 상태(useSaveForm 결과)를 context로 읽어서, 칸·버튼·오류 줄을 어디에 두어도 저장·검증·focus 연결을 다시 쓰지 않는다.
// 저장 수명은 useSaveForm이, 이탈 판정은 createFormNavigation이 소유하고 여기는 표시와 사용자 입력 연결만 맡는다.
import { useBlocker, useRouter, type NavigateOptions } from '@tanstack/react-router';
import { useSelector, type AnyFormApi, type DeepKeys, type DeepValue } from '@tanstack/react-form';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { AlertDialog, ConfirmDialog, Dialog } from '../ui/dialog';
import { Pending } from '../ui/pending';
import { FormArrayField, type FormArrayRows } from './array';
import { FieldFrame, type FieldControlProps } from './field';
import type { FormFileValue } from './file';
import { createFormNavigation, type FormNavigation as Navigation, type LeaveReason } from './navigation';
import { lockField, type SaveFormEditor } from './save-form';
import { useFormSection } from './sections';

// ─── 이탈 보호 ───────────────────────────────────────────────────────────────

const defaultGuardMessages = {
  navigate: { title: '입력을 버리고 이동할까요?', description: '저장하지 않은 변경이 있습니다.', confirm: '이동', keep: '계속 편집' },
  cancel: { title: '작성을 취소할까요?', description: '입력한 내용은 저장되지 않습니다.', confirm: '취소하기', keep: '계속 작성' },
  navigationFailed: '이동하지 못했습니다. 다시 시도해 주세요.',
};
export type FormGuardMessages = {
  readonly navigate: typeof defaultGuardMessages.navigate;
  readonly cancel: typeof defaultGuardMessages.cancel;
  readonly navigationFailed: string;
};

const GuardContext = createContext<Navigation | undefined>(undefined);
/** 대화창 안 폼의 범위. 닫기는 이 범위의 폼만 묻는다. */
const ScopeContext = createContext<{ readonly id: object; readonly close: () => void } | undefined>(undefined);

/**
 * 앱(Router 안)에 한 번 둔다. 등록된 폼 중 하나라도 입력이 기준선과 다르면 Router 이동·브라우저 이탈을 한 번 묻고,
 * 저장 중이면 묻지 않고 거부한다. 확인창은 하나뿐이며 문구는 까닭(이동/취소 버튼)별 값이다.
 */
export function FormGuard({
  children,
  messages,
}: {
  readonly children: ReactNode;
  readonly messages?: { readonly navigate?: Partial<FormGuardMessages['navigate']>; readonly cancel?: Partial<FormGuardMessages['cancel']>; readonly navigationFailed?: string };
}) {
  const [owner] = useState(createFormNavigation);
  useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  const copy = {
    navigate: { ...defaultGuardMessages.navigate, ...messages?.navigate },
    cancel: { ...defaultGuardMessages.cancel, ...messages?.cancel },
    navigationFailed: messages?.navigationFailed ?? defaultGuardMessages.navigationFailed,
  };
  const blocker = useBlocker({ shouldBlockFn: () => owner.blocked(), withResolver: true, enableBeforeUnload: () => owner.blocked() });
  const proceed = blocker.status === 'blocked' ? blocker.proceed : undefined;
  const reset = blocker.status === 'blocked' ? blocker.reset : undefined;
  useEffect(() => {
    if (proceed === undefined) return;
    // 저장 중이면 'blocked'라 묻지 않고 되돌린다. 입력이 있으면 한 번 묻고, 답에 따라 진행하거나 되돌린다.
    if (owner.request(proceed, { onCancel: reset }) === 'blocked') reset?.();
  }, [owner, proceed, reset]);
  const text = copy[owner.reason ?? 'navigate'];
  return (
    <GuardContext.Provider value={owner}>
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
        <p role="alert" className="wk-error">
          {copy.navigationFailed}
        </p>
      )}
    </GuardContext.Provider>
  );
}

/**
 * Router blocker를 거치지 않는 이탈(취소 버튼, 같은 메뉴 다시 누르기)을 같은 판정으로 묻는다.
 * 저장 중이면 아무것도 하지 않고, 입력이 없으면 바로, 있으면 확인 뒤에 run을 실행한다.
 * run이 Router로 이동하면 이미 물었으므로 `ignoreBlocker: true`로 이동한다.
 */
export function useLeave(): (run: () => void | Promise<void>, reason?: LeaveReason) => void {
  const owner = useContext(GuardContext);
  if (owner === undefined) throw new Error('useLeave requires <FormGuard>');
  return (run, reason = 'navigate') => {
    owner.request(run, { reason });
  };
}

// ─── 폼 ─────────────────────────────────────────────────────────────────────

const defaultFormMessages = {
  saveFailed: '저장하지 못했습니다. 입력을 확인해 주세요.',
  completionFailed: '저장은 완료됐지만 다음 작업을 진행하지 못했습니다.',
  retry: '다시 시도',
  loading: '불러오는 중입니다.',
  optionsFailed: '선택지를 불러오지 못했습니다.',
  choose: '선택',
  submit: '저장',
  cancel: '취소',
  confirmTitle: '저장할까요?',
  confirm: '저장',
  savedTitle: '저장되었습니다.',
  savedConfirm: '확인',
  saving: '저장 중입니다.',
  removeFile: '파일 삭제',
  count: (current: number, max: number) => `${current}/${max}`,
  sectionErrors: (count: number) => `오류 ${count}개`,
};
export type FormMessages = typeof defaultFormMessages;

/** 실패가 보이는 자리. save는 저장 실패 한 줄, completion은 저장 뒤 완료 처리 실패, options는 선택지 조회 실패다. */
export type FormFailurePlace = 'save' | 'completion' | 'options';
/** 실패 문구. undefined면 키트 기본 문구, null이면 그 자리에 아무것도 그리지 않는다(앱 경계가 이미 알린 실패 등). */
export type RenderFormFailure = (failure: unknown, place: FormFailurePlace) => ReactNode | null | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 부품은 값 타입을 모르고 이름으로만 접근한다.
type AnyEditor = SaveFormEditor<any, any>;
type FormContextValue = {
  readonly editor: AnyEditor;
  readonly copy: FormMessages;
  readonly renderFailure: RenderFormFailure;
  readonly formatError: (errors: readonly unknown[]) => string | undefined;
  readonly submitOrigin: { current: HTMLElement | null };
};
const FormContext = createContext<FormContextValue | undefined>(undefined);

/** 지금 폼 context를 읽는다. Form 밖에서 쓰면 바로 알린다. */
function useFormContext(): FormContextValue {
  const value = useContext(FormContext);
  if (value === undefined) throw new Error('Form parts require <Form editor>');
  return value;
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

/**
 * 폼 하나. form 요소(브라우저 검증 끔·제출 이벤트를 이 폼에서 멈춤)와 이탈 보호 등록을 맡고, 배치는 children이 정한다.
 * protect={false}는 로그인처럼 이탈을 묻지 않는 제품 예외에만 쓴다.
 */
function FormRoot({
  editor,
  protect = true,
  messages,
  renderFailure,
  formatError,
  children,
  ...formProps
}: {
  readonly editor: AnyEditor;
  readonly protect?: boolean;
  readonly messages?: Partial<FormMessages>;
  readonly renderFailure?: RenderFormFailure;
  /** 칸 오류 값을 표시 문구로 바꾼다(번역 참조 해소 등). 없으면 첫 문자열. */
  readonly formatError?: (errors: readonly unknown[]) => string | undefined;
  readonly children: ReactNode;
} & Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'noValidate' | 'children'>) {
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
  const value: FormContextValue = {
    editor,
    copy: { ...defaultFormMessages, ...messages },
    renderFailure: renderFailure ?? (() => undefined),
    formatError: formatError ?? firstMessage,
    submitOrigin,
  };
  return (
    <FormContext.Provider value={value}>
      <form
        {...formProps}
        className={join('wk-form', formProps.className)}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          // 대화창(portal) 안 폼의 제출이 React 트리를 따라 바깥 폼까지 올라가 바깥 폼도 제출되는 일을 막는다.
          event.stopPropagation();
          submitOrigin.current =
            (event.nativeEvent as SubmitEvent).submitter ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
          void editor.submit();
        }}
      >
        {children}
      </form>
    </FormContext.Provider>
  );
}

/** 필드 하나의 공통 속성. */
export interface FormFieldProps {
  readonly name: string;
  readonly label: string;
  readonly description?: string;
  /** 고칠 수 없는 칸. 오류도 숨긴다. */
  readonly disabled?: boolean;
}

/** 입력을 바꿔 끼울 때 render 함수가 받는 연결. 값·검증·오류·focus id는 키트가 맡는다. */
export interface FormControl<V = unknown> extends FieldControlProps {
  readonly name: string;
  readonly value: V;
  readonly change: (value: V) => void;
  readonly blur: () => void;
  readonly disabled: boolean;
  readonly 'aria-required': boolean;
}

/** 라벨·필수 별표·설명·오류·aria를 칸 하나에 연결하고 입력은 children이 그린다(F5: 입력을 바꿔도 검증은 남는다). */
function Field<V = unknown>({
  name,
  label,
  description,
  disabled = false,
  labelTarget = 'control',
  children,
}: FormFieldProps & {
  /** 입력이 라벨 요소로 이름 지을 수 없는 묶음이면 'group'. */
  readonly labelTarget?: 'control' | 'group';
  readonly children: (control: FormControl<V>, labelId: string) => ReactNode;
}) {
  const { editor, formatError } = useFormContext();
  useLocked(editor, name, disabled);
  // 필수 표시는 schema가 정한다(칸만 비운 지금 값을 schema가 거부하는가). 값이 바뀌면 다시 판정한다.
  const isRequired = useSelector(editor.form.store, () => editor.isRequired(name));
  return (
    <editor.form.Field name={name}>
      {(field) => (
        <FieldFrame
          id={editor.fieldId(name)}
          label={label}
          description={description}
          required={isRequired}
          labelTarget={labelTarget}
          message={disabled ? undefined : formatError(field.state.meta.errors)}
          classes={{ root: 'wk-field', label: 'wk-label', required: 'wk-required', description: 'wk-description', error: 'wk-error' }}
        >
          {(control, labelId) =>
            children(
              {
                ...control,
                name,
                value: field.state.value as V,
                change: (value) => field.handleChange(value as never),
                blur: field.handleBlur,
                disabled,
                'aria-required': isRequired,
              },
              labelId,
            )
          }
        </FieldFrame>
      )}
    </editor.form.Field>
  );
}

/**
 * 한 줄 문자열 입력. maxLength는 길어지는 편집만 거부한다(한글 조합 커밋이 maxLength를 넘겨도 꼬리를 자르지 않고 받지 않는다).
 * 서버가 준 초과 초기값은 줄이는 편집을 막지 않는다. showCount면 글자 수를 보인다.
 */
function Text({
  type = 'text',
  placeholder,
  autoComplete,
  autoFocus,
  inputMode,
  maxLength,
  showCount = false,
  onKeyDown,
  ...field
}: FormFieldProps & {
  readonly type?: 'text' | 'email' | 'password' | 'tel' | 'date' | 'time' | 'number' | 'url' | 'search';
  readonly placeholder?: string;
  readonly autoComplete?: string;
  readonly autoFocus?: boolean;
  readonly inputMode?: 'numeric' | 'decimal' | 'text' | 'tel' | 'email';
  readonly maxLength?: number;
  readonly showCount?: boolean;
  readonly onKeyDown?: (event: KeyboardEvent) => void;
}) {
  const { copy } = useFormContext();
  return (
    <Field<string> {...field}>
      {({ value, change, blur, ...control }) => {
        const text = typeof value === 'string' ? value : '';
        return (
          <>
            <input
              {...control}
              className="wk-input"
              type={type}
              placeholder={placeholder}
              autoComplete={autoComplete}
              autoFocus={autoFocus}
              inputMode={inputMode}
              maxLength={maxLength}
              onKeyDown={onKeyDown}
              value={text}
              onBlur={blur}
              onChange={(event) => {
                const next = event.target.value;
                if (maxLength !== undefined && next.length > Math.max(maxLength, text.length)) return;
                change(next);
              }}
            />
            {showCount && maxLength !== undefined ? (
              <p className="wk-count" aria-live="polite">
                {copy.count(text.length, maxLength)}
              </p>
            ) : null}
          </>
        );
      }}
    </Field>
  );
}

/** 여러 줄 문자열 입력. maxLength 규칙은 Text와 같다. */
function TextArea({
  placeholder,
  rows,
  maxLength,
  showCount = false,
  ...field
}: FormFieldProps & { readonly placeholder?: string; readonly rows?: number; readonly maxLength?: number; readonly showCount?: boolean }) {
  const { copy } = useFormContext();
  return (
    <Field<string> {...field}>
      {({ value, change, blur, ...control }) => {
        const text = typeof value === 'string' ? value : '';
        return (
          <>
            <textarea
              {...control}
              className="wk-input wk-textarea"
              placeholder={placeholder}
              rows={rows}
              maxLength={maxLength}
              value={text}
              onBlur={blur}
              onChange={(event) => {
                const next = event.target.value;
                if (maxLength !== undefined && next.length > Math.max(maxLength, text.length)) return;
                change(next);
              }}
            />
            {showCount && maxLength !== undefined ? (
              <p className="wk-count" aria-live="polite">
                {copy.count(text.length, maxLength)}
              </p>
            ) : null}
          </>
        );
      }}
    </Field>
  );
}

/** 선택지 상태. 서버에서 받는 선택지는 준비되기 전 입력 대신 상태 묶음이 선다. */
export type OptionsStatus = 'ready' | 'loading' | { readonly failure: unknown };

/**
 * 문자열 값 하나 고르기. 빈 선택지(placeholder)는 값이 비었을 때만 둔다(필수 선택을 고른 뒤 다시 비우는 길을 두지 않는다).
 * onChange는 사용자가 고른 직후에만 부른다(함께 비울 값 등). 원본 교체로 바뀐 값에는 부르지 않는다.
 */
function Select({
  options,
  placeholder,
  status = 'ready',
  onRetry,
  onChange,
  ...field
}: FormFieldProps & {
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly placeholder?: string;
  readonly status?: OptionsStatus;
  readonly onRetry?: () => void;
  readonly onChange?: (value: string) => void;
}) {
  const { copy, renderFailure } = useFormContext();
  const retried = useRef(false);
  return (
    <Field<unknown> {...field} labelTarget={status === 'ready' ? 'control' : 'group'}>
      {({ value, change, blur, ...control }, labelId) => {
        const selected = value === null || value === undefined ? '' : String(value);
        if (status !== 'ready') {
          const failureText = status === 'loading' ? undefined : renderFailure(status.failure, 'options');
          return (
            <div
              key="state"
              id={control.id}
              aria-describedby={control['aria-describedby']}
              aria-invalid={control['aria-invalid']}
              role="group"
              tabIndex={-1}
              aria-labelledby={labelId}
              className="wk-options-state"
            >
              {status === 'loading' ? (
                <span role="status">{copy.loading}</span>
              ) : failureText === null ? null : (
                <span role="alert">
                  {failureText ?? copy.optionsFailed}
                  {onRetry === undefined ? null : (
                    <button
                      type="button"
                      className="wk-button wk-button-ghost"
                      onClick={(event) => {
                        retried.current = true;
                        // 버튼이 사라지므로 묶음에 포커스를 둔다. 선택지가 오면 입력으로 넘긴다.
                        (event.currentTarget.closest('[role="group"]') as HTMLElement | null)?.focus();
                        onRetry();
                      }}
                    >
                      {copy.retry}
                    </button>
                  )}
                </span>
              )}
            </div>
          );
        }
        return (
          <select
            key="control"
            {...control}
            ref={(node) => {
              if (node === null || !retried.current) return;
              retried.current = false;
              // 묶음이 빠지며 포커스가 본문으로 떨어졌을 때만 옮긴다. 그새 다른 곳으로 옮겼으면 건드리지 않는다.
              if (document.activeElement === null || document.activeElement === document.body) node.focus();
            }}
            className="wk-input"
            value={selected}
            onBlur={blur}
            onChange={(event) => {
              change(event.target.value);
              onChange?.(event.target.value);
            }}
          >
            {selected === '' ? <option value="">{placeholder ?? copy.choose}</option> : null}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }}
    </Field>
  );
}

/** boolean 값 하나. 라벨이 체크박스 옆에 붙는다. onChange는 사용자가 바꾼 직후에만 부른다. */
function Checkbox({ onChange, ...field }: FormFieldProps & { readonly onChange?: (checked: boolean) => void }) {
  const { editor, formatError } = useFormContext();
  useLocked(editor, field.name, field.disabled === true);
  const id = editor.fieldId(field.name);
  return (
    <editor.form.Field name={field.name}>
      {(state) => {
        const message = field.disabled ? undefined : formatError(state.state.meta.errors);
        return (
          <div className="wk-field wk-field-check">
            <label className="wk-check-label" htmlFor={id}>
              <input
                id={id}
                name={field.name}
                type="checkbox"
                className="wk-checkbox"
                disabled={field.disabled}
                aria-invalid={message !== undefined}
                aria-describedby={message === undefined ? undefined : `${id}-error`}
                checked={state.state.value === true}
                onBlur={state.handleBlur}
                onChange={(event) => {
                  state.handleChange(event.target.checked as never);
                  onChange?.(event.target.checked);
                }}
              />
              {field.label}
            </label>
            {message === undefined ? null : (
              <p id={`${id}-error`} role="alert" className="wk-error">
                {message}
              </p>
            )}
          </div>
        );
      }}
    </editor.form.Field>
  );
}

/**
 * 파일 하나 고르기. 값은 FormFileValue이고 지금 파일 이름을 상태에서 그린다(네이티브 입력은 다시 그려지면 비므로 근거로 쓰지 않는다).
 * 선택 창을 열었다 취소해도 값은 그대로다. 지우는 길은 제거 버튼 하나다(실수로 연 창 때문에 이미 있는 파일을 잃지 않는다).
 * 다른 칸 오류·재마운트·대화창·저장 실패 뒤에도 고른 File은 폼 값에 그대로 남는다. 업로드는 프로젝트 save가 한다.
 */
function FileField({ accept, ...field }: FormFieldProps & { readonly accept?: string }) {
  const { copy } = useFormContext();
  return (
    <Field<FormFileValue> {...field}>
      {({ value, change, blur, ...control }) => {
        const current: FormFileValue = value ?? { kind: 'empty' };
        const name = current.kind === 'selected' ? current.file.name : current.kind === 'existing' ? current.name : undefined;
        const nameId = `${control.id}-file`;
        const describedBy = [control['aria-describedby'], name === undefined ? undefined : nameId].filter(Boolean).join(' ');
        return (
          <div className="wk-actions">
            <input
              {...control}
              aria-describedby={describedBy === '' ? undefined : describedBy}
              // 고른 파일이 사라지면(제거·초기화) 네이티브 입력도 비우도록 다시 만든다.
              key={current.kind === 'selected' ? 'selected' : 'idle'}
              type="file"
              accept={accept}
              onBlur={blur}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file === undefined) return;
                change({ kind: 'selected', file });
              }}
            />
            {name === undefined ? null : (
              <>
                <span id={nameId}>{name}</span>
                <button
                  type="button"
                  className="wk-button wk-button-ghost"
                  disabled={field.disabled}
                  onClick={() => change(current.kind === 'existing' ? { kind: 'removed' } : { kind: 'empty' })}
                >
                  {copy.removeFile}
                </button>
              </>
            )}
          </div>
        );
      }}
    </Field>
  );
}

/** 줄을 늘리고 줄이는 배열 입력(FormArrayField)을 이 폼에 연결한다. 줄의 모양과 문구는 children이 그린다. */
function ArrayField({
  name,
  minItems,
  maxItems,
  children,
}: {
  readonly name: string;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly children: (rows: FormArrayRows<never>) => ReactNode;
}) {
  const { editor } = useFormContext();
  return (
    <FormArrayField form={editor.form} name={name as never} minItems={minItems} maxItems={maxItems}>
      {children as unknown as (rows: FormArrayRows<unknown>) => ReactNode}
    </FormArrayField>
  );
}

/**
 * 칸 묶음 하나(제목 있는 구역). `fields`(이 구역 칸의 정확한 경로나 접두)를 주면 접을 수 있는 구역이 된다:
 * 머리글 버튼이 열고 닫고, 구역 칸에 오류가 있으면 머리글에 표시하며, 제출 뒤 오류가 있으면 펼친 다음 첫 오류 칸에 포커스한다.
 * 접을 수 있으려면 자기 칸을 알아야 한다(오류를 숨긴 채 닫혀 있지 않게).
 */
function Section({
  title,
  fields,
  children,
  className,
}: {
  readonly title?: ReactNode;
  readonly fields?: readonly string[];
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const { editor, copy } = useFormContext();
  if (fields !== undefined) {
    return (
      <FormSection form={editor.form} fields={fields} title={title} errorLabel={copy.sectionErrors} className={className}>
        {children}
      </FormSection>
    );
  }
  return (
    <fieldset className={join('wk-section', className)}>
      {title === undefined ? null : <legend className="wk-section-title">{title}</legend>}
      {children}
    </fieldset>
  );
}

/**
 * 접을 수 있는 구역(열림·오류 표시·제출 뒤 펼침). `Form.Section fields`가 이것을 쓰고, 키트 `Form` 밖의 폼(useSaveForm의 form만 있는 화면)도
 * 같은 부품을 직접 쓴다. 닫혀도 칸은 마운트된 채 숨긴다(값·검증 유지). 오류 표시는 1.5처럼 머리글의 「!」이고, 화면 낭독기는 오류 수(`errorLabel`)를 읽는다.
 */
export function FormSection({
  form,
  fields,
  title,
  errorLabel,
  className,
  children,
}: {
  readonly form: AnyFormApi;
  readonly fields: readonly string[];
  readonly title: ReactNode;
  /** 오류 수 → 화면 낭독기 문구. */
  readonly errorLabel: (count: number) => string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const section = useFormSection(form, fields);
  const contentId = useId();
  return (
    <section className={join('wk-section', 'wk-section-collapsible', className)}>
      <h2 className="wk-section-heading">
        <button type="button" className="wk-section-toggle" aria-expanded={section.open} aria-controls={contentId} onClick={section.toggle}>
          {title}
          {section.errorCount > 0 ? ' ' : null}
          {section.errorCount > 0 ? (
            <span className="wk-section-badge">
              <span aria-hidden="true">!</span>
              <span className="wk-visually-hidden">{errorLabel(section.errorCount)}</span>
            </span>
          ) : null}
        </button>
      </h2>
      <div id={contentId} className="wk-section-content" hidden={!section.open}>
        {children}
      </div>
    </section>
  );
}

/**
 * 폼 수준 실패 한 줄. 칸에 붙지 못한 저장 실패와, 저장 뒤 완료 처리 실패(다시 시도 = 완료 처리만 다시)를 보인다.
 * 칸 오류가 모두 칸에 붙은 검증 실패는 칸이 알리므로 여기에 그리지 않는다. 위치는 놓는 곳이 정한다.
 */
function Failure({ className }: { readonly className?: string }) {
  const { editor, copy, renderFailure } = useFormContext();
  const save = editor.formFailure === undefined ? undefined : renderFailure(editor.formFailure, 'save');
  const completion = editor.completionFailure === undefined ? undefined : renderFailure(editor.completionFailure, 'completion');
  const showCompletion = editor.completionFailure !== undefined && completion !== null && !editor.acknowledge;
  return (
    <>
      {editor.formFailure !== undefined && save !== null ? (
        <p role="alert" className={join('wk-form-failure', className)}>
          {save ?? copy.saveFailed}
        </p>
      ) : null}
      {showCompletion ? (
        <p role="alert" className={join('wk-form-failure', className)}>
          {completion ?? copy.completionFailed}
          <button type="button" className="wk-button wk-button-ghost" onClick={() => void editor.complete()}>
            {copy.retry}
          </button>
        </p>
      ) : null}
    </>
  );
}

/**
 * 저장 버튼. 저장 중·확인 대기·완료 처리 중에는 aria-disabled로 잠근다. disabled로 바꾸면 포커스가 본문으로 떨어져
 * 확인창을 닫은 뒤 돌아올 자리가 사라지고, 열린 직후 Tab이 창 밖에서 시작한다.
 * 저장 요청·완료 처리가 진행 중이면 버튼 바로 뒤에 진행 표시(문구는 화면 낭독기용 `messages.saving`)를 둔다(사용자 결정 2026-10-28).
 */
function Submit({ children, className }: { readonly children?: ReactNode; readonly className?: string }) {
  const { editor, copy } = useFormContext();
  const locked = editor.stage.kind !== 'idle';
  return (
    <>
      <button type="submit" className={join('wk-button wk-button-primary', className)} aria-disabled={locked || undefined}>
        {children ?? copy.submit}
      </button>
      {inProgress(editor) ? <Pending label={copy.saving} /> : null}
    </>
  );
}

/**
 * 취소 버튼. 대화창 안이면 그 대화창을, 아니면 `to`로 이동한다. 입력이 있으면 취소 문구로 한 번 묻고, 저장·완료 처리 중이면 잠겨 아무것도 하지 않는다.
 */
function Cancel({
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
  const owner = useContext(GuardContext);
  const scope = useContext(ScopeContext);
  const router = useRouter();
  return (
    <button
      type="button"
      className={join('wk-button wk-button-secondary', className)}
      aria-disabled={inProgress(editor) || undefined}
      onClick={() => {
        if (editor.getState().isSaving || inProgress(editor)) return;
        const run =
          scope !== undefined
            ? scope.close
            : () => {
                if (to !== undefined) void router.navigate({ ...to, ignoreBlocker: true });
              };
        if (owner === undefined) run();
        else owner.request(run, { scope: scope?.id, reason: 'cancel' });
      }}
    >
      {children ?? copy.cancel}
    </button>
  );
}

/** 저장 전 확인창. useSaveForm({ confirm: true })일 때 확인 대기·저장 중에 열리고, 보여 준 값으로 저장한다. */
function Confirm({
  title,
  confirmLabel,
  cancelLabel,
  children,
}: {
  readonly title?: ReactNode;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  /** 확인창 본문. 제출한 값을 받는다. */
  readonly children?: (values: never) => ReactNode;
}) {
  const { editor, copy, submitOrigin } = useFormContext();
  const viaConfirm = useRef(false);
  if (editor.stage.kind === 'confirming') viaConfirm.current = true;
  else if (editor.stage.kind !== 'saving') viaConfirm.current = false;
  const stage = editor.stage;
  const open = stage.kind === 'confirming' || (stage.kind === 'saving' && viaConfirm.current);
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
      {open && 'values' in stage ? children?.(stage.values as never) : null}
    </ConfirmDialog>
  );
}

/**
 * 저장 완료 확인창. useSaveForm({ acknowledge: true })일 때 저장 뒤 열리고, 확인하면 완료 처리(onSaved, 보통 이동)를 한 번 실행한다.
 * 완료 처리가 실패하면 창 안에 알리고 확인이 완료 처리만 다시 한다(저장 요청은 다시 나가지 않는다).
 */
function Saved({ title, confirmLabel, children }: { readonly title?: ReactNode; readonly confirmLabel?: string; readonly children?: ReactNode }) {
  const { editor, copy, renderFailure } = useFormContext();
  const attempts = useRef({ failure: undefined as unknown, count: 0 });
  if (editor.completionFailure !== undefined && editor.completionFailure !== attempts.current.failure)
    attempts.current = { failure: editor.completionFailure, count: attempts.current.count + 1 };
  const failure = editor.completionFailure === undefined ? undefined : renderFailure(editor.completionFailure, 'completion');
  const stage = editor.stage;
  return (
    <AlertDialog
      key={attempts.current.count}
      open={editor.acknowledge && stage.kind === 'saved'}
      pending={stage.kind === 'saved' && stage.completing}
      pendingLabel={copy.saving}
      title={title ?? copy.savedTitle}
      confirmLabel={confirmLabel ?? copy.savedConfirm}
      onConfirm={() => void editor.complete()}
    >
      {children}
      {editor.completionFailure !== undefined && failure !== null ? (
        <p role="alert" className="wk-error">
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
function FormDialog({
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
  const owner = useContext(GuardContext);
  if (owner === undefined) throw new Error('<Form.Dialog> requires <FormGuard>');
  const parent = useContext(ScopeContext);
  const [id] = useState(() => ({}));
  useLayoutEffect(() => owner.registerScope(id, parent?.id), [owner, id, parent?.id]);
  useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  const busy = owner.busy(id);
  return (
    <ScopeContext.Provider value={{ id, close: onClose }}>
      <Dialog
        open
        title={title}
        closable={!busy}
        className={className}
        onClose={() => {
          owner.request(onClose, { scope: id, reason: 'cancel' });
        }}
        footer={null}
      >
        {children}
      </Dialog>
    </ScopeContext.Provider>
  );
}

/** 지금 폼의 편집 상태를 읽는다(프로젝트가 자기 표시를 그릴 때). */
export function useFormEditor<T = unknown>(): SaveFormEditor<T> {
  return useFormContext().editor as SaveFormEditor<T>;
}

function join(...names: readonly (string | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

/**
 * 폼 묶음 부품. `<Form editor={useSaveForm(...)}>` 안에 부품을 원하는 배치로 둔다.
 * 칸 이름을 값 타입으로 좁히려면 `const F = Form.of<Values>()`로 같은 부품을 타입만 바꿔 쓴다.
 */
export const Form = Object.assign(FormRoot, {
  Field,
  Text,
  TextArea,
  Select,
  Checkbox,
  File: FileField,
  Array: ArrayField,
  Section,
  Failure,
  Submit,
  Cancel,
  Confirm,
  Saved,
  Dialog: FormDialog,
  of: <T,>() => Form as unknown as TypedForm<T>,
});

type Keys<T> = Extract<DeepKeys<T>, string>;
/** 값이 V인 칸 이름만. */
type KeysOf<T, V> = { [K in Keys<T>]: DeepValue<T, K> extends V ? K : never }[Keys<T>];
type Named<P, K extends string> = Omit<P, 'name'> & {
  readonly name: K;
};
type PropsOf<C> = C extends (props: infer P) => unknown ? P : never;
/** 칸 이름이 값 타입으로 좁혀진 Form. 문자열 입력에는 문자열 칸만, 체크박스에는 boolean 칸만 들어간다. 동작은 Form과 같다. */
export type TypedForm<T> = typeof FormRoot & {
  readonly Field: <K extends Keys<T>>(
    props: Named<Omit<PropsOf<typeof Field>, 'children'>, K> & {
      readonly children: (control: FormControl<DeepValue<T, K>>, labelId: string) => ReactNode;
    },
  ) => ReactNode;
  readonly Text: (props: Named<PropsOf<typeof Text>, KeysOf<T, string>>) => ReactNode;
  readonly TextArea: (props: Named<PropsOf<typeof TextArea>, KeysOf<T, string>>) => ReactNode;
  readonly Select: (props: Named<PropsOf<typeof Select>, KeysOf<T, string>>) => ReactNode;
  readonly Checkbox: (props: Named<PropsOf<typeof Checkbox>, KeysOf<T, boolean>>) => ReactNode;
  readonly File: (props: Named<PropsOf<typeof FileField>, KeysOf<T, FormFileValue>>) => ReactNode;
  readonly Array: <K extends KeysOf<T, readonly unknown[]>>(props: {
    readonly name: K;
    readonly minItems?: number;
    readonly maxItems?: number;
    readonly children: (rows: FormArrayRows<DeepValue<T, K> extends readonly (infer Item)[] ? Item : never>) => ReactNode;
  }) => ReactNode;
  readonly Section: typeof Section;
  readonly Failure: typeof Failure;
  readonly Submit: typeof Submit;
  readonly Cancel: typeof Cancel;
  readonly Confirm: (props: Omit<PropsOf<typeof Confirm>, 'children'> & { readonly children?: (values: T) => ReactNode }) => ReactNode;
  readonly Saved: typeof Saved;
  readonly Dialog: typeof FormDialog;
};

export { FieldFrame, FieldFeedback, type FieldControlProps } from './field';
export type { LeaveReason } from './navigation';
