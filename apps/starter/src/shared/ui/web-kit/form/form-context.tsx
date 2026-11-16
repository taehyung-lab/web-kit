// 파일 책임: 폼 부품이 함께 읽는 문구·앱 기본값(FormDefaults)·폼 context와 확인창 내용 타입. 다른 폼 파일은 여기만 아래 층으로 읽는다(순환 없음).
import { useFormBinding, type SaveFormEditor } from '@boosterlab/web-kit/form';
import { createContext, useContext, type ReactNode } from 'react';

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
export function useFormDefaults(): FormDefaultsValue {
  const value = useContext(FormDefaultsContext);
  if (value === undefined) throw new Error('<Form> requires <FormDefaults messages> above it');
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 부품은 값 타입을 모르고 이름으로만 접근한다.
export type AnyEditor = SaveFormEditor<any, any>;
export type FormContextValue = {
  readonly copy: FormMessages;
  readonly renderFailure: RenderFormFailure;
  readonly formatError: (errors: readonly unknown[]) => string | undefined;
};
export const FormContext = createContext<FormContextValue | undefined>(undefined);

/** 지금 폼 context를 읽는다. Form 밖에서 쓰면 바로 알린다. */
export function useFormContext() {
  const value = useContext(FormContext);
  if (value === undefined) throw new Error('Form parts require <Form editor>');
  return { ...value, ...useFormBinding() };
}

/** 오류 문구 한 줄의 표시 클래스. 여러 폼 파일이 같은 모양을 쓴다. */
export const errorClass = 'text-sm text-destructive';

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
