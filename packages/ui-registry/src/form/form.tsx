// 파일 책임: 폼 기본 UI의 입구. Form 조립(Form.*·TypedForm)과 <form> 요소·참조 정리 확인창을 맡고, 나머지는 역할별 파일에서 가져와 같은 이름으로 다시 내보낸다.
// 각 부품은 같은 편집 상태(useSaveForm 결과)를 context로 읽어서, 칸·버튼·오류 줄을 어디에 두어도 저장·검증·focus 연결을 다시 쓰지 않는다.
// 문구·앱 기본값·context는 form-context, 칸 입력은 form-fields, 구역은 form-sections, 이탈 보호·버튼·실패·확인창은 form-actions가 맡는다.
import { FormBindingProvider, useFormRootBinding } from '@boosterlab/web-kit/form';
import type { FormArrayRows, FormFileValue } from '@boosterlab/web-kit/form';
import type { DeepKeys, DeepValue } from '@tanstack/react-form';
import type { FormHTMLAttributes, ReactNode } from 'react';
import { cn } from 'cn';
import { ConfirmDialog } from '../ui/dialog';
import {
  FormContext, errorClass, useFormDefaults,
  type AnyEditor, type FormConfirmContent, type FormContextValue, type FormSavedContent, type FormMessages, type FormatFieldError, type RenderFormFailure,
} from './form-context';
import { Field, Text, TextArea, Select, Choice, Checkbox, FileField, ArrayField, type FormControl } from './form-fields';
import { Section } from './form-sections';
import { Failure, Submit, Cancel, Confirm, Saved, FormDialog } from './form-actions';

// 공개 이름은 예전 그대로 이 입구에서 내보낸다.
export { defaultFormGuardMessages, FormGuard, useLeave, type FormGuardReasonMessages, type FormGuardMessages } from './form-actions';
export { defaultFormMessages, FormDefaults, type FormMessages, type FormFailurePlace, type RenderFormFailure, type FormatFieldError, type FormDefaultsValue, type FormConfirmContent, type FormSavedContent } from './form-context';
export type { FormFieldProps, FormControl, OptionsStatus } from './form-fields';
export { FormSection } from './form-sections';
export { useFormEditor } from '@boosterlab/web-kit/form';

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
