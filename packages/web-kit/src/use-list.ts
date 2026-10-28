/** 목록의 확정 조건·초안·결과 출처·선택과 일괄 실행 수명을 소유한다. */
// 파일 책임: 목록 화면 하나의 검색 초안·확정(기간 검증·입력 중 키워드 포함), 선택지 확인, 조회 상태, 이전 결과, 정렬 전이,
// 행 선택·일괄 작업 수명을 소유한다. 화면 부품을 바꾸거나 숨겨도 검색 직전 보장이 남도록 UI가 아닌 여기서 한다.
import { useQueries, useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { isRequestFailure } from './failure';
import { useBlockingProgress } from './progress';
import { validateDateRange } from './search/date-range';
import { sameSearchValue, type FullSearch, type SearchDefinition, type SearchField, type UrlSearch } from './search/fields';
import { addKeyword, nextSort, type Keyword } from './search/interactions';

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
  /**
   * 'page'면 이 목록이 페이지 진입 조회다: 보여 줄 결과가 아직 없고 조회(주소 값 확인 조회 포함) 중인 동안 화면 전체 진행 덮개(`/ui` BlockingProgress)를 띄운다.
   * 검색·페이지 이동은 이전 결과를 보인 채 다시 조회하므로 덮지 않는다.
   */
  readonly progress?: 'page';
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
  /** 검색 확정 직전의 직접 입력 검증(제품의 기간 한도 등). 초안 모양을 받는다. */
  readonly validateDraft?: (draft: NoInfer<D>) => readonly DraftIssue[];
  /**
   * 직접 입력하는 기간 쌍 [시작 필드, 끝 필드](초안 키). 검색 직전 한쪽만·없는 날짜·역순이면 그 쌍만 기본값으로 돌리고
   * 나머지 조건으로 검색한다(주소의 잘못된 값과 같은 규칙). 입력 UI와 무관하게 지킨다.
   */
  readonly periods?: readonly (readonly [NoInfer<keyof D & string>, NoInfer<keyof D & string>])[];
}

/** 키워드 필드 하나의 입력 중 상태. 추가를 누르지 않아도 검색이 합친다. */
export interface KeywordInput {
  readonly choice: string;
  readonly text: string;
  readonly setChoice: (choice: string) => void;
  readonly setText: (text: string) => void;
  /** 입력 중 글자를 칩으로 추가한다(trim·같은 대상 중복 제거). */
  readonly add: () => void;
}

/** 입력 중 글자. 초안과 같은 수명이라 페이지·정렬 이동에는 남고 필터 교체·초기화에는 지워진다. */
type PendingKeywords = Readonly<Record<string, { readonly choice: string; readonly text: string }>>;

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
      return {
        field: item.field,
        key: item.key,
        status: result.isError ? 'failed' : 'running',
        failure: result.error,
        refetch: result.refetch,
      };
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
  const isCurrent = enabled && query.data !== undefined && !query.isPlaceholderData;
  if (isCurrent) previous.current = query.data;
  const page = isCurrent ? query.data : previous.current;
  const rows = page?.rows ?? [];
  const cancelled = isRequestFailure(query.error) && query.error.kind === 'cancelled';
  // 같은 조건 재조회·refresh는 진행 중인 요청이 있으면 그것에 합류한다(취소하고 다시 보내지 않는다).
  const refetch = () => void query.refetch({ cancelRefetch: false });

  // ── 초안과 확정 ──
  const fresh = () => ({ key: filterKey, draft: codec.from(full), issues: [] as readonly DraftIssue[], inputs: {} as PendingKeywords });
  const [draftState, setDraftState] = useState(fresh);
  const draftCurrent = draftState.key === filterKey ? draftState : fresh();
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

  /** 입력 중 키워드를 초안에 합친다. 대상이 없거나 빈 글자는 그대로 둔다. */
  function withInputs(state: typeof draftCurrent): typeof draftCurrent {
    let draft = state.draft as Record<string, unknown>;
    for (const [name, input] of Object.entries(state.inputs)) {
      if (input.text.trim() === '' || input.choice === '') continue;
      const items = Array.isArray(draft[name]) ? (draft[name] as readonly Keyword[]) : [];
      draft = { ...draft, [name]: addKeyword(items, input.choice, input.text) };
    }
    return { ...state, draft: draft as D, inputs: {} };
  }

  /** 맞지 않는 기간 쌍(한쪽만·없는 날짜·역순)을 기본값으로 돌린다. 주소의 잘못된 값처럼 그 쌍만 바뀐다. */
  function withValidPeriods(draft: D): D {
    const values = draft as Record<string, unknown>;
    let defaults: Record<string, unknown> | undefined;
    let next = values;
    for (const [from, to] of latest.current.periods ?? []) {
      if (validateDateRange(values[from] as string | undefined, values[to] as string | undefined) === undefined) continue;
      defaults ??= codec.from(definition.defaults) as Record<string, unknown>;
      next = { ...next, [from]: defaults[from], [to]: defaults[to] };
    }
    return next as D;
  }

  /** 입력 중 키워드를 합치고 기간을 정리·검증한 뒤 첫 페이지로 확정한다. 보기 상태(size·sort·order)는 지금 값 그대로다. */
  function submit() {
    const merged = withInputs(draftLatest.current);
    const draft = withValidPeriods(merged.draft);
    const issues = latest.current.validateDraft?.(draft) ?? [];
    setDraft({ ...merged, draft, issues });
    if (issues.length > 0) return;
    commit({ ...full, ...codec.to(draft), ...firstPage(), searched: true });
  }

  /** 키워드 필드 하나의 입력 중 상태. choices는 고를 수 있는 검색 대상이고 첫 항목이 기본이다. */
  function keywordInput(name: keyof D & string, choices: readonly string[]): KeywordInput {
    const saved = draftCurrent.inputs[name];
    const choice = saved !== undefined && choices.includes(saved.choice) ? saved.choice : (choices[0] ?? '');
    const text = saved?.text ?? '';
    const put = (next: { choice: string; text: string }) =>
      setDraft({ ...draftLatest.current, inputs: { ...draftLatest.current.inputs, [name]: next } });
    return {
      choice,
      text,
      setChoice: (value) => put({ choice: value, text: draftLatest.current.inputs[name]?.text ?? '' }),
      setText: (value) => put({ choice: draftLatest.current.inputs[name]?.choice ?? choice, text: value }),
      add: () => {
        const state = draftLatest.current;
        const input = state.inputs[name];
        if (input === undefined) return;
        const others = Object.fromEntries(Object.entries(state.inputs).filter(([key]) => key !== name));
        setDraft({ ...withInputs({ ...state, inputs: { [name]: input } }), inputs: others });
      },
    };
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
  // 화면에 보이는 행 순서로 낸다(다운로드·일괄 작업 대상 순서).
  const selectedIds = isCurrent ? rows.map(options.rowId).filter((id) => selectionCurrent.selected.has(id)) : [];
  const [runningAction, setRunningAction] = useState(false);
  const actionLock = useRef(false);
  const actionLifetime = useRef<string | undefined>(undefined);

  /** 현재 조건의 선택 가능한 행에만 반영한다. */
  function toggle(ids: readonly string[], on: boolean) {
    if (actionLock.current && actionLifetime.current === urlKey) return;
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
  async function run<T extends { readonly completedIds: readonly string[] }>(
    action: (ids: readonly string[]) => Promise<T>,
  ): Promise<T | undefined> {
    if (actionLock.current || !isCurrent || selectedIds.length === 0) return undefined;
    actionLock.current = true;
    actionLifetime.current = urlKey;
    setRunningAction(true);
    const ids = selectedIds;
    const lifetime = urlKey;
    try {
      const result = await action(ids);
      // completedIds는 업무 결과이고, 선택 수명 적용은 이 module이 맡는다.
      const completed = typeof result === 'object' && result !== null && 'completedIds' in result ? result.completedIds : undefined;
      if (!Array.isArray(completed) || completed.some((id) => typeof id !== 'string' || !ids.includes(id)))
        throw new Error('completedIds must be a subset of the submitted selection');
      if (mounted.current)
        setSelection((prev) =>
          prev.lifetime === lifetime ? { ...prev, selected: new Set([...prev.selected].filter((id) => !completed.includes(id))) } : prev,
        );
      return result;
    } finally {
      actionLock.current = false;
      if (mounted.current) setRunningAction(false);
    }
  }

  // ── 상태 ──
  let status: ListStatus;
  if (!full.searched) status = { kind: 'idle', reason: 'not-searched', resume: submit };
  else if (stuck.length > 0) status = { kind: 'idle', reason: 'check-stuck', fields: stuck.map((item) => item.field), resume: retryChecks };
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
  // 페이지 진입 조회: 보여 줄 결과가 아직 없고 실제로 받고 있는 동안만 덮는다(이전 결과가 있으면 덮지 않는다).
  useBlockingProgress('loading', options.progress === 'page' && page === undefined && status.kind === 'pending' && (running || query.isFetching));

  return {
    /** 현재 URL을 기본값으로 채운 확정 검색. */
    search: full,
    defaults: definition.defaults,
    view: definition.view,
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
    patchDraft: (patch: Partial<D>) => setDraft({ ...draftLatest.current, draft: { ...draftLatest.current.draft, ...patch } }),
    submit,
    /** 선언한 기본값(첫 진입 상태)으로 되돌린다. */
    reset: () => {
      setDraft({ key: filterKey, draft: codec.from(definition.defaults), issues: [], inputs: {} });
      commit(definition.defaults);
    },
    keywordInput,
    /** 현재 조건을 다시 읽는다(결과가 있는 상태의 재조회 실패 뒤 다시 시도 등). */
    refresh: refetch,
    goToPage: (value: number) => commit({ ...full, [keys.page]: value }),
    setSize: (value: number) => commit({ ...full, ...firstPage(), [keys.size]: value }),
    setSort: (sort: string, order: 'asc' | 'desc') => commit({ ...full, ...firstPage(), [keys.sort]: sort, [keys.order]: order }),
    /** 머리글 정렬: 같은 열은 방향을 바꾸고 새 열은 선언한 첫 방향(sortFirst)이다. */
    toggleSort: (sort: string) => {
      const next = nextSort(
        { sort: String(values[keys.sort] ?? ''), order: values[keys.order] === 'asc' ? 'asc' : 'desc' },
        sort,
        definition.sortFirst,
      );
      commit({ ...full, ...firstPage(), [keys.sort]: next.sort, [keys.order]: next.order });
    },
    selection: {
      selectedIds,
      canSelect: (id: string) => allowed.includes(id),
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
