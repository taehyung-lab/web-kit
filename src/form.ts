// 파일 책임: 전체 폼 검증·제출과 서버 필드 오류의 수명을 관리한다.
import type { AnyFormApi } from '@tanstack/react-form';
type FormFieldState = Pick<AnyFormApi, 'getFieldMeta' | 'setFieldMeta'>;

/** blur 실패가 있어도 제출 시 모든 필드의 submit 검증을 실행한다. */
export async function submitForm(form: {
  readonly validate: (cause: 'blur' | 'submit') => unknown;
  readonly handleSubmit: () => Promise<void>;
}): Promise<void> {
  void form.validate('blur');
  await form.validate('submit');
  await form.handleSubmit();
}

/** 이전 서버 거절만 지우고 입력·blur/submit 오류를 유지한다. 경로 선정은 프로젝트가 맡는다. */
export function clearFormServerErrors(form: FormFieldState, fields: readonly string[]): void {
  for (const field of fields) {
    if (form.getFieldMeta(field)?.errorMap.onServer === undefined) continue;
    form.setFieldMeta(field, (meta) => ({
      ...meta,
      errorMap: { ...meta.errorMap, onServer: undefined },
    }));
  }
}

/** 화면 순서의 거절 경로에 문구 참조를 붙이고 같은 순서를 focus 소유자에게 돌려준다. */
export function setFormServerErrors<TField extends string>(
  form: FormFieldState,
  orderedFields: readonly TField[],
  messageFor: (field: TField) => string,
): readonly TField[] {
  for (const field of orderedFields) {
    form.setFieldMeta(field, (meta) => ({
      ...meta,
      errorMap: { ...meta.errorMap, onServer: messageFor(field) },
    }));
  }
  return orderedFields;
}

export { createFormMessages } from './form-messages';

export { useSubmissionLifecycle } from './useSubmissionLifecycle';
