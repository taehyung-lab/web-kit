// 파일 책임: 적합성 검사에 주입하는 shadcn 기본 부품의 구조 타입 계약이며 런타임 구현은 포함하지 않는다.
// 기본 부품은 키트가 소유하지 않는다. 검사는 키트 부품이 기대는 속성(버튼 기본 type, 입력·체크 접근성 속성)만 본다.
import type { ComponentType, ReactNode } from 'react';
/** 기본 버튼. type을 주지 않으면 폼을 제출하지 않아야 한다. */
export declare const Button: ComponentType<{ readonly children?: ReactNode }>;
/** 한 줄 입력. */
export declare const Input: ComponentType<{ readonly 'aria-label'?: string; readonly required?: boolean; readonly disabled?: boolean }>;
/** 체크박스. 일부 선택은 indeterminate로 다룬다. */
export declare const Checkbox: ComponentType<{ readonly 'aria-label'?: string; readonly indeterminate?: boolean }>;
