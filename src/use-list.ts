// 파일 책임: 목록 화면 하나의 검색 초안·확정, 선택지 확인, 조회 상태, 이전 결과, 행 선택·일괄 작업 수명을 소유한다.
import { useQueries, useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { isRequestFailure } from './failure';
import {
  sameSearchValue,
  type FullSearch,
  type SearchDefinition,
  type SearchField,
  type UrlSearch,
} from './search/fields';

type AnyFields = Record<string, SearchField<any>>;

/** 조회 함수가 돌려주는 한 페이지. */
export interface ListPage<TRow> {
  readonly rows: readonly TRow[];
  readonly total: number;
}

/** 확정을 막는 직접 입력 오류. 문구는 화면이 code로 고른다. */
export interface DraftIssue {
  readonly field: string;
  readonly code: string;
}

/** 목록의 조회 상태. idle은 "조회 안 함" 하나이고 reason과 재개 수단을 함께 준다. */
export type ListStatus =
  | { readonly kind: 'idle'; readonly reason: 'not-searched' | 'cancelled'; readonly resume: () => void }
  /** 화면이 준 조회 조건(enabled: false)이 아직 충족되지 않았다. 재개는 그 조건이 맡는다. */
  | { readonly kind: 'idle'; readonly reason: 'not-ready' }
  | {
      readonly kind: 'idle';
      readonly reason: 'check-failed';
      readonly fields: readonly string[];
      readonly failure: unknown;
      readonly resume: () => void;
    }
  | { readonly kind: 'idle'; readonly reason: 'check-stuck'; readonly fields: readonly string[]; readonly resume: () => void }
  | { readonly kind: 'pending' }
  | { readonly kind: 'failed'; readonly failure: unknown; readonly retry: () => void }
  | { readonly kind: 'empty' }
  | { readonly kind: 'rows' };

/** URL과 모양이 다른 입력 초안(기간 preset 등)의 변환. from은 확정 검색 → 초안, to는 초안 → 확정할 필터 값. */
export interface DraftCodec<F extends AnyFields, D> {
  readonly from: (search: FullSearch<F>) => D;
  readonly to: (draft: D) => Partial<FullSearch<F>>;
}

export interface ListOptions<
  F extends AnyFields,
  TRow,
  TError = Error,
  TKey extends QueryKey = QueryKey,
  D = FullSearch<F>,
  TPage extends ListPage<TRow> = ListPage<TRow>,
> {
  readonly definition: SearchDefinition<F>;
  /** route가 검증한 현재 URL 값(Route.useSearch(), 정규 URL 표현). 값으로 읽는 일은 목록이 한다. */
  readonly search: UrlSearch;
  /** URL 이동. 값은 정규 URL(encode 적용 뒤)이다. 확정은 push, 복구는 replace로 부른다. */
  readonly navigate: (next: UrlSearch, options: { readonly replace: boolean }) => void;
  /**
   * 확정 검색 → 조회 옵션(TanStack queryOptions() 결과 그대로). enabled는 화면의 추가 조건이며 목록 조건과 함께 지킨다.
   * boolean false일 때만 상태가 not-ready다(함수형 enabled는 조회에는 적용되지만 상태로는 구별하지 않는다).
   */
  readonly query: (search: FullSearch<F>) => UseQueryOptions<TPage & ListPage<TRow>, TError, TPage & ListPage<TRow>, TKey>;
  readonly rowId: (row: TRow) => string;
  /** 업무상 선택할 수 없는 행을 거른다. 없으면 모두 선택 가능. */
  readonly selectable?: (row: TRow) => boolean;
  /** 초안 모양이 URL 값과 다를 때만 선언한다. 없으면 초안은 검색 값 그대로다. */
  readonly draft?: DraftCodec<F, D>;
  /** 검색 확정 직전의 직접 입력 검증(역순 기간 등). 초안 모양을 받는다. */
  readonly validateDraft?: (draft: NoInfer<D>) => readonly DraftIssue[];
}

/** 선택지 확인 하나의 판정. kept는 배열 값 중 선택지에 있는 항목이다. */
type Judged = {
  readonly field: string;
  readonly key: string;
  readonly status: 'running' | 'valid' | 'invalid' | 'failed';
  readonly failure?: unknown;
  readonly refetch?: () => Promise<unknown>;
  readonly kept?: readonly unknown[];
};

/** 확인할 값이 없는(빈) 필드는 확인하지 않는다. */
function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

/**
 * 목록 하나를 소유한다. 조회는 모든 선택지 확인이 유효로 정착한 현재 URL 조건에서만 한다.
 * 현재 조건의 결과가 아닌 행은 읽기용으로만 내고 선택·일괄 작업 대상으로 내보내지 않는다.
 */
export function useList<
  F extends AnyFields,
  TRow,
  TError = Error,
  TKey extends QueryKey = QueryKey,
  D = FullSearch<F>,
  TPage extends ListPage<TRow> = ListPage<TRow>,
>(options: ListOptions<F, TRow, TError, TKey, D, TPage>) {
  const { definition } = options;
  const latest = useRef(options);
  latest.current = options;
  const full = definition.resolve(definition.read(options.search));
  const current = definition.canonical(full);
  const urlKey = JSON.stringify(current);
  const values = full as Record<string, unknown>;
  // 보기 값(page·size·sort·order)을 뺀 필터 부분. 초안 수명은 이것을 따른다.
  const viewKeys: readonly string[] = Object.values(definition.view);
  const filterOf = (value: Readonly<Record<string, unknown>>) =>
    Object.fromEntries(Object.entries(value).filter(([key]) => !viewKeys.includes(key)));
  const filterKey = JSON.stringify(filterOf(current));
  const codec = (options.draft ?? {
    from: (search: FullSearch<F>) => search,
    to: (draft: FullSearch<F>) => filterOf(draft),
  }) as DraftCodec<F, D>;

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // ── 선택지 확인 ──
  // 확인은 필터 UI와 같은 선택지 query의 observer다. 선택지가 도착하면(필터 쪽 재시도 포함) 그 자리에서 판정한다.
  const checked = Object.entries(definition.fields).flatMap(([field, spec]) => {
    if (spec.check === undefined || isEmpty(values[field])) return [];
    const parents = Object.fromEntries((spec.check.parents ?? []).map((name) => [name, values[name]]));
    return [{ field, check: spec.check, parents, key: JSON.stringify([field, values[field], parents]) }];
  });
  const optionResults = useQueries({ queries: checked.map((item) => item.check.options(item.parents) as UseQueryOptions) });
  const judged: readonly Judged[] = checked.map((item, index) => {
    const result = optionResults[index]!;
    if (result.data === undefined)
      return { field: item.field, key: item.key, status: result.isError ? 'failed' : 'running', failure: result.error, refetch: result.refetch };
    const allowed = item.check.allowed(result.data);
    const listed = (one: unknown) => allowed.some((option) => sameSearchValue(option, one));
    const value = values[item.field];
    // 배열은 선택지에 있는 항목만 남긴다(고정 목록의 항목 복구와 같은 규칙). 남는 항목이 없으면 기본값이다.
    const kept = Array.isArray(value) ? value.filter(listed) : listed(value) ? [value] : [];
    const valid = Array.isArray(value) ? kept.length === value.length : kept.length === 1;
    return { field: item.field, key: item.key, status: valid ? 'valid' : 'invalid', kept: Array.isArray(value) ? kept : undefined };
  });
  const [, setRetryTick] = useState(0);
  const recovered = useRef(new Set<string>());
  const lastRecovery = useRef<string | undefined>(undefined);
  const running = judged.some((item) => item.status === 'running');
  const failed = judged.filter((item) => item.status === 'failed');
  const invalid = judged.filter((item) => item.status === 'invalid');
  const stuck = invalid.filter(
    (item) => sameSearchValue(values[item.field], definition.fields[item.field]!.default) || recovered.current.has(item.key),
  );
  const allValid = !running && failed.length === 0 && invalid.length === 0;

  /** 무효 필드만 고쳐 replace 한 번. 배열은 남은 항목으로, 남은 항목이 없거나 단일 값이면 그 필드와 묶음을 기본값으로. 정착한 뒤에만 한다. */
  useEffect(() => {
    if (running || invalid.length === 0 || stuck.length > 0) return;
    const recovery = invalid.map((item) => item.key).join('|');
    if (lastRecovery.current === recovery) return;
    lastRecovery.current = recovery;
    const { definition: def } = latest.current;
    const next: Record<string, unknown> = { ...values };
    for (const item of invalid) {
      recovered.current.add(item.key);
      if (item.kept !== undefined && item.kept.length > 0) {
        next[item.field] = item.kept;
        continue;
      }
      const members = def.groups.find((group) => group.fields.includes(item.field))?.fields ?? [item.field];
      for (const name of members) next[name] = def.fields[name]!.default;
    }
    latest.current.navigate(def.canonical(next as FullSearch<F>), { replace: true });
  });

  /** 실패한 선택지를 다시 받고, 멈춘 복구를 다시 허용한다. */
  function retryChecks() {
    recovered.current.clear();
    lastRecovery.current = undefined;
    for (const item of failed) void item.refetch?.();
    setRetryTick((tick) => tick + 1);
  }

  // ── 조회 ──
  const screenQuery = options.query(full);
  const screenEnabled = screenQuery.enabled;
  const ready = screenEnabled !== false;
  const own = full.searched && allValid;
  const enabled = own && ready;
  const query = useQuery({
    ...screenQuery,
    enabled: typeof screenEnabled === 'function' ? (current) => own && screenEnabled(current) : enabled,
  });
  const previous = useRef<TPage | undefined>(undefined);
  const isCurrent = enabled && query.data !== undefined;
  if (isCurrent) previous.current = query.data;
  const page = isCurrent ? query.data : previous.current;
  const rows = page?.rows ?? [];
  const cancelled = isRequestFailure(query.error) && query.error.kind === 'cancelled';
  // 같은 조건 재조회·refresh는 진행 중인 요청이 있으면 그것에 합류한다(취소하고 다시 보내지 않는다).
  const refetch = () => void query.refetch({ cancelRefetch: false });

  // ── 초안과 확정 ──
  const [draftState, setDraftState] = useState(() => ({ key: filterKey, draft: codec.from(full), issues: [] as readonly DraftIssue[] }));
  const draftCurrent = draftState.key === filterKey ? draftState : { key: filterKey, draft: codec.from(full), issues: [] };
  if (draftCurrent !== draftState) setDraftState(draftCurrent);
  // 같은 이벤트 안의 patchDraft → submit도 최신 초안을 보게 한다.
  const draftLatest = useRef(draftCurrent);
  draftLatest.current = draftCurrent;
  function setDraft(next: typeof draftCurrent) {
    draftLatest.current = next;
    setDraftState(next);
  }

  /** 같은 조건이면 다시 조회, 다르면 URL push. */
  function commit(next: FullSearch<F>) {
    recovered.current.clear();
    lastRecovery.current = undefined;
    const sparse = definition.canonical(next);
    if (sameSearchValue(sparse, current)) {
      if (enabled) refetch();
      else retryChecks();
      return;
    }
    latest.current.navigate(sparse, { replace: false });
  }

  const keys = definition.view;
  const firstPage = () => (keys.page in definition.fields ? { [keys.page]: definition.fields[keys.page]!.default } : {});

  /** 초안을 검증하고 첫 페이지로 확정한다. 보기 상태(size·sort·order)는 초안에 든 값 그대로다. */
  function submit() {
    const draft = draftLatest.current;
    const issues = latest.current.validateDraft?.(draft.draft) ?? [];
    setDraft({ ...draft, issues });
    if (issues.length > 0) return;
    commit({ ...full, ...codec.to(draft.draft), ...firstPage(), searched: true });
  }

  // ── 선택 ──
  const selectable = options.selectable ?? (() => true);
  const allowed = isCurrent ? rows.filter(selectable).map(options.rowId) : [];
  const sourceKey = JSON.stringify(allowed);
  const [selection, setSelection] = useState(() => ({ lifetime: urlKey, sourceKey, selected: new Set<string>() }));
  let selectionCurrent = selection;
  if (selection.lifetime !== urlKey) selectionCurrent = { lifetime: urlKey, sourceKey, selected: new Set() };
  else if (isCurrent && selection.sourceKey !== sourceKey)
    selectionCurrent = { lifetime: urlKey, sourceKey, selected: new Set([...selection.selected].filter((id) => allowed.includes(id))) };
  if (selectionCurrent !== selection) setSelection(selectionCurrent);
  const selectedIds = isCurrent ? [...selectionCurrent.selected] : [];
  const [runningAction, setRunningAction] = useState(false);
  const actionLock = useRef(false);

  /** 현재 조건의 선택 가능한 행에만 반영한다. */
  function toggle(ids: readonly string[], on: boolean) {
    setSelection((prev) => {
      if (prev.lifetime !== urlKey) return prev;
      const next = new Set(prev.selected);
      for (const id of ids) {
        if (!allowed.includes(id)) continue;
        if (on) next.add(id);
        else next.delete(id);
      }
      return { ...prev, selected: next };
    });
  }

  /** 시작 순간의 선택 ID로 실행하고, 같은 선택 수명일 때만 성공 뒤 선택을 비운다. */
  async function run<T>(action: (ids: readonly string[]) => Promise<T>): Promise<T | undefined> {
    if (actionLock.current) return undefined;
    actionLock.current = true;
    setRunningAction(true);
    const ids = selectedIds;
    const lifetime = urlKey;
    try {
      const result = await action(ids);
      if (mounted.current)
        setSelection((prev) => (prev.lifetime === lifetime ? { ...prev, selected: new Set() } : prev));
      return result;
    } finally {
      actionLock.current = false;
      if (mounted.current) setRunningAction(false);
    }
  }

  // ── 상태 ──
  let status: ListStatus;
  if (!full.searched) status = { kind: 'idle', reason: 'not-searched', resume: submit };
  else if (stuck.length > 0)
    status = { kind: 'idle', reason: 'check-stuck', fields: stuck.map((item) => item.field), resume: retryChecks };
  else if (failed.length > 0)
    status = {
      kind: 'idle',
      reason: 'check-failed',
      fields: failed.map((item) => item.field),
      failure: failed[0]!.failure,
      resume: retryChecks,
    };
  else if (!allValid) status = { kind: 'pending' };
  else if (!ready && query.data === undefined) status = { kind: 'idle', reason: 'not-ready' };
  else if (query.data !== undefined) status = query.data.rows.length === 0 ? { kind: 'empty' } : { kind: 'rows' };
  else if (query.isError)
    status = cancelled ? { kind: 'idle', reason: 'cancelled', resume: refetch } : { kind: 'failed', failure: query.error, retry: refetch };
  else status = { kind: 'pending' };

  return {
    /** 현재 URL을 기본값으로 채운 확정 검색. */
    search: full,
    status,
    /** 보여 줄 행. isCurrent가 false면 이전 조건의 결과이며 읽기용이다. */
    rows,
    total: page?.total ?? 0,
    /** 보여 주는 행이 속한 응답 전체(목록 외 필드 포함). isCurrent가 false면 이전 조건의 응답이다. */
    page,
    isCurrent,
    /** 현재 조건 결과를 다시 읽는 중. */
    isFetching: query.isFetching,
    /** 현재 결과가 있는 상태의 재조회 실패(취소 제외). */
    failure: isCurrent && query.isError && !cancelled ? query.error : undefined,
    draft: draftCurrent.draft,
    issues: draftCurrent.issues,
    patchDraft: (patch: Partial<D>) =>
      setDraft({ ...draftLatest.current, draft: { ...draftLatest.current.draft, ...patch } }),
    submit,
    /** 선언한 기본값(첫 진입 상태)으로 되돌린다. */
    reset: () => {
      setDraft({ key: filterKey, draft: codec.from(definition.defaults), issues: [] });
      commit(definition.defaults);
    },
    /** 현재 조건을 다시 읽는다(결과가 있는 상태의 재조회 실패 뒤 다시 시도 등). */
    refresh: refetch,
    goToPage: (value: number) => commit({ ...full, [keys.page]: value }),
    setSize: (value: number) => commit({ ...full, ...firstPage(), [keys.size]: value }),
    setSort: (sort: string, order: 'asc' | 'desc') => commit({ ...full, ...firstPage(), [keys.sort]: sort, [keys.order]: order }),
    selection: {
      selectedIds,
      isChecked: (id: string) => selectedIds.includes(id),
      isAllChecked: allowed.length > 0 && selectedIds.length === allowed.length,
      isMixed: selectedIds.length > 0 && selectedIds.length < allowed.length,
      toggleRow: (id: string, on: boolean) => toggle([id], on),
      togglePage: (on: boolean) => toggle(allowed, on),
      clear: () => setSelection((prev) => ({ ...prev, selected: new Set() })),
      run,
      isRunning: runningAction,
    },
  };
}
