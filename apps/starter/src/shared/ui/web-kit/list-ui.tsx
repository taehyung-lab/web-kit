// 파일 책임: 목록 기본 UI의 묶음 부품(List.*). 각 부품은 같은 목록 상태(useList)를 context로 읽어서, 필터·표·페이지 이동을
// 어디에 두어도 조회·정렬·선택 연결을 다시 쓰지 않는다. 검색 직전 보장(기간 검증·입력 중 키워드)은 상태가 맡고 부품은 표시만 한다.
import { ListProvider as ModelProvider, useListModel, useListField, useListFilterBinding, useListDetailsBinding, useBulkConfirmation, useListChoiceBinding, useListChoiceNormalization, useListMultiChoiceBinding, useListPeriodBinding, listPaginationBinding, useListDownloadBinding, useListKeywordBinding, listViewBinding, listRowBinding, useListVirtualRows, listFieldMeta, type PeriodShortcut, type DownloadControl, type ListModel } from '@boosterlab/web-kit/list';
import { Choice as ChoiceInput, MixedCheckbox, type ChoiceProps } from './ui/choice';
import { createContext, useContext, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { SelectBox } from './select-box';
import { Table as TableRoot, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import type { DownloadKind } from '@boosterlab/web-kit/list';
import type { Keyword, SearchMeta, SearchMetaEntry } from '@boosterlab/web-kit/search';
import { ConfirmDialog } from './ui/dialog';
import { Pending } from './ui/pending';
import { XIcon } from 'lucide-react';

const defaultMessages = {
  search: '검색',
  reset: '초기화',
  detail: '상세 검색',
  retry: '다시 시도',
  notSearched: '검색 조건을 입력하고 검색해 주세요.',
  notReady: '조회 조건을 확인해 주세요.',
  optionsFailed: '선택지를 불러오지 못해 조회하지 않았습니다.',
  fieldOptionsFailed: '선택지를 불러오지 못했습니다.',
  loading: '불러오는 중입니다.',
  failed: '목록을 불러오지 못했습니다.',
  empty: '조회 결과가 없습니다.',
  refreshFailed: '최신 내용을 불러오지 못해 이전 결과를 보여 줍니다.',
  selectPage: '이 페이지 전체 선택',
  selectRow: '행 선택',
  previous: '이전',
  next: '다음',
  pagination: '페이지 이동',
  size: '페이지 크기',
  sort: '정렬',
  total: '총',
  totalUnit: '건',
  keywordTarget: '검색 대상',
  keywordAdd: '추가',
  keywordRemove: '제거',
  periodStart: '시작',
  periodEnd: '종료',
  periodType: '기간 기준',
  all: '전체',
  confirm: '확인',
  cancel: '취소',
  items: '개 항목',
  reload: '목록 다시 조회',
  resultUnknown: '처리 결과를 확인할 수 없습니다. 목록을 다시 조회한 뒤 대상을 새로 선택해 주세요.',
  actionFailed: '작업을 완료하지 못했습니다. 결과를 확인해 주세요.',
  download: '다운로드',
  downloadKind: '다운로드 종류',
  downloadChoose: '선택',
  downloadAll: '전체 다운로드',
  downloadSelected: '선택 다운로드',
  downloading: '다운로드 중입니다.',
  downloadFailed: '다운로드하지 못했습니다.',
  chooseValue: '바꿀 값을 먼저 선택해 주세요.',
};
/** 뒤에 더한 문구(fieldOptionsFailed·chooseValue)는 선택이라, 전체 문구를 넘기던 앱이 키 추가로 깨지지 않는다. */
export type ListMessages = Omit<typeof defaultMessages, 'fieldOptionsFailed' | 'chooseValue' | 'reload' | 'resultUnknown'> & { readonly fieldOptionsFailed?: string; readonly chooseValue?: string; readonly reload?: string; readonly resultUnknown?: string };

/** 실패가 보이는 자리. list는 결과 없는 조회 실패, refresh는 이전 결과 유지 중 실패, action·download는 쓰기 실패다. */
export type FailurePlace = 'list' | 'refresh' | 'action' | 'download';
/**
 * 실패 원인 문구. undefined면 키트 기본 문구, null이면 그 자리에 아무것도 그리지 않는다(앱 경계가 이미 알린 실패 등).
 * refresh에서는 원인 뒤에 이전 결과 안내(messages.refreshFailed)를 붙이며 ''를 주면 원인 없이 안내만 보인다.
 */
export type RenderFailure = (failure: unknown, place: FailurePlace) => ReactNode | null | undefined;
type Context = {
  readonly copy: typeof defaultMessages;
  readonly renderFailure: RenderFailure;
};
/** 앱이 ListDefaults로 준 기본값. 없으면 키트 기본 문구만 쓴다. */
type Defaults = { readonly messages: Partial<ListMessages>; readonly renderFailure?: RenderFailure };
const DefaultsContext = createContext<Defaults>({ messages: {} });
/** <List> 안의 표시 설정. 밖에서 명시 모델로 쓴 부품은 null을 보고 앱 기본값을 직접 읽는다. */
const PresentationContext = createContext<Context | null>(null);

/** 값이 undefined인 키를 버린다. 「이 문구는 따로 정하지 않음」이 아래 단계의 문구를 지우지 않게 한다. */
function definedOnly<T extends object>(value: T | undefined): Partial<T> {
  if (value === undefined) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

/** 가까운 쪽 실패 문구를 먼저 묻고, undefined(정하지 않음)일 때만 다음 단계에 묻는다. null·''은 그 단계의 답으로 그대로 쓴다. */
function chainFailure(first: RenderFailure | undefined, next: RenderFailure | undefined): RenderFailure | undefined {
  if (first === undefined) return next;
  if (next === undefined) return first;
  return (failure, place) => {
    const own = first(failure, place);
    return own === undefined ? next(failure, place) : own;
  };
}

/** 키트 기본 → 앱 기본(ListDefaults) → 이 목록(<List messages renderFailure>) 순으로 덮어쓴 표시 설정. */
function usePresentation(messages?: Partial<ListMessages>, renderFailure?: RenderFailure): Context {
  const defaults = useContext(DefaultsContext);
  return {
    copy: { ...defaultMessages, ...defaults.messages, ...definedOnly(messages) },
    renderFailure: chainFailure(renderFailure, defaults.renderFailure) ?? (() => undefined),
  };
}

/** 표시 설정과 패키지 모델을 함께 읽되 명시 모델을 우선한다. */
function useListContext(explicit?: ListModel) {
  const local = useContext(PresentationContext);
  const fallback = usePresentation();
  return { ...(local ?? fallback), model: useListModel(explicit) };
}

/**
 * 앱 전체의 목록 기본 문구와 실패 문구. 앱 골격에 한 번 두고 언어가 바뀌면 새 messages로 다시 그린다.
 * 각 <List messages renderFailure>는 이 값 위에 덮어쓴다. 안쪽 ListDefaults는 바깥 값 위에 덮어쓴다.
 * renderFailure는 가까운 쪽부터 묻고 undefined면 다음 단계(바깥 → 키트 기본 문구)로 넘긴다. null이면 그리지 않는다.
 */
export function ListDefaults({
  messages,
  renderFailure,
  children,
}: {
  readonly messages?: Partial<ListMessages>;
  readonly renderFailure?: RenderFailure;
  readonly children: ReactNode;
}) {
  const outer = useContext(DefaultsContext);
  const value: Defaults = {
    messages: { ...outer.messages, ...definedOnly(messages) },
    renderFailure: chainFailure(renderFailure, outer.renderFailure),
  };
  return <DefaultsContext.Provider value={value}>{children}</DefaultsContext.Provider>;
}
export { useListModel, useListField };
export type { ListModel };

/** 목록 하나의 부품들이 같은 상태를 쓰게 한다. 배치는 children이 정한다. */
function ListRoot({
  model,
  messages,
  renderFailure,
  children,
}: {
  readonly model: ListModel;
  readonly messages?: Partial<ListMessages>;
  readonly renderFailure?: RenderFailure;
  readonly children: ReactNode;
}) {
  const context = usePresentation(messages, renderFailure);
  return <ModelProvider model={model}><PresentationContext.Provider value={context}>{children}</PresentationContext.Provider></ModelProvider>;
}

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
  const { check, options, choices } = useListChoiceBinding(model, searchName, nodes);
  useListChoiceNormalization(model, name, props.search === undefined && (check === undefined ? nodes !== undefined : options.isSuccess && !options.isFetching && !options.isError) ? choices : undefined);
  const message = field.issues[0]?.message;
  return <div className="grid content-start gap-2">
    <Label htmlFor={id}>{props.label}{field.required && <RequiredMark />}</Label>
    <ChoiceInput {...props} id={id} nodes={choices} value={field.value} onValueChange={field.set} aria-required={field.required} aria-invalid={message !== undefined} aria-describedby={message === undefined ? undefined : `${id}-error`} />
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

/** 체크박스 하나(shadcn Checkbox). 일부 선택은 indeterminate로 보인다. */
function Check({
  label,
  checked,
  mixed = false,
  disabled = false,
  onChange,
  children,
}: {
  readonly label?: string;
  readonly checked: boolean;
  readonly mixed?: boolean;
  readonly disabled?: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly children?: ReactNode;
}) {
  const box = (
    <MixedCheckbox
      aria-label={label}
      checked={checked}
      indeterminate={mixed}
      disabled={disabled}
      onCheckedChange={(next) => onChange(next)}
    />
  );
  if (children === undefined) return box;
  return (
    <label className="flex items-center gap-2 text-sm">
      {box}
      {children}
    </label>
  );
}

/** 선언한 값마다 화면 문구를 붙인다. 문구가 빠진 값이 있으면 값 그대로 보이지 않게 오류를 낸다. */
function labelled(values: readonly string[], labels: Readonly<Record<string, string>> | undefined, field: string) {
  return values.map((value) => {
    const label = labels?.[value];
    if (label === undefined) throw new Error(`list: no label for "${value}" of "${field}"`);
    return { value, label };
  });
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

export type { PeriodShortcut } from '@boosterlab/web-kit/list';

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

/** 결과 영역: 조회 안 함·로딩·실패(재시도)·빈 결과·이전 결과 유지 중 실패 안내. 결과가 있을 때만 children(표)을 그린다. */
function Result({ model: explicitModel, children, className }: { readonly children: ReactNode; readonly className?: string } & { readonly model?: ListModel }) {
  const { model, copy, renderFailure } = useListContext(explicitModel);
  const status = model.status;
  const resultId = useId();
  let body: ReactNode;
  if (status.kind === 'idle') {
    const text =
      status.reason === 'not-searched'
        ? copy.notSearched
        : status.reason === 'check-failed'
          ? copy.optionsFailed
          : copy.notReady;
    body = (
      <div role="status" className={stateClass}>
        {text}
        {'resume' in status && status.reason !== 'not-searched' && (
          <Button type="button" variant="outline" onClick={status.resume}>
            {copy.retry}
          </Button>
        )}
      </div>
    );
  } else if (status.kind === 'pending' && model.rows.length === 0) {
    body = (
      <p role="status" className={stateClass}>
        {copy.loading}
      </p>
    );
  } else if (status.kind === 'failed') {
    const custom = renderFailure(status.failure, 'list');
    const text = custom === undefined ? copy.failed : custom;
    body =
      text === null ? null : (
        <div role="alert" className={stateClass}>
          {text}
          <Button type="button" variant="outline" onClick={status.retry}>
            {copy.retry}
          </Button>
        </div>
      );
  } else if (status.kind === 'empty') {
    body = (
      <p role="status" className={stateClass}>
        {copy.empty}
      </p>
    );
  } else body = children;
  const cause = model.failure === undefined ? null : renderFailure(model.failure, 'refresh');
  const refreshText =
    model.failure === undefined || cause === null ? null : (
      <>
        {cause === undefined || cause === '' ? null : <>{cause} · </>}
        {copy.refreshFailed}
      </>
    );
  return (
    <section id={resultId} tabIndex={-1} className={cn('grid gap-3', className)} aria-busy={model.isFetching || undefined}>
      {refreshText !== null && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {refreshText}
          <Button type="button" variant="outline" size="sm" onClick={model.refresh}>
            {copy.retry}
          </Button>
        </div>
      )}
      {body}
    </section>
  );
}

/** 표 컬럼 하나. sort를 주면 머리글이 그 정렬 키로 정렬한다. */
export interface ListColumn<Row> {
  readonly key: string;
  readonly header: ReactNode;
  readonly cell: (row: Row) => ReactNode;
  readonly sort?: string;
  readonly className?: string;
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;
/** 이 행 수부터 화면에 보이는 행만 그린다. */
export const VIRTUALIZE_FROM_ROWS = 50;

/** 결과 표: 선택 열·정렬 머리글·행 이동(클릭·Enter)·많은 행의 가상화. 이전 조건 결과는 선택할 수 없다. */
function Table<Row>({
  model: explicitModel,
  columns,
  rowId: givenRowId,
  onOpen,
  selectable: givenSelectable,
  rowLabel,
  virtualizeFrom = VIRTUALIZE_FROM_ROWS,
  className,
  headerClassName,
}: {
  readonly columns: readonly ListColumn<Row>[];
  /** 생략하면 useList의 rowId. */
  readonly rowId?: (row: Row) => string;
  readonly onOpen?: (row: Row) => void;
  /** 선택 칸. 생략하면 useList에 selectable을 선언했고 지금 행 중 선택할 수 있는 행이 있을 때 보인다. */
  readonly selectable?: boolean;
  /** 행 선택 체크박스의 이름. */
  readonly rowLabel?: (row: Row) => string;
  readonly virtualizeFrom?: number;
  readonly className?: string;
  /**
   * 머리글(thead) 표면. 일반·가상화 표에 똑같이 붙는다. 가상화 중에는 머리글이 위에 고정되어 행이 그 밑으로 지나가므로
   * 기본은 불투명한 bg-background이고, 배경을 바꾸려면 불투명한 색을 준다(반투명이면 지나가는 행이 비친다).
   */
  readonly headerClassName?: string;
} & { readonly model?: ListModel }) {
  const { model, copy } = useListContext(explicitModel);
  const rows = model.rows as readonly Row[];
  const rowId = givenRowId ?? (model.rowId as ((row: Row) => string) | undefined);
  if (rowId === undefined) throw new Error('List.Table: give rowId or declare it in useList');
  const isSelectable = model.isSelectable as ((row: Row) => boolean) | undefined;
  const selectable = givenSelectable ?? (isSelectable !== undefined && rows.some(isSelectable));
  const viewport = useRef<HTMLDivElement>(null);
  const virtualize = rows.length >= virtualizeFrom;
  const { sortKey, order, locked } = listViewBinding(model);
  const columnCount = columns.length + (selectable ? 1 : 0);

  /** 행 하나. 가상화 중이면 측정 ref와 위치를 받는다. */
  const renderRow = (row: Row, measure?: { readonly index: number; readonly ref: (node: Element | null) => void }) => {
    const id = rowId(row);
    const activate = onOpen === undefined ? undefined : () => onOpen(row);
    const binding = listRowBinding(model, id, activate);
    return (
      <TableRow
        key={id}
        data-index={measure?.index}
        ref={measure?.ref}
        data-selected={binding.checked || undefined}
        data-state={binding.checked ? 'selected' : undefined}
        tabIndex={activate ? 0 : undefined}
        className={activate ? 'cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring' : undefined}
        onClick={binding.onClick}
        onKeyDown={binding.onKeyDown}
      >
        {selectable && (
          <TableCell className="w-px">
            <Check
              label={rowLabel?.(row) ?? copy.selectRow}
              checked={binding.checked}
              disabled={binding.disabled}
              onChange={binding.toggle}
            />
          </TableCell>
        )}
        {columns.map((column) => (
          <TableCell key={column.key} className={column.className}>
            {column.cell(row)}
          </TableCell>
        ))}
      </TableRow>
    );
  };

  return (
    <div
      ref={viewport}
      // 스크롤은 이 영역 하나가 맡는다(shadcn Table의 가로 스크롤 감싸개를 풀어 가상화 측정·머리글 고정이 이 영역 기준이 되게 한다).
      className={cn('overflow-auto rounded-lg border border-border [&>[data-slot=table-container]]:overflow-visible data-virtual:max-h-[576px]', className)}
      data-virtual={virtualize || undefined}
    >
      <TableRoot>
        {/* 고정과 배경은 머리글 자체에 둔다. 바깥 선택자로 칠하면 소비처의 머리글 배경보다 우선순위가 높아져 두 모드의 색이 갈린다. */}
        <TableHeader className={cn(virtualize && 'sticky top-0 z-10 bg-background', headerClassName)}>
          <TableRow>
            {selectable && (
              <TableHead scope="col" className="w-px">
                <Check
                  label={copy.selectPage}
                  checked={model.selection.isAllChecked}
                  mixed={model.selection.isMixed}
                  disabled={locked}
                  onChange={(on) => model.selection.togglePage(on)}
                />
              </TableHead>
            )}
            {columns.map((column) => {
              const direction = column.sort !== undefined && column.sort === sortKey ? order : undefined;
              return (
                <TableHead key={column.key} scope="col" aria-sort={direction ? ARIA_SORT[direction] : undefined} className={column.className}>
                  {column.sort === undefined ? (
                    column.header
                  ) : (
                    <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={() => model.toggleSort(column.sort!)}>
                      {column.header}
                      <span aria-hidden="true" className={direction === undefined ? 'text-muted-foreground/50' : undefined}>
                        {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '↕'}
                      </span>
                    </Button>
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {virtualize ? (
            <VirtualRows rows={rows} rowId={rowId} viewport={viewport} columnCount={columnCount} renderRow={renderRow} />
          ) : (
            rows.map((row) => renderRow(row))
          )}
        </TableBody>
      </TableRoot>
    </div>
  );
}

/** 보이는 행과 앞뒤 여유분만 그리고 나머지 자리는 빈 행 높이로 채운다. */
function VirtualRows<Row>({
  rows,
  rowId,
  viewport,
  columnCount,
  renderRow,
}: {
  readonly rows: readonly Row[];
  readonly rowId: (row: Row) => string;
  readonly viewport: RefObject<HTMLDivElement | null>;
  readonly columnCount: number;
  readonly renderRow: (row: Row, measure: { readonly index: number; readonly ref: (node: Element | null) => void }) => ReactNode;
}) {
  const { items, leading, trailing, measureElement } = useListVirtualRows(rows, rowId, viewport);
  const spacer = (height: number) => (
    <tr aria-hidden="true">
      <td colSpan={columnCount} style={{ height, padding: 0 }} />
    </tr>
  );
  return (
    <>
      {leading > 0 && spacer(leading)}
      {items.map((item) => {
        const row = rows[item.index];
        return row === undefined ? null : renderRow(row, { index: item.index, ref: measureElement });
      })}
      {trailing > 0 && spacer(trailing)}
    </>
  );
}

/** 총 건수. 이전 조건 결과를 보이는 동안은 그 숫자가 틀린 정보라 '…'이다. */
function Total({ model: explicitModel, className }: { readonly className?: string } & { readonly model?: ListModel }) {
  const { model, copy } = useListContext(explicitModel);
  const { total } = listViewBinding(model);
  const count = total === undefined ? '…' : total.toLocaleString();
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      {copy.total} <strong className="text-foreground">{count}</strong>
      {copy.totalUnit}
    </p>
  );
}

/** 페이지 크기 선택. 바꾸면 첫 페이지로 확정한다. */
function PageSize({ model: explicitModel, sizes: givenSizes }: { readonly sizes?: readonly number[] } & { readonly model?: ListModel }) {
  const { model, copy } = useListContext(explicitModel);
  // listSearch면 선언의 보기 수를 쓴다.
  const sizes = givenSizes ?? listFieldMeta(model, 'paging').sizes;
  const binding = listViewBinding(model);
  const id = useId();
  return (
    <span className="inline-flex items-center gap-2">
      <Label htmlFor={id}>{copy.size}</Label>
      <OptionSelect id={id} value={String(binding.size)} onValueChange={(next) => binding.setSize(next)} options={sizes.map((size) => ({ value: String(size), label: String(size) }))} />
    </span>
  );
}

/** 정렬 키 선택. 고르면 그 키의 첫 방향(sortFirst)으로, 같은 키면 지금 방향으로 확정한다. */
function SortSelect({
  model: explicitModel,
  options: givenOptions,
  optionLabels,
}: {
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  /** listSearch면 정렬 값은 선언에서 읽고 값별 문구만 준다. 선언한 값마다 있어야 한다. */
  readonly optionLabels?: Readonly<Record<string, string>>;
} & { readonly model?: ListModel }) {
  const { model, copy } = useListContext(explicitModel);
  const options = givenOptions ?? labelled(listFieldMeta(model, 'sort').values, optionLabels, 'sort');
  const binding = listViewBinding(model);
  return (
    <OptionSelect aria-label={copy.sort} value={binding.sort} onValueChange={(next) => binding.setSort(next)} options={options} />
  );
}

/** 번호 페이지 이동. 한 페이지뿐이면 그리지 않는다. */
function Pagination({ model: explicitModel, className }: { readonly className?: string } & { readonly model?: ListModel }) {
  const { model, copy } = useListContext(explicitModel);
  const { page, last, pages, visible } = listPaginationBinding(model);
  if (!visible) return null;
  return (
    <nav aria-label={copy.pagination} className={cn('flex items-center justify-end gap-1', className)}>
      <Button type="button" variant="ghost" disabled={page === 1} onClick={() => model.goToPage(page - 1)}>
        {copy.previous}
      </Button>
      {pages.map((number, index, all) => (
        <span key={number} className="inline-flex items-center gap-1">
          {index > 0 && number - (all[index - 1] ?? number) > 1 && <span aria-hidden="true" className="px-1 text-muted-foreground">…</span>}
          <Button
            type="button"
            variant={number === page ? 'outline' : 'ghost'}
            size="icon"
            aria-current={number === page ? 'page' : undefined}
            onClick={() => model.goToPage(number)}
          >
            {number}
          </Button>
        </span>
      ))}
      <Button type="button" variant="ghost" disabled={page === last} onClick={() => model.goToPage(page + 1)}>
        {copy.next}
      </Button>
    </nav>
  );
}

/** 선택 기반 쓰기 액션 자리. 이전 조건 결과를 보이는 동안 통째로 잠근다. */
function Actions({ model: explicitModel, children, className }: { readonly children: ReactNode; readonly className?: string } & { readonly model?: ListModel }) {
  const { model } = useListContext(explicitModel);
  return (
    <fieldset disabled={!model.isCurrent || model.selection.isRunning || model.selection.failure !== undefined} className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      {children}
    </fieldset>
  );
}

/** 일괄 작업 실패 문구. 업무 거절(string)은 그대로, 그 밖의 실패는 renderFailure → 기본 문구 순이다. null이면 그리지 않는다. */
function bulkErrorText(error: unknown, copy: Context['copy'], renderFailure: RenderFailure): ReactNode | null {
  if (error === undefined) return null;
  if (typeof error === 'string') return error;
  const custom = renderFailure(error, 'action');
  return custom === undefined ? copy.actionFailed : custom;
}

/** 일괄 작업 확인창과 확인창 밖 실패 줄. BulkAction·BulkSelectAction이 같은 모양을 쓴다. */
function BulkConfirm({
  open,
  title,
  running,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  body,
  errorText,
  recovery,
  reloadLabel,
  unknownMessage,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly running: boolean;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly body: ReactNode;
  readonly errorText: ReactNode | null;
  readonly recovery?: { readonly pending: boolean; readonly run: () => Promise<void> };
  readonly reloadLabel: string;
  readonly unknownMessage: string;
}) {
  return (
    <>
      <ConfirmDialog open={open} title={title} pending={running || recovery?.pending} confirmLabel={recovery ? reloadLabel : confirmLabel} cancelLabel={cancelLabel} onConfirm={recovery ? () => void recovery.run() : onConfirm} onCancel={onCancel}>
        {recovery ? <p>{unknownMessage}</p> : open ? body : null}
        {errorText !== null && (
          <p role="alert" className="text-sm text-destructive">
            {errorText}
          </p>
        )}
      </ConfirmDialog>
      {!open && recovery && (
        <div role="alert">
          <p>{unknownMessage}</p>
          <Button type="button" disabled={recovery.pending} onClick={() => void recovery.run()}>{reloadLabel}</Button>
          {recovery.pending ? <Pending label={reloadLabel} /> : null}
        </div>
      )}
      {!open && errorText !== null && (
        <p role="alert" className="text-sm text-destructive">
          {errorText}
        </p>
      )}
    </>
  );
}

/** 확인창을 거치는 일괄 작업. 확인 당시 결과와 선택이 바뀌면 실행하지 않고, 실패는 확인창에 남기며 선택은 유지한다. */
function BulkAction<T>({
  model: explicitModel,
  label,
  run,
  check,
  title = label,
  confirmLabel,
  cancelLabel,
  describe,
}: {
  readonly label: string;
  readonly run: (ids: readonly string[]) => Promise<{ completedIds: readonly string[]; value?: T }>;
  /** 업무상 거절 사유. 있으면 실행하지 않고 보인다. */
  readonly check?: (ids: readonly string[]) => string | undefined;
  readonly title?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly describe?: (ids: readonly string[]) => ReactNode;
} & { readonly model?: ListModel }) {
  const { model, copy, renderFailure } = useListContext(explicitModel);
  const { pending, error, confirm, locked, open, cancel, recovery } = useBulkConfirmation({ model, run, check });
  return (
    <>
      <Button type="button" variant="outline" disabled={locked} onClick={open}>
        {label}
      </Button>
      <BulkConfirm
        open={pending !== undefined}
        title={title}
        running={model.selection.isRunning}
        confirmLabel={confirmLabel ?? copy.confirm}
        cancelLabel={cancelLabel ?? copy.cancel}
        onConfirm={() => void confirm()}
        onCancel={cancel}
        body={pending === undefined ? null : (describe?.(pending.ids) ?? `${pending.ids.length}${copy.items}`)}
        errorText={bulkErrorText(error, copy, renderFailure)}
        recovery={recovery}
        reloadLabel={copy.reload ?? defaultMessages.reload}
        unknownMessage={copy.resultUnknown ?? defaultMessages.resultUnknown}
      />
    </>
  );
}

/**
 * 고른 값 하나로 선택 행을 바꾸는 일괄 작업(상태 변경 등). 선택 칸 + 실행 버튼 + 확인창을 한 묶음(fieldset)으로 그린다.
 * 확인창을 여는 순간의 행 id와 값을 함께 고정해 업무 확인·실행·문구에 쓴다(열린 뒤 선택 칸이 바뀌어도 확인한 값으로 실행한다).
 * 값을 고르지 않고 누르면 실행하지 않고 requiredMessage(없으면 messages.chooseValue)를 보인다. 성공 뒤에도 고른 값은 그대로 둔다.
 * 이전 조건 결과를 보이는 동안 묶음 전체가 잠긴다. 확인 당시 결과·선택이 바뀌면 실행하지 않는 것, 실패 선택 유지, 중복 실행 방지는 BulkAction과 같다.
 */
function BulkSelectAction<V extends string, T = unknown>({
  model: explicitModel,
  label,
  options,
  placeholder,
  selectLabel,
  selectClassName,
  requiredMessage,
  defaultValue,
  run,
  check,
  title = label,
  confirmLabel,
  cancelLabel,
  describe,
  className,
}: {
  /** 실행 버튼 문구. */
  readonly label: string;
  readonly options: readonly { readonly value: V; readonly label: string; readonly disabled?: boolean }[];
  /** 값을 고르기 전 선택 칸에 보이는 문구. */
  readonly placeholder?: string;
  /** 선택 칸의 접근성 이름. 생략하면 label. */
  readonly selectLabel?: string;
  /** 선택 칸의 크기·모양(기본 min-w-32 뒤에 합친다). */
  readonly selectClassName?: string;
  /** 값을 고르지 않고 눌렀을 때의 안내. 생략하면 messages.chooseValue. */
  readonly requiredMessage?: string;
  readonly defaultValue?: V;
  readonly run: (ids: readonly string[], value: V) => Promise<{ completedIds: readonly string[]; value?: T }>;
  /** 업무상 거절 사유. 있으면 실행하지 않고 보인다. 여는 순간은 지금 고른 값, 실행 직전은 확인창에 고정한 값으로 묻는다. */
  readonly check?: (ids: readonly string[], value: V) => string | undefined;
  readonly title?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly describe?: (ids: readonly string[], value: V) => ReactNode;
  /** 묶음(fieldset)의 배치. */
  readonly className?: string;
} & { readonly model?: ListModel }) {
  const { model, copy, renderFailure } = useListContext(explicitModel);
  const [chosen, setChosen] = useState<V | null>(defaultValue ?? null);
  // 선택지가 바뀌어 고른 값이 사라졌거나 막혔으면 고르지 않은 것으로 본다.
  const value = chosen !== null && options.some((option) => option.value === chosen && option.disabled !== true) ? chosen : null;
  const { pending, error, confirm, locked, open, cancel, recovery } = useBulkConfirmation<T, V>({
    model,
    value: value ?? undefined,
    run: (ids, target) => target === undefined
      ? Promise.reject(requiredMessage ?? copy.chooseValue)
      : run(ids, target),
    check: (ids, target) => target === undefined || !options.some(option => option.value === target && option.disabled !== true)
      ? (requiredMessage || copy.chooseValue || defaultMessages.chooseValue)
      : check?.(ids, target),
  });
  const fixed = pending?.value;
  const optionLabel = options.find((option) => option.value === fixed)?.label ?? fixed;
  return (
    <fieldset disabled={!model.isCurrent} className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      <SelectBox
        aria-label={selectLabel ?? label}
        className={cn('min-w-32', selectClassName)}
        options={options}
        placeholder={placeholder}
        value={value}
        disabled={!model.isCurrent || model.selection.isRunning}
        onValueChange={(next) => setChosen(next as V | null)}
      />
      <Button type="button" variant="outline" disabled={locked} onClick={open}>
        {label}
      </Button>
      <BulkConfirm
        open={pending !== undefined}
        title={title}
        running={model.selection.isRunning}
        confirmLabel={confirmLabel ?? copy.confirm}
        cancelLabel={cancelLabel ?? copy.cancel}
        onConfirm={() => void confirm()}
        onCancel={cancel}
        body={pending === undefined || fixed === undefined ? null : (describe?.(pending.ids, fixed) ?? `${optionLabel}: ${pending.ids.length}${copy.items}`)}
        errorText={bulkErrorText(error, copy, renderFailure)}
        recovery={recovery}
        reloadLabel={copy.reload ?? defaultMessages.reload}
        unknownMessage={copy.resultUnknown ?? defaultMessages.resultUnknown}
      />
    </fieldset>
  );
}

export type { DownloadControl } from '@boosterlab/web-kit/list';

/** 다운로드 종류 선택과 실행 버튼. 진행 중에는 잠기고 실패는 원인과 함께 남는다. kinds 순서대로 보인다. */
function Download({
  model: explicitModel,
  control,
  kinds = ['all', 'selected'],
  label,
}: {
  readonly control: DownloadControl;
  readonly kinds?: readonly DownloadKind[];
  readonly label?: string;
} & { readonly model?: ListModel }) {
  const { copy, renderFailure } = useListContext(explicitModel);
  const { kind, blocked, change, start } = useListDownloadBinding(control, kinds);
  const kindLabel = (value: DownloadKind) => (value === 'all' ? copy.downloadAll : copy.downloadSelected);
  const custom = control.state.kind === 'failed' ? renderFailure(control.state.failure, 'download') : null;
  const failure = control.state.kind !== 'failed' ? null : custom === undefined ? copy.downloadFailed : custom;
  const running = control.state.kind === 'running';
  return (
    <span className="inline-flex flex-wrap items-center gap-2" aria-busy={running || undefined}>
      <OptionSelect
        aria-label={copy.downloadKind}
        disabled={running}
        value={kind}
        onValueChange={(next) => change(next)}
        options={[{ value: '', label: copy.downloadChoose }, ...kinds.map((value) => ({ value, label: kindLabel(value) }))]}
      />
      <Button type="button" variant="outline" disabled={blocked} onClick={start}>
        {label ?? copy.download}
      </Button>
      {/* 진행 중에는 종류·버튼을 잠그고 옆에 로딩 표시만 둔다. 문구는 화면 낭독기에만 읽힌다. */}
      {running && <Pending label={copy.downloading} />}
      {failure !== null && (
        <span role="alert" className="text-sm text-destructive">
          {failure}
        </span>
      )}
    </span>
  );
}

/** 묶음 칸 제목(legend). Label과 같은 글자 모양을 쓴다. */
const legendClass = 'mb-2 text-sm leading-none font-medium';
/** 결과 자리 안내(조회 전·로딩·실패·빈 결과). */
const stateClass = 'flex min-h-32 flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground';

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

/**
 * 문자열 값 하나를 고르는 shadcn Select. 빈 문자열('')은 「값 없음」 선택지로 다룬다(목록 상태는 문자열을 주고받는다).
 * 칸 이름은 id+Label 또는 aria-label로 트리거에 붙고, 오류 연결(aria-*)도 트리거가 받는다.
 */
function OptionSelect({
  value,
  onValueChange,
  options,
  disabled,
  ...trigger
}: {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly disabled?: boolean;
  readonly id?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-required'?: boolean;
  readonly 'aria-invalid'?: boolean;
  readonly 'aria-describedby'?: string;
}) {
  return (
    <SelectBox
      {...trigger}
      className="min-w-32"
      options={options}
      value={value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(typeof next === 'string' ? next : '')}
    />
  );
}

/** 선언의 칸 종류와 문구를 검사하는 타입 입구. 실행 구현은 List와 같다. */
type Props<C> = C extends (props: infer P) => unknown ? P : never;
type Names<M extends SearchMeta, K extends SearchMetaEntry['kind']> = {
  [N in keyof M & string]: M[N]['kind'] extends K ? N : never;
}[keyof M & string];
type NamedLabels<M extends SearchMeta, K extends SearchMetaEntry['kind'], P, L extends string, V extends string> = {
  [N in Names<M, K>]: Omit<P, 'name' | L | 'options' | 'choices' | 'from' | 'to' | 'type'> & { readonly name: N } &
    { readonly [Label in L]: Readonly<Record<M[N] extends Record<V, readonly (infer Value extends string)[]> ? Value : never, string>> }
}[Names<M, K>];
type MultiMeta<M extends SearchMeta> = { [N in keyof M as M[N] extends { multiple: true } ? N : never]: M[N] };
export type TypedList<M extends SearchMeta> = typeof ListRoot & Omit<typeof List, 'of' | 'Keywords' | 'MultiSelect' | 'Period' | 'SortSelect' | 'Detail'> & {
  readonly Keywords: (props: NamedLabels<M, 'keywords', Props<typeof Keywords>, 'choiceLabels', 'targets'>) => ReactNode;
  readonly MultiSelect: (props: NamedLabels<MultiMeta<M>, 'choices', Props<typeof MultiSelect>, 'optionLabels', 'values'>) => ReactNode;
  readonly Period: (props: NamedLabels<M, 'dateRange', Props<typeof Period>, 'typeLabels', 'types'>) => ReactNode;
  readonly SortSelect: (props: Omit<Props<typeof SortSelect>, 'options' | 'optionLabels'> & {
    readonly optionLabels: Readonly<Record<M[Names<M, 'sort'>] extends { values: readonly (infer V extends string)[] } ? V : never, string>>;
  }) => ReactNode;
  readonly Detail: (props: Omit<Props<typeof Detail>, 'keys'> & { readonly keys: readonly (keyof M & string)[] }) => ReactNode;
};

/** 목록 기본 UI. <List model={useList(...)}> 안에 부품을 원하는 배치로 둔다. */
export const List = Object.assign(ListRoot, {
  of: <S extends { readonly meta: SearchMeta },>() => List as unknown as TypedList<S['meta']>,
  Filter,
  Choice,
  FilterActions,
  Detail,
  Text,
  Select,
  MultiSelect,
  Period,
  Keywords,
  Result,
  Table,
  Total,
  PageSize,
  SortSelect,
  Pagination,
  Actions,
  BulkAction,
  BulkSelectAction,
  Download,
  Check,
});

/** 같은 목록 상태를 일반 JSX 이름으로 조립하는 입구. 기존 List.*와 구현·수명이 같다. */
export {
  ListRoot as ListProvider,
  Filter as FilterPanel,
  FilterActions,
  Detail as FilterDetails,
  Text as TextFilter,
  Choice as ChoiceFilter,
  Select as SelectFilter,
  MultiSelect as MultiChoiceFilter,
  Period as PeriodFilter,
  Keywords as KeywordFilter,
  Result as ListResult,
  Table as ResultTable,
  Total as ResultTotal,
  PageSize,
  SortSelect,
  Pagination,
  Actions as ListActions,
  BulkAction,
  BulkSelectAction,
  Download as ListDownload,
  Check as ListCheck,
};
