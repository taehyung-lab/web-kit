// 파일 책임: 폼 기본 UI의 묶음 부품(Form.*)과 앱에 한 번 두는 이탈 보호(FormGuard).
// 각 부품은 같은 편집 상태(useSaveForm 결과)를 context로 읽어서, 칸·버튼·오류 줄을 어디에 두어도 저장·검증·focus 연결을 다시 쓰지 않는다.
// 저장 수명은 useSaveForm이, 이탈 판정은 createFormNavigation이 소유하고 여기는 표시와 사용자 입력 연결만 맡는다.
// 폼 기본 문구·칸 오류 해소·실패 문구는 앱 맨 위의 FormDefaults 한 곳에서 받고, 화면이 준 값은 그 폼에서만 앞선다.
import { FormGuardProvider, FormDialogScopeProvider, useFormGuardBinding, useFormRootBinding, useFormFieldBinding, useFormChoiceBinding, formTextBinding, useOptionsRetryFocus, useFormCancel, useFormDialogScope, useFormConfirmBinding, useFormSavedBinding, FormBindingProvider, useFormBinding, useFormSubmitBinding, formFileBinding } from '@boosterlab/web-kit/form';
import { Choice as ChoiceInput, type ChoiceProps } from '../ui/choice';
import type { NavigateOptions } from '@tanstack/react-router';
import type { AnyFormApi, DeepKeys, DeepValue } from '@tanstack/react-form';
import {
  createContext,
  useContext,
  useId,
  useState,
  type FormHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Checkbox as CheckboxInput } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select as SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, ConfirmDialog, Dialog } from '../ui/dialog';
import { Pending } from '../ui/pending';
import { FormArrayField, type FormArrayRows } from '@boosterlab/web-kit/form';
import { FieldFrame, type FieldControlProps } from './field';
import type { FormFileValue } from '@boosterlab/web-kit/form';
import { FormRejection, type SaveFormEditor } from '@boosterlab/web-kit/form';
import { useFormSection } from '@boosterlab/web-kit/form';

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

// ─── 폼 ─────────────────────────────────────────────────────────────────────

/** 폼 기본 문구 전체. 키트에 문구가 늘면 이 타입이 늘어 FormDefaults에 넘기는 값의 타입 검사가 실패한다(빠진 문구를 조용히 채우지 않는다). */
export interface FormMessages {
  readonly saveFailed: string;
  readonly completionFailed: string;
  readonly retry: string;
  readonly loading: string;
  readonly optionsFailed: string;
  readonly choose: string;
  readonly submit: string;
  readonly cancel: string;
  readonly confirmTitle: string;
  readonly confirm: string;
  readonly savedTitle: string;
  readonly savedConfirm: string;
  /** 저장 중 진행 표시를 화면 낭독기가 읽는 문구. */
  readonly saving: string;
  readonly removeFile: string;
  readonly count: (current: number, max: number) => string;
  /** 접힌 구역 머리글의 오류 수를 화면 낭독기가 읽는 문구. */
  readonly sectionErrors: (count: number) => string;
  /** 참조 정리 확인창 제목(끊기는 참조 수를 받는다). */
  readonly referenceTitle: (count: number) => string;
  /** 참조 정리 확인창의 진행 버튼. */
  readonly referenceConfirm: string;
}

/** 키트가 제공하는 한국어 폼 문구. 한국어 앱은 이 값을 FormDefaults에 그대로 넘긴다(공급이 없으면 한국어로 떨어지지 않고 오류가 난다). */
export const defaultFormMessages: FormMessages = {
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
  referenceTitle: (count: number) => `${count}곳에서 쓰고 있습니다. 함께 정리할까요?`,
  referenceConfirm: '함께 정리',
};

/** 실패가 보이는 자리. save는 저장 실패 한 줄, completion은 저장 뒤 완료 처리 실패, options는 선택지 조회 실패다. */
export type FormFailurePlace = 'save' | 'completion' | 'options';
/** 실패 문구. undefined면 키트 기본 문구, null이면 그 자리에 아무것도 그리지 않는다(앱 경계가 이미 알린 실패 등). */
export type RenderFormFailure = (failure: unknown, place: FormFailurePlace) => ReactNode | null | undefined;

/** 칸 오류 값(문자열·번역 참조 등)을 표시 문구로 바꾼다. undefined면 그 칸에 문구를 그리지 않는다. */
export type FormatFieldError = (errors: readonly unknown[]) => string | undefined;

/** 앱 기본값. messages는 전체 집합이고, formatError·renderFailure는 없으면 키트 동작(첫 문자열·키트 문구)이다. */
export interface FormDefaultsValue {
  readonly messages: FormMessages;
  readonly formatError?: FormatFieldError;
  readonly renderFailure?: RenderFormFailure;
}
const FormDefaultsContext = createContext<FormDefaultsValue | undefined>(undefined);

/**
 * 앱 맨 위에 한 번 두고 폼 기본 문구 전체·칸 오류 해소·실패 문구를 넘긴다. 이 아래 모든 `<Form>`이 이 값을 쓴다.
 * 화면의 `<Form>`이 준 messages는 그 폼에서만 키별로 앞서고, formatError·renderFailure는 그 폼에서 통째로 바뀐다.
 * 폼의 확인창은 대화창 부품을 쓰므로 DialogDefaults도 함께 둔다.
 */
export function FormDefaults({ children, ...value }: FormDefaultsValue & { readonly children: ReactNode }) {
  return <FormDefaultsContext.Provider value={value}>{children}</FormDefaultsContext.Provider>;
}

/** 앱 기본값을 읽는다. 공급이 없으면 조용히 다른 언어로 그리지 않고 바로 오류로 알린다. */
function useFormDefaults(): FormDefaultsValue {
  const value = useContext(FormDefaultsContext);
  if (value === undefined) throw new Error('<Form> requires <FormDefaults messages> above it');
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 부품은 값 타입을 모르고 이름으로만 접근한다.
type AnyEditor = SaveFormEditor<any, any>;
type FormContextValue = {
  readonly copy: FormMessages;
  readonly renderFailure: RenderFormFailure;
  readonly formatError: (errors: readonly unknown[]) => string | undefined;
};
const FormContext = createContext<FormContextValue | undefined>(undefined);

/** 지금 폼 context를 읽는다. Form 밖에서 쓰면 바로 알린다. */
function useFormContext() {
  const value = useContext(FormContext);
  if (value === undefined) throw new Error('Form parts require <Form editor>');
  return { ...value, ...useFormBinding() };
}

/** 저장 확인창의 내용. 본문(body)은 제출한 값(확인 뒤 그대로 저장할 값)을 받는다. 없는 항목은 폼 문구(confirmTitle·confirm·cancel)다. */
export interface FormConfirmContent<V> {
  readonly title?: ReactNode;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly body?: (values: V) => ReactNode;
}
/** 저장 완료 확인창의 내용. 없는 항목은 폼 문구(savedTitle·savedConfirm)다. */
export interface FormSavedContent {
  readonly title?: ReactNode;
  readonly confirmLabel?: string;
  readonly body?: ReactNode;
}

type StepsOf<E extends AnyEditor> = NonNullable<E['__steps']>;
/**
 * editor의 확인 단계 표식으로 확인창 prop을 정한다. 저장 확인(confirm)이 있을 수 있으면 `confirm`이, 저장 완료 확인(acknowledge)이 있을 수 있으면
 * `saved`가 필수이고, 없다고 선언한 폼에는 넣을 수 없다. 확인창을 잊어 저장이 확인 대기에 멈추거나 쓰지 않는 창을 두는 일을 컴파일 때 막는다.
 */
type FormStepProps<E extends AnyEditor> = (true extends StepsOf<E>['confirm']
  ? { readonly confirm: FormConfirmContent<E['baseline']> }
  : { readonly confirm?: never }) &
  (true extends StepsOf<E>['acknowledge'] ? { readonly saved: FormSavedContent } : { readonly saved?: never });

/** `<Form>`의 props. editor의 확인 단계에 따라 confirm·saved가 필수·금지로 갈린다. */
export type FormProps<E extends AnyEditor> = {
  readonly editor: E;
  readonly protect?: boolean;
  /** 이 폼에서만 앱 기본 문구를 키별로 덮는다. */
  readonly messages?: Partial<FormMessages>;
  /** 이 폼에서만 앱 기본 실패 문구를 바꾼다. */
  readonly renderFailure?: RenderFormFailure;
  /** 이 폼에서만 칸 오류 값을 표시 문구로 바꾸는 방법을 바꾼다(번역 참조 해소 등). 앱 기본도 없으면 첫 문자열. */
  readonly formatError?: FormatFieldError;
  readonly children: ReactNode;
} & FormStepProps<E> &
  Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'noValidate' | 'children'>;

/**
 * 폼 하나. form 요소(브라우저 검증 끔·제출 이벤트를 이 폼에서 멈춤)와 이탈 보호 등록을 맡고, 배치는 children이 정한다.
 * 저장 확인창·저장 완료 확인창·참조 정리 확인창은 Form이 그린다(화면이 따로 배치하지 않는다).
 * protect={false}는 로그인처럼 이탈을 묻지 않는 제품 예외에만 쓴다.
 */
function FormRoot<E extends AnyEditor>(props: FormProps<E>) {
  const { editor, protect = true, messages, renderFailure, formatError, children, confirm, saved, ...formProps } = props as FormProps<AnyEditor> & {
    readonly confirm?: FormConfirmContent<unknown>;
    readonly saved?: FormSavedContent;
  };
  const defaults = useFormDefaults();
  const { submitOrigin, formProps: binding, formatError: resolvedFormatError } = useFormRootBinding(editor, protect, formatError ?? defaults.formatError);
  const value: FormContextValue = {
    copy: { ...defaults.messages, ...messages },
    renderFailure: renderFailure ?? defaults.renderFailure ?? (() => undefined),
    formatError: resolvedFormatError,
  };
  return (
    <FormBindingProvider editor={editor} submitOrigin={submitOrigin}><FormContext.Provider value={value}>
      <form
        {...formProps}
        className={cn('grid gap-4', formProps.className)}
        {...binding}
      >
        {children}
      </form>
      <ConfirmDialog
        open={editor.referenceChange !== undefined}
        title={value.copy.referenceTitle(editor.referenceChange?.count ?? 0)}
        confirmLabel={value.copy.referenceConfirm}
        cancelLabel={value.copy.cancel}
        onConfirm={() => editor.referenceChange?.confirm()}
        onCancel={() => editor.referenceChange?.cancel()}
      />
      {editor.referenceFailure !== undefined && (
        <p role="alert" className={errorClass}>
          {value.formatError([editor.referenceFailure]) ?? editor.referenceFailure}
        </p>
      )}
      <Confirm {...confirm} />
      <Saved {...saved} />
    </FormContext.Provider></FormBindingProvider>
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
  readonly change: (value: V, onApplied?: () => void) => void;
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
  const binding = useFormFieldBinding(editor, name, disabled);
  const isRequired = binding.required;
  if (!binding.visible) return null;
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
          classes={fieldClasses}
        >
          {(control, labelId) =>
            children(
              {
                ...control,
                name,
                value: field.state.value as V,
                change: (value, onApplied) => binding.change(value, field.handleChange, onApplied),
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

/** 폼 검증·필수 표시·오류 초점을 같은 선택 입력에 연결한다. */
function Choice({ name, description, status = 'ready', onRetry, ...props }: FormFieldProps & Omit<ChoiceProps, 'value' | 'onValueChange'> & { readonly status?: OptionsStatus; readonly onRetry?: () => void }) {
  const { editor, copy, renderFailure } = useFormContext();
  useFormChoiceBinding(editor, name, status === 'ready' && props.search === undefined ? props.nodes : undefined);
  const retry = useOptionsRetryFocus(onRetry);
  return (
    <Field<ChoiceProps['value']> name={name} label={props.label} description={description} disabled={props.disabled} labelTarget={status === 'ready' ? 'control' : 'group'}>
      {({ value, change, blur, ...control }, labelId) => {
        if (status === 'ready') return <ChoiceInput {...props} {...control} value={value} onValueChange={change} onBlur={blur} />;
        const failureText = status === 'loading' ? undefined : renderFailure(status.failure, 'options');
        return <div {...control} role="group" tabIndex={-1} aria-labelledby={labelId} className={optionsStateClass}>
          {status === 'loading' ? <span role="status" className="text-muted-foreground">{copy.loading}</span> : failureText === null ? null : <span role="alert" className="flex flex-wrap items-center gap-2 text-destructive">
            {failureText ?? copy.optionsFailed}
            {onRetry !== undefined && <Button type="button" variant="outline" size="sm" onClick={retry.onRetry}>{copy.retry}</Button>}
          </span>}
        </div>;
      }}
    </Field>
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
        const textBinding = formTextBinding(value, maxLength, change);
        const text = textBinding.value;
        return (
          <>
            <Input
              {...control}
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
                textBinding.change(next);
              }}
            />
            {showCount && maxLength !== undefined ? (
              <p className={countClass} aria-live="polite">
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
        const textBinding = formTextBinding(value, maxLength, change);
        const text = textBinding.value;
        return (
          <>
            <Textarea
              {...control}
              placeholder={placeholder}
              rows={rows}
              maxLength={maxLength}
              value={text}
              onBlur={blur}
              onChange={(event) => {
                const next = event.target.value;
                textBinding.change(next);
              }}
            />
            {showCount && maxLength !== undefined ? (
              <p className={countClass} aria-live="polite">
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
  const retry = useOptionsRetryFocus(onRetry);
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
              className={optionsStateClass}
            >
              {status === 'loading' ? (
                <span role="status" className="text-muted-foreground">{copy.loading}</span>
              ) : failureText === null ? null : (
                <span role="alert" className="flex flex-wrap items-center gap-2 text-destructive">
                  {failureText ?? copy.optionsFailed}
                  {onRetry === undefined ? null : (
                    <Button type="button" variant="outline" size="sm" onClick={retry.onRetry}>
                      {copy.retry}
                    </Button>
                  )}
                </span>
              )}
            </div>
          );
        }
        const { name, disabled, ...trigger } = control;
        return (
          <SelectControl
            key="control"
            name={name}
            disabled={disabled}
            trigger={trigger}
            triggerRef={retry.inputRef}
            value={selected}
            options={options}
            placeholder={placeholder ?? copy.choose}
            onBlur={blur}
            onValueChange={(next) => change(next, () => onChange?.(next))}
          />
        );
      }}
    </Field>
  );
}

/**
 * Form.Select의 입력(shadcn Select). 값이 비었을 때만 placeholder를 보이고 선택지에는 빈 값을 두지 않는다(필수 선택을 고른 뒤 다시 비우는 길을 두지 않는다).
 * 칸을 떠난 판정(blur)은 트리거에서 팝업으로 포커스가 옮겨 갈 때는 하지 않고, 팝업이 닫힌 뒤 칸 밖으로 나갈 때만 한다.
 */
function SelectControl({
  name,
  disabled,
  trigger,
  triggerRef,
  value,
  options,
  placeholder,
  onBlur,
  onValueChange,
}: {
  readonly name: string;
  readonly disabled: boolean;
  readonly trigger: Omit<FieldControlProps, never> & { readonly 'aria-required': boolean };
  readonly triggerRef: (node: HTMLElement | null) => void;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly placeholder: string;
  readonly onBlur: () => void;
  readonly onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <SelectRoot
      name={name}
      disabled={disabled}
      items={options}
      value={value === '' ? null : value}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onBlur();
      }}
      onValueChange={(next) => {
        if (typeof next === 'string') onValueChange(next);
      }}
    >
      <SelectTrigger {...trigger} ref={triggerRef} className="w-full" onBlur={() => (open ? undefined : onBlur())}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}

/** boolean 값 하나. 라벨이 체크박스 옆에 붙는다. onChange는 사용자가 바꾼 직후에만 부른다. */
function Checkbox({ onChange, ...field }: FormFieldProps & { readonly onChange?: (checked: boolean) => void }) {
  const { editor, formatError } = useFormContext();
  const binding = useFormFieldBinding(editor, field.name, field.disabled === true);
  const id = editor.fieldId(field.name);
  if (!binding.visible) return null;
  return (
    <editor.form.Field name={field.name}>
      {(state) => {
        const message = field.disabled ? undefined : formatError(state.state.meta.errors);
        return (
          <div data-slot="form-field" className="grid content-start gap-2">
            <Label htmlFor={id} className="font-normal">
              {/* 체크박스 자체(button)가 id를 받아 라벨 연결·오류 포커스가 보이는 요소로 간다. */}
              <CheckboxInput
                nativeButton
                render={<button type="button" />}
                id={id}
                name={field.name}
                disabled={field.disabled}
                aria-invalid={message !== undefined}
                aria-describedby={message === undefined ? undefined : `${id}-error`}
                checked={state.state.value === true}
                onBlur={state.handleBlur}
                onCheckedChange={(checked) => {
                  binding.change(checked, state.handleChange, () => onChange?.(checked));
                }}
              />
              {field.label}
            </Label>
            {message === undefined ? null : (
              <p id={`${id}-error`} role="alert" className={errorClass}>
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
        const file = formFileBinding(value, change);
        const name = file.name;
        const nameId = `${control.id}-file`;
        const describedBy = [control['aria-describedby'], name === undefined ? undefined : nameId].filter(Boolean).join(' ');
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              {...control}
              className="w-auto"
              aria-describedby={describedBy === '' ? undefined : describedBy}
              // 고른 파일이 사라지면(제거·초기화) 네이티브 입력도 비우도록 다시 만든다.
              key={file.inputKey}
              type="file"
              accept={accept}
              onBlur={blur}
              onChange={(event) => {
                file.select(event.target.files?.[0]);
              }}
            />
            {name === undefined ? null : (
              <>
                <span id={nameId} className="text-sm">{name}</span>
                <Button type="button" variant="ghost" size="sm" disabled={field.disabled} onClick={file.remove}>
                  {copy.removeFile}
                </Button>
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
  const binding = useFormFieldBinding(editor, name);
  if (!binding.visible) return null;
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
  errorMarker,
  children,
  className,
}: {
  readonly title?: ReactNode;
  readonly fields?: readonly string[];
  /** 머리글 오류 표시를 바꾼다(FormSection과 같다). 없으면 「!」 + 낭독 `messages.sectionErrors`. */
  readonly errorMarker?: (errorCount: number) => ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const { editor, copy } = useFormContext();
  if (fields !== undefined) {
    return (
      <FormSection
        form={editor.form}
        fields={fields}
        title={title}
        errorLabel={copy.sectionErrors}
        errorMarker={errorMarker}
        className={className}
      >
        {children}
      </FormSection>
    );
  }
  return (
    <fieldset data-slot="form-section" className={cn('grid min-w-0 gap-4 rounded-xl border border-border p-4', className)}>
      {title === undefined ? null : <legend className="px-1 text-sm font-medium">{title}</legend>}
      {children}
    </fieldset>
  );
}

/**
 * 접을 수 있는 구역(열림·오류 표시·제출 뒤 펼침). `Form.Section fields`가 이것을 쓰고, 키트 `Form` 밖의 폼(useSaveForm의 form만 있는 화면)도
 * 같은 부품을 직접 쓴다. 닫혀도 칸은 마운트된 채 숨긴다(값·검증 유지). 열림·오류 수·거절 때 펼침은 키트가, 머리글에 오류를 어떻게 보일지는 프로젝트가 정한다:
 * 기본 머리글 표시는 「!」이고 화면 낭독기는 오류 수(`errorLabel`)를 읽는다. `errorMarker`를 주면 그 표시로 바꾼다(예: 보이는 "오류 2개" 배지).
 */
export function FormSection({
  form,
  fields,
  title,
  errorLabel,
  errorMarker,
  className,
  children,
}: {
  readonly form: AnyFormApi;
  readonly fields: readonly string[];
  readonly title: ReactNode;
  /** 오류 수 → 화면 낭독기 문구(기본 표시가 쓴다). */
  readonly errorLabel: (count: number) => string;
  /** 오류가 있을 때 머리글 제목 뒤에 그릴 표시(오류 수를 받는다). 화면 낭독기가 읽을 문구도 이 표시가 책임진다. 없으면 기본 표시. */
  readonly errorMarker?: (errorCount: number) => ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const section = useFormSection(form, fields);
  const contentId = useId();
  return (
    <section data-slot="form-section" className={cn('min-w-0 rounded-xl border border-border', className)}>
      <h2 className="text-base font-medium">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-expanded={section.open}
          aria-controls={contentId}
          onClick={section.toggle}
        >
          {title}
          {section.errorCount > 0 ? ' ' : null}
          {section.errorCount > 0 && errorMarker !== undefined ? errorMarker(section.errorCount) : null}
          {section.errorCount > 0 && errorMarker === undefined ? (
            <span className="rounded-full bg-destructive px-2 text-xs text-white">
              <span aria-hidden="true">!</span>
              <span className="sr-only">{errorLabel(section.errorCount)}</span>
            </span>
          ) : null}
        </button>
      </h2>
      <div id={contentId} className="grid gap-4 px-4 pb-4" hidden={!section.open}>
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
function Submit({
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
function Confirm({ title, confirmLabel, cancelLabel, body }: FormConfirmContent<unknown>) {
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
function Saved({ title, confirmLabel, body }: FormSavedContent) {
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

/** 지금 폼의 편집 상태를 읽는다(프로젝트가 자기 표시를 그릴 때). */
export { useFormEditor } from '@boosterlab/web-kit/form';

// 표시 클래스. 색·모양은 프로젝트 shadcn 테마 토큰이 정한다. 프로젝트가 배치하는 블록(칸·구역·폼 한 줄)의 바깥 여백(margin)은 두지 않는다:
// 클래스 우선순위 여백은 프로젝트의 간격 유틸리티(space-y 등)를 지운다(결정 0007, 검사 G110).
const fieldClasses = {
  root: 'grid content-start gap-2',
  label: 'flex items-center gap-1 text-sm leading-none font-medium',
  required: 'text-destructive',
  description: 'text-sm text-muted-foreground',
  error: 'text-sm text-destructive',
};
const errorClass = 'text-sm text-destructive';
const countClass = 'text-right text-xs text-muted-foreground';
const optionsStateClass = 'flex min-h-8 flex-wrap items-center gap-2 text-sm';
const failureClass = 'rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive';
/** aria-disabled로 잠근 버튼(포커스는 유지)의 표시. */
const lockedClass = 'aria-disabled:cursor-default aria-disabled:opacity-50';

/**
 * 폼 묶음 부품. `<Form editor={useSaveForm(...)}>` 안에 부품을 원하는 배치로 둔다. 확인창 내용은 `confirm`·`saved` prop으로 준다(confirm 본문의 값 타입은 editor에서 온다).
 * 칸 이름을 값 타입으로 좁히려면 `const F = Form.of<Values>()`로 같은 부품을 타입만 바꿔 쓴다.
 */
export const Form = Object.assign(FormRoot, {
  Field,
  Text,
  TextArea,
  Select,
  Choice,
  Checkbox,
  File: FileField,
  Array: ArrayField,
  Section,
  Failure,
  Submit,
  Cancel,
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
  readonly Choice: (
    props: Omit<PropsOf<typeof Choice>, 'name' | 'multiple'> &
      (
        | { readonly name: KeysOf<T, string | undefined>; readonly multiple?: false }
        | { readonly name: KeysOf<T, readonly string[]>; readonly multiple: true }
      ),
  ) => ReactNode;
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
  readonly Dialog: typeof FormDialog;
};

export { FieldFrame, FieldFeedback, type FieldControlProps } from './field';
export type { LeaveReason } from '@boosterlab/web-kit/form';
