// 파일 책임: 적합성 검사에 주입하는 UI의 구조 타입 계약이며 런타임 구현은 포함하지 않는다.
import { type ChoiceProps } from '../ui/choice';
import { type NavigateOptions } from '@tanstack/react-router';
import { type AnyFormApi, type DeepKeys, type DeepValue } from '@tanstack/react-form';
import { type FormHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { type FormArrayRows } from '@boosterlab/web-kit/form';
import { type FieldControlProps } from './field';
import type { FormFileValue } from '@boosterlab/web-kit/form';
import { type SaveFormEditor } from '@boosterlab/web-kit/form';
declare const defaultGuardMessages: {
    navigate: {
        title: string;
        description: string;
        confirm: string;
        keep: string;
    };
    cancel: {
        title: string;
        description: string;
        confirm: string;
        keep: string;
    };
    navigationFailed: string;
};
export type FormGuardMessages = {
    readonly navigate: typeof defaultGuardMessages.navigate;
    readonly cancel: typeof defaultGuardMessages.cancel;
    readonly navigationFailed: string;
};
/**
 * 앱(Router 안)에 한 번 둔다. 등록된 폼 중 하나라도 입력이 기준선과 다르면 Router 이동·브라우저 이탈을 한 번 묻고,
 * 저장 중이면 묻지 않고 거부한다. 확인창은 하나뿐이며 문구는 까닭(이동/취소 버튼)별 값이다.
 */
export declare function FormGuard({ children, messages, }: {
    readonly children: ReactNode;
    readonly messages?: {
        readonly navigate?: Partial<FormGuardMessages['navigate']>;
        readonly cancel?: Partial<FormGuardMessages['cancel']>;
        readonly navigationFailed?: string;
    };
}): import("react").JSX.Element;
/**
 * Router blocker를 거치지 않는 이탈(취소 버튼, 같은 메뉴 다시 누르기)을 같은 판정으로 묻는다.
 * 저장 중이면 아무것도 하지 않고, 입력이 없으면 바로, 있으면 확인 뒤에 run을 실행한다.
 * run이 Router로 이동하면 이미 물었으므로 `ignoreBlocker: true`로 이동한다.
 */
export { useLeave } from '@boosterlab/web-kit/form';
declare const defaultFormMessages: {
    saveFailed: string;
    completionFailed: string;
    retry: string;
    loading: string;
    optionsFailed: string;
    choose: string;
    submit: string;
    cancel: string;
    confirmTitle: string;
    confirm: string;
    savedTitle: string;
    savedConfirm: string;
    saving: string;
    removeFile: string;
    count: (current: number, max: number) => string;
    sectionErrors: (count: number) => string;
};
export type FormMessages = typeof defaultFormMessages & {
    readonly referenceTitle?: (count: number) => string;
    readonly referenceConfirm?: string;
};
/** 실패가 보이는 자리. save는 저장 실패 한 줄, completion은 저장 뒤 완료 처리 실패, options는 선택지 조회 실패다. */
export type FormFailurePlace = 'save' | 'completion' | 'options';
/** 실패 문구. undefined면 키트 기본 문구, null이면 그 자리에 아무것도 그리지 않는다(앱 경계가 이미 알린 실패 등). */
export type RenderFormFailure = (failure: unknown, place: FormFailurePlace) => ReactNode | null | undefined;
type AnyEditor = SaveFormEditor<any, any>;
/**
 * 폼 하나. form 요소(브라우저 검증 끔·제출 이벤트를 이 폼에서 멈춤)와 이탈 보호 등록을 맡고, 배치는 children이 정한다.
 * protect={false}는 로그인처럼 이탈을 묻지 않는 제품 예외에만 쓴다.
 */
declare function FormRoot({ editor, protect, messages, renderFailure, formatError, children, ...formProps }: {
    readonly editor: AnyEditor;
    readonly protect?: boolean;
    readonly messages?: Partial<FormMessages>;
    readonly renderFailure?: RenderFormFailure;
    /** 칸 오류 값을 표시 문구로 바꾼다(번역 참조 해소 등). 없으면 첫 문자열. */
    readonly formatError?: (errors: readonly unknown[]) => string | undefined;
    readonly children: ReactNode;
} & Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'noValidate' | 'children'>): import("react").JSX.Element;
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
declare function Field<V = unknown>({ name, label, description, disabled, labelTarget, children, }: FormFieldProps & {
    /** 입력이 라벨 요소로 이름 지을 수 없는 묶음이면 'group'. */
    readonly labelTarget?: 'control' | 'group';
    readonly children: (control: FormControl<V>, labelId: string) => ReactNode;
}): import("react").JSX.Element;
/** 폼 검증·필수 표시·오류 초점을 같은 선택 입력에 연결한다. */
declare function Choice({ name, description, status, onRetry, ...props }: FormFieldProps & Omit<ChoiceProps, 'value' | 'onValueChange'> & { readonly status?: OptionsStatus; readonly onRetry?: () => void }): import("react").JSX.Element;
/**
 * 한 줄 문자열 입력. maxLength는 길어지는 편집만 거부한다(한글 조합 커밋이 maxLength를 넘겨도 꼬리를 자르지 않고 받지 않는다).
 * 서버가 준 초과 초기값은 줄이는 편집을 막지 않는다. showCount면 글자 수를 보인다.
 */
declare function Text({ type, placeholder, autoComplete, autoFocus, inputMode, maxLength, showCount, onKeyDown, ...field }: FormFieldProps & {
    readonly type?: 'text' | 'email' | 'password' | 'tel' | 'date' | 'time' | 'number' | 'url' | 'search';
    readonly placeholder?: string;
    readonly autoComplete?: string;
    readonly autoFocus?: boolean;
    readonly inputMode?: 'numeric' | 'decimal' | 'text' | 'tel' | 'email';
    readonly maxLength?: number;
    readonly showCount?: boolean;
    readonly onKeyDown?: (event: KeyboardEvent) => void;
}): import("react").JSX.Element;
/** 여러 줄 문자열 입력. maxLength 규칙은 Text와 같다. */
declare function TextArea({ placeholder, rows, maxLength, showCount, ...field }: FormFieldProps & {
    readonly placeholder?: string;
    readonly rows?: number;
    readonly maxLength?: number;
    readonly showCount?: boolean;
}): import("react").JSX.Element;
/** 선택지 상태. 서버에서 받는 선택지는 준비되기 전 입력 대신 상태 묶음이 선다. */
export type OptionsStatus = 'ready' | 'loading' | {
    readonly failure: unknown;
};
/**
 * 문자열 값 하나 고르기. 빈 선택지(placeholder)는 값이 비었을 때만 둔다(필수 선택을 고른 뒤 다시 비우는 길을 두지 않는다).
 * onChange는 사용자가 고른 직후에만 부른다(함께 비울 값 등). 원본 교체로 바뀐 값에는 부르지 않는다.
 */
declare function Select({ options, placeholder, status, onRetry, onChange, ...field }: FormFieldProps & {
    readonly options: readonly {
        readonly value: string;
        readonly label: string;
    }[];
    readonly placeholder?: string;
    readonly status?: OptionsStatus;
    readonly onRetry?: () => void;
    readonly onChange?: (value: string) => void;
}): import("react").JSX.Element;
/** boolean 값 하나. 라벨이 체크박스 옆에 붙는다. onChange는 사용자가 바꾼 직후에만 부른다. */
declare function Checkbox({ onChange, ...field }: FormFieldProps & {
    readonly onChange?: (checked: boolean) => void;
}): import("react").JSX.Element;
/**
 * 파일 하나 고르기. 값은 FormFileValue이고 지금 파일 이름을 상태에서 그린다(네이티브 입력은 다시 그려지면 비므로 근거로 쓰지 않는다).
 * 선택 창을 열었다 취소해도 값은 그대로다. 지우는 길은 제거 버튼 하나다(실수로 연 창 때문에 이미 있는 파일을 잃지 않는다).
 * 다른 칸 오류·재마운트·대화창·저장 실패 뒤에도 고른 File은 폼 값에 그대로 남는다. 업로드는 프로젝트 save가 한다.
 */
declare function FileField({ accept, ...field }: FormFieldProps & {
    readonly accept?: string;
}): import("react").JSX.Element;
/** 줄을 늘리고 줄이는 배열 입력(FormArrayField)을 이 폼에 연결한다. 줄의 모양과 문구는 children이 그린다. */
declare function ArrayField({ name, minItems, maxItems, children, }: {
    readonly name: string;
    readonly minItems?: number;
    readonly maxItems?: number;
    readonly children: (rows: FormArrayRows<never>) => ReactNode;
}): import("react").JSX.Element;
/**
 * 칸 묶음 하나(제목 있는 구역). `fields`(이 구역 칸의 정확한 경로나 접두)를 주면 접을 수 있는 구역이 된다:
 * 머리글 버튼이 열고 닫고, 구역 칸에 오류가 있으면 머리글에 표시하며, 제출 뒤 오류가 있으면 펼친 다음 첫 오류 칸에 포커스한다.
 * 접을 수 있으려면 자기 칸을 알아야 한다(오류를 숨긴 채 닫혀 있지 않게).
 */
declare function Section({ title, fields, errorMarker, children, className, }: {
    readonly title?: ReactNode;
    readonly fields?: readonly string[];
    /** 머리글 오류 표시를 바꾼다(FormSection과 같다). 없으면 「!」 + 낭독 `messages.sectionErrors`. */
    readonly errorMarker?: (errorCount: number) => ReactNode;
    readonly children: ReactNode;
    readonly className?: string;
}): import("react").JSX.Element;
/**
 * 접을 수 있는 구역(열림·오류 표시·제출 뒤 펼침). `Form.Section fields`가 이것을 쓰고, 키트 `Form` 밖의 폼(useSaveForm의 form만 있는 화면)도
 * 같은 부품을 직접 쓴다. 닫혀도 칸은 마운트된 채 숨긴다(값·검증 유지). 열림·오류 수·거절 때 펼침은 키트가, 머리글에 오류를 어떻게 보일지는 프로젝트가 정한다:
 * 기본은 1.5처럼 머리글의 「!」이고 화면 낭독기는 오류 수(`errorLabel`)를 읽는다. `errorMarker`를 주면 그 표시로 바꾼다(예: 보이는 "오류 2개" 배지).
 */
export declare function FormSection({ form, fields, title, errorLabel, errorMarker, className, children, }: {
    readonly form: AnyFormApi;
    readonly fields: readonly string[];
    readonly title: ReactNode;
    /** 오류 수 → 화면 낭독기 문구(기본 표시가 쓴다). */
    readonly errorLabel: (count: number) => string;
    /** 오류가 있을 때 머리글 제목 뒤에 그릴 표시(오류 수를 받는다). 화면 낭독기가 읽을 문구도 이 표시가 책임진다. 없으면 기본 표시. */
    readonly errorMarker?: (errorCount: number) => ReactNode;
    readonly className?: string;
    readonly children: ReactNode;
}): import("react").JSX.Element;
/**
 * 폼 수준 실패 한 줄. 칸에 붙지 못한 저장 실패와, 저장 뒤 완료 처리 실패(다시 시도 = 완료 처리만 다시)를 보인다.
 * 칸 오류가 모두 칸에 붙은 검증 실패는 칸이 알리므로 여기에 그리지 않는다. 위치는 놓는 곳이 정한다.
 */
declare function Failure({ className }: {
    readonly className?: string;
}): import("react").JSX.Element;
/**
 * 저장 버튼. 저장 중·확인 대기·완료 처리 중에는 aria-disabled로 잠근다. disabled로 바꾸면 포커스가 본문으로 떨어져
 * 확인창을 닫은 뒤 돌아올 자리가 사라지고, 열린 직후 Tab이 창 밖에서 시작한다.
 * 저장 요청·완료 처리가 진행 중이면 버튼 바로 뒤에 진행 표시(문구는 화면 낭독기용 `messages.saving`)를 둔다.
 * 등록·수정 폼(`useSaveForm({ progress })`)은 화면 전체 진행 덮개가 대신하므로 그리지 않는다(사용자 결정 2026-10-28, 0008).
 */
declare function Submit({ children, className, mode, }: {
    readonly children?: ReactNode;
    readonly className?: string;
    readonly mode?: 'primary' | 'secondary';
}): import("react").JSX.Element;
/**
 * 취소 버튼. 대화창 안이면 그 대화창을, 아니면 `to`로 이동한다. 입력이 있으면 취소 문구로 한 번 묻고, 저장·완료 처리 중이면 잠겨 아무것도 하지 않는다.
 */
declare function Cancel({ to, children, className, }: {
    /** 이동할 곳. 앱이 등록한 Router 타입(Register)으로 검사된다. */
    readonly to?: NavigateOptions;
    readonly children?: ReactNode;
    readonly className?: string;
}): import("react").JSX.Element;
/**
 * 저장 전 확인창. useSaveForm({ confirm: true })일 때 확인 대기·저장 중에 열리고, 보여 준 값으로 저장한다.
 * 등록·수정 폼(progress)은 확인하면 닫히고 화면 전체 진행 덮개가 저장 중을 맡는다(확인창 → 덮개 → 완료 창 순서).
 */
declare function Confirm({ title, confirmLabel, cancelLabel, children, }: {
    readonly title?: ReactNode;
    readonly confirmLabel?: string;
    readonly cancelLabel?: string;
    /** 확인창 본문. 제출한 값을 받는다. */
    readonly children?: (values: never) => ReactNode;
}): import("react").JSX.Element;
/**
 * 저장 완료 확인창. useSaveForm({ acknowledge: true })일 때 저장 뒤 열리고, 확인하면 완료 처리(onSaved, 보통 이동)를 한 번 실행한다.
 * 완료 처리가 실패하면 창 안에 알리고 확인이 완료 처리만 다시 한다(저장 요청은 다시 나가지 않는다).
 */
declare function Saved({ title, confirmLabel, children, }: {
    readonly title?: ReactNode;
    readonly confirmLabel?: string;
    readonly children?: ReactNode;
}): import("react").JSX.Element;
/**
 * 대화창 안 폼. 닫기(Esc·바깥·닫기·취소)는 이 대화창 안 폼만 보고 묻는다. 저장 중에는 닫히지 않는다.
 * 대화창이 열릴 때마다 폼을 새로 시작하는 일(열 때 마운트)은 호출자가 한다.
 */
declare function FormDialog({ title, onClose, children, className, }: {
    readonly title: ReactNode;
    readonly onClose: () => void;
    readonly children: ReactNode;
    readonly className?: string;
}): import("react").JSX.Element;
/** 지금 폼의 편집 상태를 읽는다(프로젝트가 자기 표시를 그릴 때). */
export { useFormEditor } from '@boosterlab/web-kit/form';
/**
 * 폼 묶음 부품. `<Form editor={useSaveForm(...)}>` 안에 부품을 원하는 배치로 둔다.
 * 칸 이름을 값 타입으로 좁히려면 `const F = Form.of<Values>()`로 같은 부품을 타입만 바꿔 쓴다.
 */
export declare const Form: typeof FormRoot & {
    Field: typeof Field;
    Text: typeof Text;
    TextArea: typeof TextArea;
    Select: typeof Select;
    Choice: typeof Choice;
    Checkbox: typeof Checkbox;
    File: typeof FileField;
    Array: typeof ArrayField;
    Section: typeof Section;
    Failure: typeof Failure;
    Submit: typeof Submit;
    Cancel: typeof Cancel;
    Confirm: typeof Confirm;
    Saved: typeof Saved;
    Dialog: typeof FormDialog;
    of: <T>() => TypedForm<T>;
};
type Keys<T> = Extract<DeepKeys<T>, string>;
/** 값이 V인 칸 이름만. */
type KeysOf<T, V> = {
    [K in Keys<T>]: DeepValue<T, K> extends V ? K : never;
}[Keys<T>];
type Named<P, K extends string> = Omit<P, 'name'> & {
    readonly name: K;
};
type PropsOf<C> = C extends (props: infer P) => unknown ? P : never;
/** 칸 이름이 값 타입으로 좁혀진 Form. 문자열 입력에는 문자열 칸만, 체크박스에는 boolean 칸만 들어간다. 동작은 Form과 같다. */
export type TypedForm<T> = typeof FormRoot & {
    readonly Field: <K extends Keys<T>>(props: Named<Omit<PropsOf<typeof Field>, 'children'>, K> & {
        readonly children: (control: FormControl<DeepValue<T, K>>, labelId: string) => ReactNode;
    }) => ReactNode;
    readonly Text: (props: Named<PropsOf<typeof Text>, KeysOf<T, string>>) => ReactNode;
    readonly TextArea: (props: Named<PropsOf<typeof TextArea>, KeysOf<T, string>>) => ReactNode;
    readonly Choice: (props: Omit<PropsOf<typeof Choice>, 'name' | 'multiple'> & ({
        readonly name: KeysOf<T, string | undefined>;
        readonly multiple?: false;
    } | {
        readonly name: KeysOf<T, readonly string[]>;
        readonly multiple: true;
    })) => ReactNode;
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
    readonly Confirm: (props: Omit<PropsOf<typeof Confirm>, 'children'> & {
        readonly children?: (values: T) => ReactNode;
    }) => ReactNode;
    readonly Saved: typeof Saved;
    readonly Dialog: typeof FormDialog;
};
export { FieldFrame, FieldFeedback, type FieldControlProps } from './field';
export type { LeaveReason } from '@boosterlab/web-kit/form';
