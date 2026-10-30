// 파일 책임: 목록 상태 전달과 필터·일괄 실행의 화면 연결을 제공한다.
import { useVirtualizer } from '@tanstack/react-virtual';
import { activateTableRow } from './row-activation';
import { useQuery } from '@tanstack/react-query';
import type { DownloadBlock, DownloadKind, DownloadState } from './list-download';
import { calendarDate, normalizeFilterSelection, shiftCalendarDate, type Keyword, type PeriodPreset } from './search/interactions';
import { normalizeChoiceValue, type ChoiceNode, type ChoiceValue } from './choice-binding';
import { sameSearchValue } from './search/fields';
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode, type FormEvent, type KeyboardEvent, type MouseEvent, type RefObject } from 'react';
import type { FieldCheck, ViewKeys } from './search/fields';
import type { DraftIssue, KeywordInput, ListStatus } from './use-list';

/** 기본 UI가 읽는 목록 상태(useList 결과와 같은 모양). */
export interface ListModel<Row = any, D extends object = any> {
  readonly search: Readonly<Record<string, unknown>>;
  readonly defaults: Readonly<Record<string, unknown>>;
  readonly view: ViewKeys;
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
    readonly isAllChecked: boolean;
    readonly isMixed: boolean;
    readonly canSelect: (id: string) => boolean;
    readonly isChecked: (id: string) => boolean;
    readonly toggleRow: (id: string, on: boolean) => void;
    readonly togglePage: (on: boolean) => void;
    readonly run: <T extends { readonly completedIds: readonly string[] }>(
      action: (ids: readonly string[]) => Promise<T>,
    ) => Promise<T | undefined>;
  };
}


const ListContext = createContext<ListModel | undefined>(undefined);
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

/** 검색 확정·초기화·검증 사건에 맞춰 상세 필터를 펼친다. */
export function useListDetailsBinding(model: ListModel, keys: readonly string[]) {
  const hasValue = (value: unknown) =>
    value !== undefined && value !== null && value !== '' && value !== false && (!Array.isArray(value) || value.length > 0);
  const invalid = keys.some((key) => model.issues.some((issue) => issue.field === key));
  const signature = JSON.stringify([keys.map((key) => model.search[key]), model.resetVersion]);
  const active = keys.some((key) => hasValue(model.search[key]));
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

/** 확인 당시 결과·선택을 고정하고 실행 직전 검증과 단일 실행을 보장한다. */
export function useBulkConfirmation<T>({ model, run, check }: { model: ListModel; run: (ids: readonly string[]) => Promise<{ completedIds: readonly string[]; value?: T }>; check?: (ids: readonly string[]) => string | undefined }) {
  const [pending, setPending] = useState<{ ids: readonly string[]; page: unknown }>();
  const [error, setError] = useState<unknown>();
  const running = useRef(false);
  const current = useRef(model);
  current.current = model;
  const stale = (snapshot: { ids: readonly string[]; page: unknown }, now: ListModel) =>
    snapshot.page !== now.page ||
    JSON.stringify(snapshot.ids) !== JSON.stringify(now.selection.selectedIds) ||
    !now.isCurrent ||
    snapshot.ids.some((id) => !now.selection.canSelect(id));
  if (!running.current && pending !== undefined && stale(pending, model)) setPending(undefined);

  /** 마지막 순간에도 결과·선택 snapshot과 업무 조건을 다시 확인한다. */
  async function confirm() {
    if (running.current || pending === undefined) return;
    const now = current.current;
    if (stale(pending, now)) {
      setPending(undefined);
      return;
    }
    const refusal = check?.(pending.ids);
    if (refusal) {
      setError(refusal);
      return;
    }
    running.current = true;
    setError(undefined);
    try {
      await now.selection.run(run);
      setPending(undefined);
    } catch (failure) {
      setError(failure);
    } finally {
      running.current = false;
    }
  }
  return { pending, error, confirm,
    locked: !model.isCurrent || model.selection.selectedIds.length === 0 || model.selection.isRunning,
    open: () => {
      const refusal = check?.(model.selection.selectedIds);
      setError(refusal);
      if (!refusal) setPending({ ids: [...model.selection.selectedIds], page: model.page });
    },
    cancel: () => { if (!running.current) setPending(undefined); },
  };
}

/** 선택지 조회를 검색 정의의 부모 값과 동일한 조건으로 연결한다. */
export function useListChoiceBinding(model: ListModel, searchName: string, nodes?: readonly ChoiceNode[]) {
  const id = useId();
  const check = model.checks?.[searchName];
  const parents = Object.fromEntries((check?.parents ?? []).map((parent) => [parent, (model.draftSearch ?? model.draft as Record<string, unknown>)[parent]]));
  const options = useQuery(check === undefined ? { queryKey: ['web-kit-no-options', id], enabled: false, queryFn: () => [] } : check.options(parents));
  const choices = nodes ?? (options.data === undefined ? [] : check?.tree?.(options.data) ?? []);
  return { check, options, choices };
}

/** 제한 없음과 명시 선택을 목록 필터 규칙으로 정규화한다. */
export function useListMultiChoiceBinding(name: string, values: readonly string[], model?: ListModel) {
  const field = useListField<readonly string[]>(name, name, model);
  const selected = field.value ?? [];
  const effective = selected.length === 0 ? values : selected.filter((value) => values.includes(value));
  const set = (next: readonly string[]) => field.set(normalizeFilterSelection(next, values));
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
  const size = Math.max(1, Number(model.search[model.view.size]) || 1);
  const last = Math.max(1, Math.ceil(model.total / size));
  const page = Math.min(Math.max(Number(model.search[model.view.page]) || 1, 1), last);
  return { page, last, pages: pageWindow(page, last), visible: last > 1 && model.rows.length > 0 };
}

/** Download가 읽는 다운로드 흐름(useListDownload 결과). */
export interface DownloadControl {
  readonly state: DownloadState;
  readonly blockOf: (kind: DownloadKind) => DownloadBlock | undefined;
  readonly start: (kind: DownloadKind) => Promise<boolean>;
  readonly clear: () => void;
}


/** 다운로드 종류 변경은 이전 실패를 지운 뒤 다음 선택을 반영한다. */
export function useListDownloadBinding(control: DownloadControl, kinds: readonly DownloadKind[]) {
  const [kind, setKind] = useState<DownloadKind | ''>('');
  return { kind, blocked: kind === '' || control.blockOf(kind) !== undefined,
    change: (value: string) => {
      control.clear();
      setKind(kinds.find((kind) => kind === value) ?? '');
    },
    start: () => { if (kind !== '') void control.start(kind); },
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
  const sortKey = model.search[model.view.sort];
  const sort = String(sortKey ?? '');
  return {
    sortKey, sort, order: model.search[model.view.order] === 'asc' ? 'asc' as const : 'desc' as const,
    locked: !model.isCurrent || model.selection.isRunning,
    total: !shown ? 0 : model.isCurrent ? model.total : undefined,
    size: Number(model.search[model.view.size]),
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
