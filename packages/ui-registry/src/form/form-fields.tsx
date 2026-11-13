// 파일 책임: 칸 하나의 입력 부품(Field·Text·TextArea·Select·Choice·Checkbox·File·Array)과 선택지 지연·실패 자리. 모두 form-context의 같은 편집 상태를 읽는다.
import { useFormFieldBinding, useFormChoiceBinding, formTextBinding, useOptionsRetryFocus, formFileBinding, FormArrayField, type FormArrayRows, type FormFileValue } from '@boosterlab/web-kit/form';
import { Choice as ChoiceInput, type ChoiceProps } from '../ui/choice';
import { useEffect, useState, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Checkbox as CheckboxInput } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectBox } from '../select-box';
import { Textarea } from '@/components/ui/textarea';
import { FieldFrame, type FieldControlProps } from './field';
import { errorClass, useFormContext } from './form-context';

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
export function Field<V = unknown>({
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

/** 선택 칸의 선택지 지연·실패 자리. Choice와 Select가 같은 모양·문구·재시도 버튼을 쓰고, onRetry가 없으면 다시 시도 버튼을 그리지 않는다. */
function OptionsState({ status, labelId, control, onRetry }: {
  readonly status: Exclude<OptionsStatus, 'ready'>;
  readonly labelId: string | undefined;
  readonly control: HTMLAttributes<HTMLDivElement>;
  readonly onRetry: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined;
}) {
  const { copy, renderFailure } = useFormContext();
  const failureText = status === 'loading' ? undefined : renderFailure(status.failure, 'options');
  return (
    <div {...control} role="group" tabIndex={-1} aria-labelledby={labelId} className={optionsStateClass}>
      {status === 'loading' ? (
        <span role="status" className="text-muted-foreground">{copy.loading}</span>
      ) : failureText === null ? null : (
        <span role="alert" className="flex flex-wrap items-center gap-2 text-destructive">
          {failureText ?? copy.optionsFailed}
          {onRetry === undefined ? null : <Button type="button" variant="outline" size="sm" onClick={onRetry}>{copy.retry}</Button>}
        </span>
      )}
    </div>
  );
}

/** 선택지 재시도에 성공해 입력이 새로 그려지면, 재시도 버튼이 사라지며 잃은 포커스를 그 입력으로 돌려준다(Select의 triggerRef와 같은 보장). */
function FocusAfterRetry({ id, focus }: { readonly id: string | undefined; readonly focus: (node: HTMLElement | null) => void }) {
  useEffect(() => {
    focus(id === undefined ? null : document.getElementById(id));
  });
  return null;
}

/** 폼 검증·필수 표시·오류 초점을 같은 선택 입력에 연결한다. */
export function Choice({ name, description, status = 'ready', onRetry, ...props }: FormFieldProps & Omit<ChoiceProps, 'value' | 'onValueChange'> & { readonly status?: OptionsStatus; readonly onRetry?: () => void }) {
  const { editor } = useFormContext();
  useFormChoiceBinding(editor, name, status === 'ready' && props.search === undefined ? props.nodes : undefined);
  const retry = useOptionsRetryFocus(onRetry);
  return (
    <Field<ChoiceProps['value']> name={name} label={props.label} description={description} disabled={props.disabled} labelTarget={status === 'ready' ? 'control' : 'group'}>
      {({ value, change, blur, ...control }, labelId) => {
        if (status === 'ready') return <><ChoiceInput {...props} {...control} value={value} onValueChange={change} onBlur={blur} /><FocusAfterRetry id={control.id} focus={retry.inputRef} /></>;
        return <OptionsState status={status} labelId={labelId} control={control} onRetry={onRetry === undefined ? undefined : retry.onRetry} />;
      }}
    </Field>
  );
}

/**
 * 한 줄 문자열 입력. maxLength는 길어지는 편집만 거부한다(한글 조합 커밋이 maxLength를 넘겨도 꼬리를 자르지 않고 받지 않는다).
 * 서버가 준 초과 초기값은 줄이는 편집을 막지 않는다. showCount면 글자 수를 보인다.
 */
export function Text({
  type = 'text',
  placeholder,
  autoComplete,
  autoFocus,
  inputMode,
  maxLength,
  showCount = false,
  onKeyDown,
  controlClassName,
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
  /** 입력 칸 자체의 크기·모양(기본 클래스 뒤에 합친다). 라벨·오류·접근성 연결은 바꾸지 않는다. */
  readonly controlClassName?: string;
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
              className={controlClassName}
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
export function TextArea({
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
export function Select({
  options,
  placeholder,
  status = 'ready',
  onRetry,
  onChange,
  controlClassName,
  ...field
}: FormFieldProps & {
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly placeholder?: string;
  readonly status?: OptionsStatus;
  readonly onRetry?: () => void;
  readonly onChange?: (value: string) => void;
  /** 입력 칸 자체의 크기·모양(기본 클래스 뒤에 합친다). 라벨·오류·접근성 연결은 바꾸지 않는다. */
  readonly controlClassName?: string;
}) {
  const { copy } = useFormContext();
  const retry = useOptionsRetryFocus(onRetry);
  return (
    <Field<unknown> {...field} labelTarget={status === 'ready' ? 'control' : 'group'}>
      {({ value, change, blur, ...control }, labelId) => {
        const selected = value === null || value === undefined ? '' : String(value);
        if (status !== 'ready') {
          return <OptionsState key="state" status={status} labelId={labelId} control={{ id: control.id, 'aria-describedby': control['aria-describedby'], 'aria-invalid': control['aria-invalid'] }} onRetry={onRetry === undefined ? undefined : retry.onRetry} />;
        }
        const { name, disabled, ...trigger } = control;
        return (
          <SelectControl
            key="control"
            name={name}
            disabled={disabled}
            trigger={trigger}
            triggerRef={retry.inputRef}
            className={controlClassName}
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
  className,
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
  readonly className?: string;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly placeholder: string;
  readonly onBlur: () => void;
  readonly onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <SelectBox
      {...trigger}
      ref={triggerRef}
      className={cn('w-full', className)}
      name={name}
      disabled={disabled}
      options={options}
      placeholder={placeholder}
      value={value === '' ? null : value}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onBlur();
      }}
      onBlur={() => (open ? undefined : onBlur())}
      onValueChange={(next) => {
        if (typeof next === 'string') onValueChange(next);
      }}
    />
  );
}

/** boolean 값 하나. 라벨이 체크박스 옆에 붙는다. onChange는 사용자가 바꾼 직후에만 부른다. */
export function Checkbox({ onChange, ...field }: FormFieldProps & { readonly onChange?: (checked: boolean) => void }) {
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
export function FileField({ accept, ...field }: FormFieldProps & { readonly accept?: string }) {
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
export function ArrayField({
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
// 칸 표시 클래스. 색·모양은 프로젝트 shadcn 테마 토큰이 정하고, 바깥 여백(margin)은 두지 않는다(결정 0007, 검사 G110).
const fieldClasses = {
  root: 'grid content-start gap-2',
  label: 'flex items-center gap-1 text-sm leading-none font-medium',
  required: 'text-destructive',
  description: 'text-sm text-muted-foreground',
  error: 'text-sm text-destructive',
};
const countClass = 'text-right text-xs text-muted-foreground';
const optionsStateClass = 'flex min-h-8 flex-wrap items-center gap-2 text-sm';
