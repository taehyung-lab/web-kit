// 파일 책임: 검색 제출·상세 조건·선택·기간·키워드 입력을 같은 목록 상태에 연결한다.
import { useListField, useListFilterBinding, useListDetailsBinding, useListChoiceBinding, listChoiceValue, useListChoiceNormalization, useListMultiChoiceBinding, useListPeriodBinding, useListKeywordBinding, listFieldMeta, type PeriodShortcut, type ListModel } from '@boosterlab/web-kit/list';
import { Choice as ChoiceInput, type ChoiceProps } from '../ui/choice';
import { useId, type ReactNode } from 'react';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import type { Keyword } from '@boosterlab/web-kit/search';
import { XIcon } from 'lucide-react';
import { useListContext, Check, labelled, OptionSelect } from './list-context';


/** 검색 영역. Enter·검색 버튼이 같은 확정(model.submit)을 부른다. */
function Filter({ model: explicitModel, children, className }: { readonly children: ReactNode; readonly className?: string } & { readonly model?: ListModel }) {
  const { model } = useListContext(explicitModel);
  const binding = useListFilterBinding(model);
  return (
    <form
      className={cn('grid gap-4', className)}
      {...binding}
    >
      {children}
    </form>
  );
}

/** 검색·초기화 버튼. Filter 안에 둔다. */
function FilterActions({ model: explicitModel, className, children }: { readonly className?: string; readonly children?: ReactNode } & { readonly model?: ListModel }) {
  const { model, copy } = useListContext(explicitModel);
  const reasonId = useId();
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {children}
      <Button type="button" variant="outline" onClick={model.reset}>
        {copy.reset}
      </Button>
      {/* 막힌 검색도 초점을 받도록 aria-disabled로 잠근다(이유는 옆 문구가 읽힌다). */}
      <Button type="submit" className="aria-disabled:opacity-50" aria-disabled={model.blockedReason !== undefined || undefined} aria-describedby={model.blockedReason === undefined ? undefined : reasonId}>
        {copy.search}
      </Button>
      {model.blockedReason !== undefined && <span id={reasonId} className="text-sm text-muted-foreground">{model.blockedReason}</span>}
    </div>
  );
}

/** 접을 수 있는 상세 필터. 접어도 입력은 초안에 남는다. keys 중 확정 값이 있으면 펼친 채 시작한다. */
function Detail({
  model: explicitModel,
  keys,
  children,
  triggerClassName,
}: {
  readonly keys: readonly string[];
  readonly children: ReactNode;
  /** 펼침 버튼의 모양·자리(기본 클래스 뒤에 합친다). 동작·접근성 연결은 바꾸지 않는다. */
  readonly triggerClassName?: string;
} & { readonly model?: ListModel }) {
  const { model, copy } = useListContext(explicitModel);
  const { open, id, toggle } = useListDetailsBinding(model, keys);
  return (
    <>
      <Button type="button" variant="outline" className={cn('justify-self-start', triggerClassName)} aria-expanded={open} aria-controls={id} onClick={toggle}>
        {copy.detail}
      </Button>
      <div id={id} hidden={!open} className="grid gap-4">
        {children}
      </div>
    </>
  );
}

/** 선택지 조회와 URL 확인이 같은 선언을 쓰는 목록 선택 칸. */
function Choice({ model: explicitModel, name, searchName = name, nodes, ...props }: Omit<ChoiceProps, 'value' | 'onValueChange' | 'nodes'> & { readonly name: string; readonly searchName?: string; readonly nodes?: ChoiceProps['nodes'] } & { readonly model?: ListModel }) {
  const field = useListField<ChoiceProps['value']>(name, searchName, explicitModel);
  const { model, copy } = useListContext(explicitModel);
  const id = useId();
  const { check, options, choices, ready } = useListChoiceBinding(model, searchName, nodes, props.search !== undefined);
  useListChoiceNormalization(model, name, ready);
  const message = field.issues[0]?.message;
  const rule = listChoiceValue(choices, { multiple: props.multiple, search: props.search, required: field.required });
  return <div className="grid content-start gap-2">
    <Label htmlFor={id}>{props.label}{field.required && <RequiredMark />}</Label>
    <ChoiceInput {...props} id={id} nodes={choices} value={rule.view(field.value)} onValueChange={(next) => field.set(rule.commit(next, field.value))} aria-required={field.required} aria-invalid={message !== undefined} aria-describedby={message === undefined ? undefined : `${id}-error`} />
    {check !== undefined && options.isFetching && <span role="status" className="text-sm text-muted-foreground">{copy.loading}</span>}
    {check !== undefined && options.isError && <span role="alert" className="flex items-center gap-2 text-sm text-destructive">{copy.fieldOptionsFailed}<Button type="button" variant="outline" size="sm" onClick={() => void options.refetch()}>{copy.retry}</Button></span>}
    {message !== undefined && <FieldMessage id={`${id}-error`}>{message}</FieldMessage>}
  </div>;
}

/** 문자열 입력 하나. 빈 값은 기본값이 없을 때 undefined로 둔다. */
function Text({ model: explicitModel, name, label }: { readonly name: string; readonly label: string } & { readonly model?: ListModel }) {
  const field = useListField<string | undefined>(name, name, explicitModel);
  const id = useId();
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>
        {label}{field.required && <RequiredMark />}
      </Label>
      <Input
        id={id}
        aria-required={field.required || undefined}
        aria-invalid={field.issues.length > 0 || undefined}
        aria-describedby={field.issues.length > 0 ? `${id}-error` : undefined}
        value={field.value ?? ''}
        onChange={(event) => field.setText(event.target.value)}
      />
      {field.issues[0]?.message !== undefined && <FieldMessage id={`${id}-error`}>{field.issues[0].message}</FieldMessage>}
    </div>
  );
}

/** 단일 선택. 빈 선택은 기본값이 없을 때 undefined다. */
function Select({
  model: explicitModel,
  name,
  label,
  options,
  emptyLabel,
  disabled = false,
}: {
  readonly name: string;
  readonly label: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  /** 있으면 맨 앞에 빈 선택을 둔다. */
  readonly emptyLabel?: string;
  readonly disabled?: boolean;
} & { readonly model?: ListModel }) {
  const field = useListField<string | undefined>(name, name, explicitModel);
  const id = useId();
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>
        {label}{field.required && <RequiredMark />}
      </Label>
      <OptionSelect
        id={id}
        aria-required={field.required || undefined}
        aria-invalid={field.issues.length > 0 || undefined}
        aria-describedby={field.issues.length > 0 ? `${id}-error` : undefined}
        disabled={disabled}
        value={field.value ?? ''}
        onValueChange={(next) => field.setText(next)}
        options={emptyLabel === undefined ? options : [{ value: '', label: emptyLabel }, ...options]}
      />
      {field.issues[0]?.message !== undefined && <FieldMessage id={`${id}-error`}>{field.issues[0].message}</FieldMessage>}
    </div>
  );
}

/**
 * 다중 선택. 빈 배열은 제한 없음(전부 체크 표시)이고 전부 고르면 빈 배열로 돌린다. "전체"는 allLabel이 있을 때만 둔다.
 * listSearch의 choices 칸이면 선택지 값은 선언에서 읽고 optionLabel로 문구만 준다. options는 defineSearch 화면용이다.
 */
function MultiSelect({
  model: explicitModel,
  name,
  label,
  options: given,
  optionLabels,
  allLabel,
}: {
  readonly name: string;
  readonly label: string;
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  /** listSearch 칸의 값별 문구. 선언한 값마다 있어야 한다. */
  readonly optionLabels?: Readonly<Record<string, string>>;
  readonly allLabel?: string;
} & { readonly model?: ListModel }) {
  const { model } = useListContext(explicitModel);
  const options = given ?? labelled(listFieldMeta(model, 'choices', name).values, optionLabels, name);
  const values = options.map((option) => option.value);
  const { effective, set, toggle } = useListMultiChoiceBinding(name, values, explicitModel);
  return (
    <fieldset className="grid content-start gap-2">
      <legend className={legendClass}>{label}</legend>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {allLabel !== undefined && (
          <Check
            checked={effective.length === values.length}
            mixed={effective.length > 0 && effective.length < values.length}
            onChange={(on) => set(on ? values : [])}
          >
            {allLabel}
          </Check>
        )}
        {options.map((option) => (
          <Check
            key={option.value}
            checked={effective.includes(option.value)}
            onChange={(on) => toggle(option.value, on)}
          >
            {option.label}
          </Check>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * 기간: 기준 선택(선택)·단축·직접 입력. 맞지 않는 기간은 검색할 때 상태가 기본값으로 돌린다.
 * listSearch의 dateRange 칸이면 name만 주고 주소 키·기간 기준 값은 선언에서 읽는다(typeLabel은 문구). from·to·type은 defineSearch 화면용이다.
 */
function Period({
  model: explicitModel,
  name,
  from: givenFrom,
  to: givenTo,
  typeLabels,
  label,
  timeZone,
  now,
  presets = [],
  type: givenType,
  startLabel,
  endLabel,
}: {
  readonly name?: string;
  readonly from?: string;
  readonly to?: string;
  /** listSearch 기간 기준 값별 문구. 선언한 값마다 있어야 한다. */
  readonly typeLabels?: Readonly<Record<string, string>>;
  readonly label: string;
  /** 단축이 오늘을 읽는 시간대. 생략하면 브라우저 시간대를 쓴다. */
  readonly timeZone?: string;
  readonly now?: () => Date;
  readonly presets?: readonly PeriodShortcut[];
  /** 기간 기준 필드(공연일·등록일 등). */
  readonly type?: { readonly name: string; readonly options: readonly { readonly value: string; readonly label: string }[] };
  /** 날짜 칸 이름. 생략하면 "{label} {messages.periodStart/End}". */
  readonly startLabel?: string;
  readonly endLabel?: string;
} & { readonly model?: ListModel }) {
  const { model, copy } = useListContext(explicitModel);
  const meta = name === undefined ? undefined : listFieldMeta(model, 'dateRange', name);
  const from = meta?.keys.from ?? givenFrom;
  const to = meta?.keys.to ?? givenTo;
  if (from === undefined || to === undefined) throw new Error('List.Period: give name (listSearch) or from/to');
  const type =
    meta === undefined
      ? givenType
      : meta.types.length > 0
        ? { name: meta.keys.type, options: labelled(meta.types, typeLabels, name!) }
        : undefined;
  const draft = model.draft as Record<string, unknown>;
  const issue = model.issues.find((item) => item.field === from);
  const typeId = useId();
  const { set, rangeOf } = useListPeriodBinding(model, from, to, timeZone, now);
  return (
    <fieldset className="grid content-start gap-2">
      <legend className={legendClass}>{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {type !== undefined && (
          <OptionSelect
            id={typeId}
            aria-label={copy.periodType}
            value={String(draft[type.name] ?? '')}
            onValueChange={(next) => model.patchDraft({ [type.name]: next })}
            options={type.options}
          />
        )}
        <Input
          className="w-auto"
          type="date"
          aria-label={startLabel ?? `${label} ${copy.periodStart}`}
          aria-invalid={issue !== undefined || undefined}
          value={(draft[from] as string | undefined) ?? ''}
          onChange={(event) => model.patchDraft({ [from]: event.target.value || undefined })}
        />
        <span aria-hidden="true">~</span>
        <Input
          className="w-auto"
          type="date"
          aria-label={endLabel ?? `${label} ${copy.periodEnd}`}
          aria-invalid={issue !== undefined || undefined}
          value={(draft[to] as string | undefined) ?? ''}
          onChange={(event) => model.patchDraft({ [to]: event.target.value || undefined })}
        />
      </div>
      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((preset) => {
            const range = rangeOf(preset);
            const active = (range.from ?? '') === ((draft[from] as string | undefined) ?? '') && (range.to ?? '') === ((draft[to] as string | undefined) ?? '');
            return (
            <Button
              type="button"
              variant={active ? 'secondary' : 'outline'}
              size="sm"
              key={preset.label}
              aria-pressed={active}
              onClick={() => set(rangeOf(preset))}
            >
              {preset.label}
            </Button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

/**
 * 키워드: 대상 선택·입력·추가·칩. Enter는 추가 후 검색하고 버튼은 각각 추가·검색만 한다.
 * listSearch의 keywords 칸이면 검색 대상과 구분자는 선언에서 읽고 choiceLabel로 대상 문구만 준다. choices는 defineSearch 화면용이다.
 */
function Keywords({
  model: explicitModel,
  name,
  label,
  choices: givenChoices,
  choiceLabels,
  targetLabel,
  inputLabel,
  removeLabel,
}: {
  readonly name: string;
  readonly label: string;
  readonly choices?: readonly { readonly value: string; readonly label: string }[];
  /** listSearch 검색 대상별 문구. 선언한 대상마다 있어야 한다. */
  readonly choiceLabels?: Readonly<Record<string, string>>;
  /** 대상 선택·입력 칸·칩 제거 버튼 이름. 생략하면 label과 messages로 만든다. */
  readonly targetLabel?: string;
  readonly inputLabel?: string;
  readonly removeLabel?: (item: Keyword, choiceLabel: string) => string;
} & { readonly model?: ListModel }) {
  const { model, copy } = useListContext(explicitModel);
  const meta = givenChoices === undefined ? listFieldMeta(model, 'keywords', name) : undefined;
  const choices = givenChoices ?? labelled(meta!.targets, choiceLabels, name);
  const { input, items, submit, remove } = useListKeywordBinding(model, name, choices.map((choice) => choice.value));
  /** 선언의 구분자(없으면 기본 복사본의 `;`)로 여러 칩을 한 번에 추가한다. 검색 제출의 미추가 입력도 같은 구분자를 쓴다. */
  const separator = meta === undefined ? ';' : meta.split;
  const add = () => input.addMany(separator === undefined ? [input.text] : input.text.split(separator));
  return (
    <fieldset className="grid content-start gap-2">
      <legend className={legendClass}>{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {choices.length > 1 && (
          <OptionSelect aria-label={targetLabel ?? `${label} ${copy.keywordTarget}`} value={input.choice} onValueChange={(next) => input.setChoice(next)} options={choices} />
        )}
        <Input
          aria-label={inputLabel ?? label}
          className="w-auto min-w-48 flex-1"
          value={input.text}
          onChange={(event) => input.setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
            event.preventDefault();
            add();
            submit();
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          {copy.keywordAdd}
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item, index) => {
            const choiceLabel = choices.find((choice) => choice.value === item.field)?.label ?? item.field;
            return (
            <li key={`${item.field}:${item.value}`} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary py-0.5 pr-0.5 pl-2.5 text-xs text-secondary-foreground">
              {choiceLabel}: {item.value}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="rounded-full"
                aria-label={removeLabel?.(item, choiceLabel) ?? `${item.value} ${copy.keywordRemove}`}
                onClick={() => remove(index)}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}

/** 묶음 칸 제목(legend). Label과 같은 글자 모양을 쓴다. */
const legendClass = 'mb-2 text-sm leading-none font-medium';

/** 필수 칸 표시. 낭독기는 aria-required로 읽으므로 숨긴다. */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      {' *'}
    </span>
  );
}

/** 칸 오류 한 줄. aria-describedby로 칸에 연결된다. */
function FieldMessage({ id, children }: { readonly id: string; readonly children: ReactNode }) {
  return (
    <span id={id} role="alert" className="text-sm text-destructive">
      {children}
    </span>
  );
}

export { Filter, FilterActions, Detail, Choice, Text, Select, MultiSelect, Period, Keywords };
