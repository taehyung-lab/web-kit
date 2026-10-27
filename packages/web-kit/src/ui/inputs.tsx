/** 기본 버튼·입력 표현을 제공한다. 업무 행동과 값은 호출자가 전달한다. */
import { Input } from '@base-ui/react/input';
import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentProps, ReactNode } from 'react';
import { FieldFrame, type FieldControlProps } from '../form/field';
/** 기본 버튼은 폼을 제출하지 않으며 제출은 명시한다. */
export function Button({
  className = '',
  variant = 'secondary',
  type = 'button',
  ...props
}: Omit<ComponentProps<typeof BaseButton>, 'className'> & {
  readonly className?: string;
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  readonly type?: 'button' | 'submit';
}) {
  return <BaseButton {...props} type={type} className={`wk-button wk-button-${variant} ${className}`} />;
}
/** headless 사용처도 기본 라벨·오류 표현을 다시 작성하지 않는다. */
export function Field({
  id,
  label,
  required = false,
  description,
  message,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly required?: boolean;
  readonly description?: string;
  readonly message?: string;
  readonly children: (control: FieldControlProps & { 'aria-required': boolean }) => ReactNode;
}) {
  return (
    <FieldFrame
      id={id}
      label={label}
      required={required}
      description={description}
      message={message}
      classes={{ root: 'wk-field', label: 'wk-label', required: 'wk-required', description: 'wk-description', error: 'wk-error' }}
    >
      {(control) => children({ ...control, 'aria-required': required })}
    </FieldFrame>
  );
}
/** 문자열 입력의 기본 표현이다. */
export function TextInput({ className = '', ...props }: Omit<ComponentProps<typeof Input>, 'className'> & { readonly className?: string }) {
  return <Input {...props} className={`wk-input ${className}`} />;
}
/** 여러 줄 입력의 기본 표현이다. */
export function TextArea({ className = '', ...props }: ComponentProps<'textarea'>) {
  return <textarea {...props} className={`wk-input ${className}`} />;
}
/** 단일 선택의 브라우저 키보드 동작을 유지한다. */
export function SelectInput({ className = '', ...props }: ComponentProps<'select'>) {
  return <select {...props} className={`wk-input ${className}`} />;
}
