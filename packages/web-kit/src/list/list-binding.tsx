// 파일 책임: 목록 상태 전달과 필터·일괄 실행의 화면 연결을 제공한다.
import { useVirtualizer } from '@tanstack/react-virtual';
import { activateTableRow } from './row-activation';
import { useQuery } from '@tanstack/react-query';
import type { DownloadBlock, DownloadKind, DownloadState } from './list-download';
import { calendarDate, commitFilterSelection, shiftCalendarDate, viewFilterSelection, type Keyword, type PeriodPreset } from '../search/interactions';
import { normalizeChoiceValue, type ChoiceNode, type ChoiceValue } from '../choice-binding';
import { sameSearchValue } from '../search/fields';
import { treeLeaves } from '../checkbox-tree';
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode, type FormEvent, type KeyboardEvent, type MouseEvent, type RefObject } from 'react';
import type { FieldCheck, ViewKeys } from '../search/fields';
import type { SearchMeta, SearchMetaEntry } from '../search/list-search';
import type { DraftIssue, KeywordInput, ListStatus } from './use-list';
import { useVisit, type ActionDescription } from '../lifetime';
import { filterFieldKeys, isFieldFiltered } from './filtered';

/** 기본 UI가 읽는 목록 상태(useList 결과와 같은 모양). */
export interface ListModel<Row = any, D extends object = any> {
  /** 확정 조건: 주소 검색값을 기본값으로 채운 값(주소 키별). */
  readonly criteria: Readonly<Record<string, unknown>>;
  readonly defaults: Readonly<Record<string, unknown>>;
  readonly view: ViewKeys;
  /** listSearch 선언의 칸 종류 정보(defineSearch로 선언했으면 없다). */
  readonly meta?: SearchMeta;
  /** useList의 rowId·isRowSelectable. 표가 행 규칙을 다시 받지 않도록 낸다. */
  readonly rowId?: (row: Row) => string;
  readonly isRowSelectable?: (row: Row) => boolean;
  readonly draft: D;
  readonly draftSearch?: Readonly<Record<string, unknown>>;
  readonly issues: readonly DraftIssue[];
  readonly required?: (name: string) => boolean;
  readonly blockedReason?: string;
  readonly resetVersion?: number;
  readonly submitVersion?: number;
  readonly checks?: Readonly<Record<string, FieldCheck | undefined>>;
  readonly patchDraft: (patch: Partial<D>) => void;
  // 메서드 표기: 소비자 초안의 좁은 키 타입을 받아들이기 위해서다.
  keywordInput(name: keyof D & string, choices: readonly string[]): KeywordInput;
  readonly submit: () => void;
  readonly reset: () => void;
  readonly rows: readonly Row[];
  readonly total: number;
  readonly page: unknown;
  readonly isCurrent: boolean;
  readonly isFetching: boolean;
  readonly status: ListStatus;
  readonly failure: unknown;
  readonly refresh: () => void;
  readonly goToPage: (page: number) => void;
  readonly setSize: (size: number) => void;
  readonly setSort: (sort: string, order: 'asc' | 'desc') => void;
  readonly toggleSort: (sort: string) => void;
  readonly selection: {
    readonly selectedIds: readonly string[];
    readonly isRunning: boolean;
    /** 결과 불확실 쓰기. recover로 재조회에 성공할 때까지 재실행을 막는다. */
    readonly failure?: unknown;
    readonly isRecovering?: boolean;
    readonly recover?: () => Promise<boolean>;
    readonly isAllChecked: boolean;
    readonly isMixed: boolean;
    readonly canSelect: (id: string) => boolean;
    readonly isChecked: (id: string) => boolean;
    readonly toggleRow: (id: string, on: boolean) => void;
    readonly togglePage: (on: boolean) => void;
    /** description: 무슨 작업인지. 화면을 떠난 뒤 실패하면 앱 알림에 실린다(lifetime ActionDescription). */
    readonly run: <T extends { readonly completedIds: readonly string[] }>(
      action: (ids: readonly string[]) => Promise<T>,
      description?: ActionDescription,
    ) => Promise<T | undefined>;
  };
}


const ListContext = createContext<ListModel | undefined>(undefined);

/**
 * 화면 부품이 칸 이름으로 선언 정보를 읽는다. 이름이 없거나 종류가 다르면 조용히 무시하지 않고 오류를 낸다.
 * name을 생략하면 그 종류의 칸 하나(페이지·정렬)를 찾는다.
 */
export function listFieldMeta<K extends SearchMetaEntry['kind']>(model: ListModel, kind: K, name?: string): Extract<SearchMetaEntry, { kind: K }> {
  const meta = model.meta ?? {};
  const entry = name === undefined ? Object.values(meta).find((item) => item.kind === kind) : meta[name];
  if (entry === undefined || entry.kind !== kind)
    throw new Error(name === undefined ? `list: no ${kind} field is declared with listSearch` : `list: "${name}" is not a ${kind} field of this listSearch`);
  return entry as Extract<SearchMetaEntry, { kind: K }>;
}
/** 목록 모델만 전달하며 표시 설정은 포함하지 않는다. */
export function ListProvider({ model, children }: { readonly model: ListModel; readonly children: ReactNode }) {
  return <ListContext.Provider value={model}>{children}</ListContext.Provider>;
}
/** 명시 모델을 우선하고 없으면 가장 가까운 목록을 읽는다. */
export function useListModel<Row = unknown, D extends object = Record<string, unknown>>(explicit?: ListModel<Row, D>): ListModel<Row, D> {
  const model = useContext(ListContext);
  const result = explicit ?? model;
  if (result === undefined) throw new Error('List parts require a model prop or <ListProvider model>');
  return result as ListModel<Row, D>;
}
/** 목록 칸의 값·필수·오류와 빈 문자열 정규화를 한 곳에서 연결한다. */
export function useListField<T = unknown>(name: string, searchName: string = name, explicit?: ListModel) {
  const model = useListModel(explicit);
  return {
    required: model.required?.(searchName) ?? false,
    value: (model.draft as Record<string, unknown>)[name] as T,
    set: (value: T) => model.patchDraft({ [name]: value }),
    setText: (value: string) => model.patchDraft({ [name]: value === '' && model.defaults[name] === undefined ? undefined : value }),
    issues: model.issues.filter((issue) => issue.field === name || issue.field === searchName),
  };
}
/** 검색 제출의 브라우저 기본 동작을 막고 목록 확정으로 연결한다. */
export function useListFilterBinding(model: ListModel) {
  return { noValidate: true, onSubmit: (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); model.submit(); } };
}

/**
 * 검색 확정·초기화·검증 사건에 맞춰 상세 필터를 펼친다. names는 접힌 칸의 이름(다른 부품의 name)이다.
 * 처음에는 닫히고, 그 칸들의 확정 조건에 걸러 내는 값이 있으면(빈 결과의 filtered와 같은 칸 규칙, 기간 기준만 있으면 아님) 펼친 채 시작한다.
 * 선언에 없는 이름·페이지·정렬·기간의 주소 키는 칸 이름이 아니라 오류다.
 */
export function useListDetailsBinding(model: ListModel, names: readonly string[]) {
  const keys = names.flatMap((name) => filterFieldKeys(model, name));
  const invalid = keys.some((key) => model.issues.some((issue) => issue.field === key));
  const signature = JSON.stringify([keys.map((key) => model.criteria[key]), model.resetVersion]);
  const active = names.some((name) => isFieldFiltered(model, name, model.criteria));
  const [open, setOpen] = useState(active);
  const [seen, setSeen] = useState(signature);
  const id = useId();
  const validation = model.submitVersion ?? JSON.stringify(model.issues);
  const [seenValidation, setSeenValidation] = useState(validation);
  if (seenValidation !== validation) {
    setSeenValidation(validation);
    if (invalid) setOpen(true);
  }
  if (signature !== seen) {
    setSeen(signature);
    setOpen(active || invalid);
  }
  return { open, id, toggle: () => setOpen(!open) };
}

/** 일괄 작업을 요청 없이 거절한 이유. 고른 행이 없거나(no-selection) 업무가 거절했다(refused, message는 refusalReason이 돌려준 사유). */
export type BulkRefusal = { readonly reason: 'no-selection' } | { readonly reason: 'refused'; readonly message: string };

/** 업무 실행(run)이 돌려주는 값. completedIds는 실제로 처리된 행, details는 화면에 보일 업무 결과(실패 사유 등)다. */
export interface BulkRunResult<T = unknown> {
  readonly completedIds: readonly string[];
  readonly details?: T;
}

/** 일괄 작업 결과(onCompleted·결과 창이 받는 값). requestedIds는 확인창에 고정해 요청한 행이다. */
export interface BulkResult<T = unknown> extends BulkRunResult<T> {
  readonly requestedIds: readonly string[];
}

/**
 * 확인 당시 결과·선택을 고정하고 실행 직전 검증과 단일 실행을 보장한다.
 * 상태만 값으로 돌려주고 보이는 방식(버튼 잠금·알림 창·문구)은 복사형 UI가 정한다.
 * - choice: 사용자가 고른 값(값을 골라 바꾸는 일괄 작업). 확인창을 여는 순간 고정해 refusalReason·run에 넘긴다.
 * - locked: 지금은 어떤 경우에도 실행할 수 없다(이전 결과 표시 중·실행 중·반영 여부 확인 필요).
 * - unavailable: 눌러도 요청 없이 거절될 이유(고른 행 없음). 잠글지, 눌렀을 때 refusal로 알릴지는 UI가 고른다.
 * - refusal: open·confirm이 요청 없이 거절한 이유(업무 거절 사유 포함). failure: 실행 뒤 실패.
 * 열린 확인·거절·실패 안내는 그 방문의 것이다. 방문이 바뀌면(lifetime.ts) 닫는다.
 * onCompleted는 실행 결과가 이 화면에 전달될 때만 부른다(부분 결과 안내 등). 실행 중 방문이 바뀌었으면 부르지 않는다.
 */
export function useBulkConfirmation<T, V = undefined>({ model, run, refusalReason, choice, onCompleted }: {
  model: ListModel;
  run: (ids: readonly string[], choice?: V) => Promise<BulkRunResult<T>>;
  /** 업무상 거절 사유. 있으면 실행하지 않는다. 여는 순간은 지금 고른 값, 실행 직전은 확인창에 고정한 값으로 묻는다. */
  refusalReason?: (ids: readonly string[], choice?: V) => string | undefined;
  choice?: V;
  onCompleted?: (result: BulkResult<T>) => void;
}) {
  const [pending, setPending] = useState<{ ids: readonly string[]; page: unknown; choice?: V }>();
  const [failure, setFailure] = useState<unknown>();
  const [refusal, setRefusal] = useState<BulkRefusal>();
  const running = useRef(false);
  const current = useRef(model);
  current.current = model;
  const visit = useVisit();
  const [seenVisit, setSeenVisit] = useState(visit);
  if (seenVisit !== visit) {
    setSeenVisit(visit);
    setPending(undefined);
    setFailure(undefined);
    setRefusal(undefined);
  }
  const stale = (snapshot: { ids: readonly string[]; page: unknown }, now: ListModel) =>
    snapshot.page !== now.page ||
    JSON.stringify(snapshot.ids) !== JSON.stringify(now.selection.selectedIds) ||
    !now.isCurrent ||
    snapshot.ids.some((id) => !now.selection.canSelect(id));
  if (!running.current && model.selection.failure === undefined && pending !== undefined && stale(pending, model)) setPending(undefined);
  const checked = (ids: readonly string[], input: V | undefined): BulkRefusal | undefined => {
    const message = input === undefined ? refusalReason?.(ids) : refusalReason?.(ids, input);
    return message ? { reason: 'refused', message } : undefined;
  };

  /** 마지막 순간에도 결과·선택 snapshot과 업무 조건을 다시 확인한다. */
  /** description: 무슨 작업인지(일괄 작업 이름·실패 문구). 화면을 떠난 뒤 실패하면 앱 알림에 실린다. */
  async function confirm(description?: ActionDescription) {
    if (running.current || pending === undefined || current.current.selection.failure !== undefined) return;
    const now = current.current;
    if (stale(pending, now)) {
      setPending(undefined);
      return;
    }
    const refused = checked(pending.ids, pending.choice);
    if (refused) {
      setRefusal(refused);
      return;
    }
    running.current = true;
    setFailure(undefined);
    try {
      const result = await now.selection.run(
        (ids) => (pending.choice === undefined ? run(ids) : run(ids, pending.choice)),
        description,
      );
      if (result !== undefined)
        onCompleted?.({ requestedIds: pending.ids, completedIds: result.completedIds, details: result.details });
      setPending(undefined);
    } catch (caught) {
      setFailure(caught);
    } finally {
      running.current = false;
    }
  }
  const locked = !model.isCurrent || model.selection.failure !== undefined || model.selection.isRunning;
  return { pending, failure: model.selection.failure ?? failure, refusal, confirm,
    recovery: model.selection.failure === undefined ? undefined : {
      pending: model.selection.isRecovering === true,
      run: async () => {
        const recovered = await current.current.selection.recover?.();
        if (recovered) { setPending(undefined); setFailure(undefined); }
      },
    },
    locked,
    unavailable: model.selection.selectedIds.length === 0 ? ('no-selection' as const) : undefined,
    open: () => {
      if (running.current || locked) return;
      if (model.selection.selectedIds.length === 0) {
        setRefusal({ reason: 'no-selection' });
        return;
      }
      const refused = checked(model.selection.selectedIds, choice);
      setRefusal(refused);
      setFailure(undefined);
      if (!refused) setPending({ ids: [...model.selection.selectedIds], page: model.page, choice });
    },
    cancel: () => { if (!running.current && !current.current.selection.isRecovering) setPending(undefined); },
    /** 거절·실패 안내를 확인했다. 안내를 지우고, 실행 중이 아니면 열려 있던 확인도 닫는다. */
    dismiss: () => {
      setRefusal(undefined);
      setFailure(undefined);
      if (!running.current && !current.current.selection.isRecovering) setPending(undefined);
    },
  };
}

/** 선택지 조회를 검색 정의의 부모 값과 동일한 조건으로 연결한다. */
export function useListChoiceBinding(model: ListModel, searchName: string, nodes?: readonly ChoiceNode[], serverSearch = false) {
  const id = useId();
  const check = model.checks?.[searchName];
  const parents = Object.fromEntries((check?.parents ?? []).map((parent) => [parent, (model.draftSearch ?? model.draft as Record<string, unknown>)[parent]]));
  const options = useQuery(check === undefined ? { queryKey: ['web-kit-no-options', id], enabled: false, queryFn: () => [] } : check.options(parents));
  const choices = nodes ?? (options.data === undefined ? [] : check?.tree?.(options.data) ?? []);
  // 값 정리(트리 밖 값 제거)는 전체 선택지가 준비됐을 때만 한다: 서버 검색이 아니고, 조회 중·실패가 아니다.
  const optionsReady = check === undefined ? nodes !== undefined : options.isSuccess && !options.isFetching && !options.isError;
  const ready = !serverSearch && optionsReady ? choices : undefined;
  return { check, options, choices, ready };
}

/**
 * 목록 필터의 다중 선택 값 규칙: 비면 제한 없음이라 전체가 체크로 보이고, 모두 고르면 다시 비운다.
 * 아무것도 체크되지 않은 상태는 없다: 마지막 하나를 해제하거나 전체를 지우는 변경은 무시한다.
 * 단일·서버 검색(선택지 전체를 모름)·필수 칸은 값을 그대로 쓴다.
 */
export function listChoiceValue(choices: readonly ChoiceNode[], rule: { readonly multiple?: boolean; readonly search?: unknown; readonly required?: boolean }) {
  if (rule.multiple !== true || rule.search !== undefined || rule.required === true) {
    return { view: (value: ChoiceValue): ChoiceValue => value, commit: (next: ChoiceValue, _current: ChoiceValue): ChoiceValue => next };
  }
  const leaves = treeLeaves(choices);
  const asList = (value: ChoiceValue): readonly string[] => (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []);
  return {
    view: (value: ChoiceValue): ChoiceValue => viewFilterSelection(asList(value), leaves),
    commit: (next: ChoiceValue, current: ChoiceValue): ChoiceValue => commitFilterSelection(asList(next), asList(current), leaves),
  };
}

/** 제한 없음과 명시 선택을 목록 필터 규칙으로 정규화한다. */
export function useListMultiChoiceBinding(name: string, values: readonly string[], model?: ListModel) {
  const field = useListField<readonly string[]>(name, name, model);
  const selected = field.value ?? [];
  // 트리 선택(List.Choice)과 같은 규칙: 필수 칸은 값을 그대로, 아니면 빈 값=전체와 마지막 하나 유지.
  const rule = listChoiceValue(values.map((value) => ({ value, label: value })), { multiple: true, required: field.required });
  const effective = (rule.view(selected) as readonly string[]).filter((value) => values.includes(value));
  const set = (next: readonly string[]) => field.set(rule.commit(next, selected) as readonly string[]);
  return { effective, set, toggle: (value: string, on: boolean) => set(on ? [...effective, value] : effective.filter((item) => item !== value)) };
}

/** 기간 단축 하나. range를 주면 그 계산을, value를 주면 오늘에서 그만큼 이동한 쌍을 쓴다. */
export type PeriodShortcut =
  | { readonly label: string; readonly value: PeriodPreset }
  | { readonly label: string; readonly range: (today: string) => { readonly from?: string; readonly to?: string } };


/** 기간 입력과 단축의 시간대·현재 시각을 한 계산으로 연결한다. */
export function useListPeriodBinding(model: ListModel, from: string, to: string, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone, now: () => Date = () => new Date()) {
  const set = (range: { from?: string; to?: string }) => model.patchDraft({ [from]: range.from || undefined, [to]: range.to || undefined });
  /** 단축 하나가 지금 만드는 기간. 누른 순간과 선택 표시가 같은 계산을 쓴다. */
  const rangeOf = (preset: PeriodShortcut): { from?: string; to?: string } => {
    const today = calendarDate(now(), timeZone);
    if ('range' in preset) return preset.range(today);
    const other = shiftCalendarDate(today, preset.value);
    return other < today ? { from: other, to: today } : { from: today, to: other };
  };
  return { set, rangeOf };
}

const WINDOW = 5;
/** 지금 페이지 주변 번호들. 처음·끝 페이지는 항상 보인다. */
function pageWindow(page: number, last: number): readonly number[] {
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), last - WINDOW + 1));
  const pages = new Set([1, last]);
  for (let current = start; current < start + WINDOW && current <= last; current += 1) pages.add(current);
  return [...pages].sort((a, b) => a - b);
}


/** 페이지 번호의 끝 경계와 현재 페이지를 계산한다. */
export function listPaginationBinding(model: ListModel) {
  const size = Math.max(1, Number(model.criteria[model.view.size]) || 1);
  const last = Math.max(1, Math.ceil(model.total / size));
  const page = Math.min(Math.max(Number(model.criteria[model.view.page]) || 1, 1), last);
  return { page, last, pages: pageWindow(page, last), visible: last > 1 && model.rows.length > 0 };
}

/** Download가 읽는 다운로드 흐름(useListDownload 결과). */
export interface DownloadControl {
  readonly state: DownloadState;
  readonly blockOf: (kind: DownloadKind) => DownloadBlock | undefined;
  readonly start: (kind: DownloadKind) => Promise<boolean>;
  readonly clear: () => void;
}


/** 다운로드를 시작하지 않고 거절한 이유. 종류를 고르지 않았거나(no-kind) 선택 다운로드인데 고른 행이 없다(no-selection). */
export type DownloadRefusal = 'no-kind' | 'no-selection';

/**
 * 다운로드 종류 선택과 실행 버튼의 연결. 상태만 값으로 돌려주고 보이는 방식은 복사형 UI가 정한다.
 * - locked: 진행 중·이전 결과 표시 중이라 지금은 시작할 수 없다.
 * - unavailable: 눌러도 요청 없이 거절될 이유(종류 없음·선택 행 없음). 잠글지, 눌렀을 때 refusal로 알릴지는 UI가 고른다.
 * - refusal: start가 요청 없이 거절한 이유(dismiss로 지운다). 거절 안내는 그 방문의 것이라 방문이 바뀌면(lifetime.ts) 지운다.
 */
export function useListDownloadBinding(control: DownloadControl, kinds: readonly DownloadKind[]) {
  const [kind, setKind] = useState<DownloadKind | ''>('');
  const [refusal, setRefusal] = useState<DownloadRefusal>();
  const visit = useVisit();
  const [seenVisit, setSeenVisit] = useState(visit);
  if (seenVisit !== visit) {
    setSeenVisit(visit);
    setRefusal(undefined);
  }
  // 종류를 고르기 전에도 진행 중·이전 결과 표시 중인지는 알아야 해서 '전체' 기준으로 묻는다.
  const block = control.blockOf(kind === '' ? 'all' : kind);
  const locked = block === 'running' || block === 'stale';
  const unavailable: DownloadRefusal | undefined = kind === '' ? 'no-kind' : block === 'no-selection' ? 'no-selection' : undefined;
  return { kind, refusal, locked, unavailable,
    change: (value: string) => {
      control.clear();
      setRefusal(undefined);
      setKind(kinds.find((kind) => kind === value) ?? '');
    },
    start: () => {
      if (locked) return;
      if (unavailable !== undefined) setRefusal(unavailable);
      else if (kind !== '' && block === undefined) void control.start(kind);
    },
    dismiss: () => setRefusal(undefined),
  };
}

/** 키워드의 값·추가·검색 동작을 제공하고 키 연결은 복사형 UI에 맡긴다. */
export function useListKeywordBinding(model: ListModel, name: string, choices: readonly string[]) {
  const input = model.keywordInput(name, choices);
  const items = ((model.draft as Record<string, unknown>)[name] as readonly Keyword[] | undefined) ?? [];
  return { input, items,
    submit: model.submit,
    remove: (index: number) => model.patchDraft({ [name]: items.filter((_, i) => i !== index) }),
  };
}
/** 최신 결과 여부와 페이지 크기·같은 정렬 키의 입력 처리를 연결한다. */
export function listViewBinding(model: ListModel) {
  const shown = model.status.kind === 'rows' || model.status.kind === 'empty' || (model.status.kind === 'pending' && model.rows.length > 0);
  const sortKey = model.criteria[model.view.sort];
  const sort = String(sortKey ?? '');
  return {
    sortKey, sort, order: model.criteria[model.view.order] === 'asc' ? 'asc' as const : 'desc' as const,
    locked: !model.isCurrent || model.selection.isRunning || model.selection.failure !== undefined,
    total: !shown ? 0 : model.isCurrent ? model.total : undefined,
    size: Number(model.criteria[model.view.size]),
    setSize: (value: string) => model.setSize(Number(value)),
    setSort: (value: string) => { if (value !== sort) model.toggleSort(value); },
  };
}
/** 행 안 조작은 행 활성화를 일으키지 않고 행 자체의 Enter만 활성화한다. */
export function listRowBinding(model: ListModel, id: string, activate?: () => void) {
  const onActivate = (event: MouseEvent | KeyboardEvent) => activateTableRow(event, activate, {
    keys: ['Enter'], interactiveSelector: 'a,button,input,select,textarea,label,[role="button"],[role="checkbox"]',
  });
  return { onClick: onActivate, onKeyDown: onActivate,
    checked: model.selection.isChecked(id),
    disabled: !model.isCurrent || model.selection.isRunning || !model.selection.canSelect(id),
    toggle: (on: boolean) => model.selection.toggleRow(id, on),
  };
}

/** 가상 목록의 측정과 앞뒤 빈 높이를 라이브러리 계산에 연결한다. */
export function useListVirtualRows<Row>(rows: readonly Row[], rowId: (row: Row) => string, viewport: RefObject<HTMLDivElement | null>) {
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewport.current,
    estimateSize: () => 41,
    // 행 높이가 바뀌는 관찰 콜백 안에서 다시 측정·배치하는 순환을 피한다.
    useAnimationFrameWithResizeObserver: true,
    overscan: 8,
    getItemKey: (index) => (rows[index] === undefined ? index : rowId(rows[index]!)),
    initialRect: { width: 1, height: 576 },
  });
  const items = virtualizer.getVirtualItems();
  const leading = items[0]?.start ?? 0;
  const trailing = Math.max(0, virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0));
  return { items, leading, trailing, measureElement: virtualizer.measureElement };
}

/** 준비된 전체 선택지에 없는 초안 값만 정리한다. URL 복구는 기존 check가 맡는다. */
export function useListChoiceNormalization(model: ListModel, name: string, nodes: readonly ChoiceNode[] | undefined) {
  const value = (model.draft as Record<string, unknown>)[name] as ChoiceValue;
  const signature = JSON.stringify([value, nodes]);
  useEffect(() => {
    if (nodes === undefined) return;
    const next = normalizeChoiceValue(value, nodes);
    if (!sameSearchValue(value, next)) model.patchDraft({ [name]: next });
  }, [signature]);
}
