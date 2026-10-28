// 파일 책임: 기본 입력 부품(버튼·한 줄 입력·여러 줄 입력·선택·체크박스). 값과 업무 행동은 호출자가 넘기고 모양은 --wk-* 토큰이 정한다.
import { Button as BaseButton } from '@base-ui/react/button';
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { Input as BaseInput } from '@base-ui/react/input';
import type { ComponentProps } from 'react';

/** 기본 버튼. 폼을 제출하지 않는 것이 기본이고 제출은 type="submit"으로 명시한다. */
export function Button({
  className,
  variant = 'secondary',
  type = 'button',
  ...props
}: Omit<ComponentProps<typeof BaseButton>, 'className'> & {
  readonly className?: string;
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  readonly type?: 'button' | 'submit';
}) {
  return <BaseButton {...props} type={type} className={join('wk-button', `wk-button-${variant}`, className)} />;
}

/** 한 줄 입력. */
export function Input({ className, ...props }: Omit<ComponentProps<typeof BaseInput>, 'className'> & { readonly className?: string }) {
  return <BaseInput {...props} className={join('wk-input', className)} />;
}

/** 여러 줄 입력. */
export function TextArea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea {...props} className={join('wk-input', 'wk-textarea', className)} />;
}

/** 하나 고르기. 브라우저 select라 키보드·라벨 연결을 브라우저가 맡는다. */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select {...props} className={join('wk-input', className)} />;
}

/** 체크박스(Base UI). 일부 선택은 indeterminate로 다룬다. */
export function Checkbox({
  className,
  ...props
}: Omit<ComponentProps<typeof BaseCheckbox.Root>, 'className'> & { readonly className?: string }) {
  return (
    <BaseCheckbox.Root {...props} className={join('wk-check', className)}>
      <BaseCheckbox.Indicator className="wk-check-indicator" />
    </BaseCheckbox.Root>
  );
}

function join(...names: readonly (string | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
