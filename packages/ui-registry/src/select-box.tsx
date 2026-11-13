import type { ComponentProps } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

type TriggerProps = Pick<ComponentProps<typeof SelectTrigger>, 'id' | 'ref' | 'className' | 'size' | 'onBlur' | 'aria-label' | 'aria-labelledby' | 'aria-describedby' | 'aria-invalid' | 'aria-required'>;
export type SelectBoxProps = TriggerProps & {
  readonly options: readonly SelectOption[];
  /** null은 미선택이다. 빈 문자열 옵션은 그대로 선택할 수 있다. */
  readonly value: string | null;
  readonly onValueChange: (value: string | null) => void;
  readonly placeholder?: string;
  readonly name?: string;
  readonly disabled?: boolean;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
};

/** 단일 문자열 선택의 기본 조립. 검증·전체 선택·서버 선택지 수명은 상위 Form/List가 맡는다. */
export function SelectBox({ options, value, onValueChange, placeholder, name, disabled, open, onOpenChange, ...trigger }: SelectBoxProps) {
  return (
    <Select items={options} value={value} onValueChange={(next) => onValueChange(next)} name={name} disabled={disabled} open={open} onOpenChange={onOpenChange}>
      <SelectTrigger {...trigger}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map(option => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
