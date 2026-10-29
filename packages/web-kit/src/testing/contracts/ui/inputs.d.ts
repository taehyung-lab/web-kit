// 파일 책임: 적합성 검사에 주입하는 UI의 구조 타입 계약이며 런타임 구현은 포함하지 않는다.
import { Button as BaseButton } from '@base-ui/react/button';
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { Input as BaseInput } from '@base-ui/react/input';
import type { ComponentProps } from 'react';
/** 기본 버튼. 폼을 제출하지 않는 것이 기본이고 제출은 type="submit"으로 명시한다. */
export declare function Button({ className, variant, type, ...props }: Omit<ComponentProps<typeof BaseButton>, 'className'> & {
    readonly className?: string;
    readonly variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    readonly type?: 'button' | 'submit';
}): import("react").JSX.Element;
/** 한 줄 입력. */
export declare function Input({ className, ...props }: Omit<ComponentProps<typeof BaseInput>, 'className'> & {
    readonly className?: string;
}): import("react").JSX.Element;
/** 여러 줄 입력. */
export declare function TextArea({ className, ...props }: ComponentProps<'textarea'>): import("react").JSX.Element;
/** 하나 고르기. 브라우저 select라 키보드·라벨 연결을 브라우저가 맡는다. */
export declare function Select({ className, ...props }: ComponentProps<'select'>): import("react").JSX.Element;
/** 체크박스(Base UI). 일부 선택은 indeterminate로 다룬다. */
export declare function Checkbox({ className, ...props }: Omit<ComponentProps<typeof BaseCheckbox.Root>, 'className'> & {
    readonly className?: string;
}): import("react").JSX.Element;
