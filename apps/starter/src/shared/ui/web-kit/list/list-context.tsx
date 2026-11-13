// 파일 책임: 목록 표시 설정의 단일 Context와 여러 목록 영역이 함께 쓰는 기본 UI.
import { ListProvider as ModelProvider, useListModel, type ListModel } from '@boosterlab/web-kit/list';
import { createContext, useContext, type ReactNode } from 'react';
import { MixedCheckbox } from '../ui/choice';
import { SelectBox } from '../select-box';


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

export { defaultMessages, useListContext, ListRoot, Check, labelled, OptionSelect };
export type { Context };
