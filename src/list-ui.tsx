/** 목록의 초안·결과·선택 module에 기본 필터·표·일괄 작업 UI를 연결한다. */
import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { DraftIssue, ListStatus } from './use-list';
import type { ViewKeys } from './search/fields';
import {
  addKeyword,
  calendarDate,
  nextSort,
  normalizeFilterSelection,
  shiftCalendarDate,
  type Keyword,
  type PeriodPreset,
} from './search/interactions';
import { validateDateRange } from './search/date-range';
import { activateTableRow } from './row-activation';
import { ConfirmDialog } from './ui/dialog';
import { RetryRegion } from './ui/retry';

export interface ListUiModel<Row, Draft extends object> {
  readonly search: Readonly<Record<string, unknown>>;
  readonly defaults: Readonly<Record<string, unknown>>;
  readonly view: ViewKeys;
  readonly draft: Draft;
  readonly issues: readonly DraftIssue[];
  readonly patchDraft: (patch: Partial<Draft>) => void;
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
type Matching<D, V> = { [K in keyof D]: D[K] extends V ? K : never }[keyof D] & string;
type Binding = { readonly prepare: () => boolean; readonly reset: () => void };
type Context<Row, D extends object> = {
  readonly model: ListUiModel<Row, D>;
  readonly bindings: Map<object, Binding>;
  readonly submit: () => void;
  readonly reset: () => void;
};
const ListContext = createContext<unknown>(undefined);
const defaultMessages = {
  search: '검색',
  invalidInput: '검색 조건을 확인해 주세요.',
  reset: '초기화',
  detail: '상세 검색',
  retry: '다시 시도',
  notReady: '조회 조건을 확인해 주세요.',
  optionsFailed: '선택지를 불러오지 못해 조회하지 않았습니다.',
  loading: '불러오는 중입니다.',
  failed: '목록을 불러오지 못했습니다.',
  empty: '조회 결과가 없습니다.',
  refreshFailed: '최신 내용을 불러오지 못했습니다.',
  selectPage: '이 페이지 전체 선택',
  selectRow: '행 선택',
  previous: '이전',
  next: '다음',
  size: '페이지 크기',
};
export type ListMessages = typeof defaultMessages;
const ListMessagesContext = createContext(defaultMessages);
export interface ListColumn<Row> {
  readonly key: string;
  readonly label: string;
  readonly render: (row: Row) => ReactNode;
  readonly sortable?: boolean;
}
export interface ListParts<Row, D extends object> {
  Filter: (props: { children: ReactNode; detail?: ReactNode; detailKeys?: readonly (keyof D & string)[] }) => ReactNode;
  Text: <K extends Matching<D, string | undefined>>(props: { name: K; label: string }) => ReactNode;
  Select: <K extends Matching<D, string | undefined>>(props: {
    name: K;
    label: string;
    options: readonly { value: string; label: string }[];
    emptyLabel?: string;
    disabled?: boolean;
  }) => ReactNode;
  MultiSelect: <K extends Matching<D, readonly string[]>>(props: {
    name: K;
    label: string;
    options: readonly { value: string; label: string }[];
  }) => ReactNode;
  Period: <K extends Matching<D, string | undefined>>(props: {
    from: K;
    to: K;
    label: string;
    timeZone: string;
    now: () => Date;
    presets?: readonly { label: string; value: PeriodPreset }[];
  }) => ReactNode;
  Keywords: <K extends Matching<D, readonly Keyword[]>>(props: {
    name: K;
    label: string;
    choices: readonly { value: string; label: string }[];
  }) => ReactNode;
  Table: (props: {
    columns: readonly ListColumn<Row>[];
    rowId: (row: Row) => string;
    onOpen?: (row: Row) => void;
    selectable?: boolean;
  }) => ReactNode;
  Pagination: (props: { sizes: readonly number[] }) => ReactNode;
  BulkAction: <T>(props: {
    label: string;
    run: (ids: readonly string[]) => Promise<{ completedIds: readonly string[]; value?: T }>;
    check?: (ids: readonly string[]) => string | undefined;
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    renderFailure?: (failure: unknown) => ReactNode;
  }) => ReactNode;
}

/** 입력 묶음의 타입과 컴포넌트 정체성을 유지한다. */
function createParts<Row, D extends object>(): ListParts<Row, D> {
  /** 현재 목록의 단일 상태를 읽는다. */
  function useListContext() {
    const value = useContext(ListContext);
    if (value === undefined) throw Error('List UI requires ListView');
    return value as Context<Row, D>;
  }
  /** 검색 직전 처리와 초기화를 등록한다. 입력이 해제되면 함께 제거한다. */
  function useBinding(binding: Binding) {
    const { bindings } = useListContext();
    const ref = useRef(binding);
    ref.current = binding;
    const [id] = useState(() => ({}));
    useLayoutEffect(() => {
      bindings.set(id, { prepare: () => ref.current.prepare(), reset: () => ref.current.reset() });
      return () => {
        bindings.delete(id);
      };
    }, [bindings, id]);
  }
  /** 같은 필터 상태에 텍스트 입력을 연결한다. */
  function Text<K extends Matching<D, string | undefined>>({ name, label }: { name: K; label: string }) {
    const { model } = useListContext();
    const id = useId();
    return (
      <label className="wk-field" htmlFor={id}>
        {label}
        <input
          id={id}
          className="wk-input"
          value={(model.draft[name] as string | undefined) ?? ''}
          onChange={(e) =>
            model.patchDraft({
              [name]: e.target.value === '' && model.defaults[name] === undefined ? undefined : e.target.value,
            } as Partial<D>)
          }
        />
      </label>
    );
  }
  /** 상세 필터는 접어도 입력을 보존하고 초기화는 실제 최초 상태를 적용한다. */
  function Filter({
    children,
    detail,
    detailKeys = [],
  }: {
    children: ReactNode;
    detail?: ReactNode;
    detailKeys?: readonly (keyof D & string)[];
  }) {
    const ctx = useListContext();
    const copy = useContext(ListMessagesContext);
    /** 제한 없는 빈 값은 접을 수 있고 기본 제한 값도 사용자에게 보인다. */
    const hasValue = (value: unknown) =>
      value !== undefined && value !== null && value !== '' && value !== false && (!Array.isArray(value) || value.length > 0);
    const active = detailKeys.some((key) => hasValue(ctx.model.search[key]));
    const signature = JSON.stringify(detailKeys.map((key) => ctx.model.search[key]));
    const [open, setOpen] = useState(active);
    const [seen, setSeen] = useState(signature);
    const id = useId();
    if (signature !== seen) {
      setSeen(signature);
      setOpen(active);
    }
    return (
      <form
        className="wk-filter"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          ctx.submit();
        }}
      >
        {children}
        {detail !== undefined && (
          <div hidden={!open} id={id}>
            {detail}
          </div>
        )}
        <div className="wk-actions">
          {detail !== undefined && (
            <button type="button" className="wk-button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
              {copy.detail}
            </button>
          )}
          <button
            type="button"
            className="wk-button"
            onClick={() => {
              ctx.reset();
              setOpen(detailKeys.some((key) => hasValue(ctx.model.defaults[key])));
            }}
          >
            {copy.reset}
          </button>
          <button className="wk-button" type="submit">
            {copy.search}
          </button>
        </div>
        {ctx.model.issues.map((issue) => (
          <p role="alert" key={issue.field}>
            {copy.invalidInput}
          </p>
        ))}
      </form>
    );
  }
  /** 날짜 입력·프리셋·검색 직전 기간 검증을 같은 흐름으로 처리한다. */
  function Period<K extends Matching<D, string | undefined>>({
    from,
    to,
    label,
    timeZone,
    now,
    presets = [],
  }: {
    from: K;
    to: K;
    label: string;
    timeZone: string;
    now: () => Date;
    presets?: readonly { label: string; value: PeriodPreset }[];
  }) {
    const { model } = useListContext();
    const [issue, setIssue] = useState<string>();
    const id = useId();
    useBinding({
      prepare: () => {
        const error = validateDateRange(model.draft[from] as string, model.draft[to] as string);
        setIssue(error);
        return error === undefined;
      },
      reset: () => setIssue(undefined),
    });
    return (
      <fieldset className="wk-field">
        <legend>{label}</legend>
        <input
          className="wk-input"
          aria-label={`${label} 시작`}
          type="date"
          value={(model.draft[from] as string | undefined) ?? ''}
          aria-describedby={issue ? id : undefined}
          onChange={(e) => model.patchDraft({ [from]: e.target.value } as Partial<D>)}
        />
        <input
          className="wk-input"
          aria-label={`${label} 종료`}
          type="date"
          value={(model.draft[to] as string | undefined) ?? ''}
          aria-describedby={issue ? id : undefined}
          onChange={(e) => model.patchDraft({ [to]: e.target.value } as Partial<D>)}
        />
        {presets.map((preset) => (
          <button
            type="button"
            className="wk-button"
            key={preset.label}
            onClick={() => {
              const today = calendarDate(now(), timeZone);
              const other = shiftCalendarDate(today, preset.value);
              model.patchDraft({ [from]: other < today ? other : today, [to]: other < today ? today : other } as Partial<D>);
              setIssue(undefined);
            }}
          >
            {preset.label}
          </button>
        ))}
        {issue && (
          <p id={id} role="alert">
            {issue === 'incomplete'
              ? '시작일과 종료일을 입력해 주세요.'
              : issue === 'reversed'
                ? '기간의 순서를 확인해 주세요.'
                : '올바른 날짜를 입력해 주세요.'}
          </p>
        )}
      </fieldset>
    );
  }
  /** Enter·검색 버튼이 미확정 키워드를 같은 초안에 합친다. */
  function Keywords<K extends Matching<D, readonly Keyword[]>>({
    name,
    label,
    choices,
  }: {
    name: K;
    label: string;
    choices: readonly { value: string; label: string }[];
  }) {
    const { model } = useListContext();
    const [text, setText] = useState('');
    const pending = useRef(text);
    pending.current = text;
    const [selectedField, setField] = useState(choices[0]?.value ?? '');
    const field = choices.some((choice) => choice.value === selectedField) ? selectedField : (choices[0]?.value ?? '');
    const id = useId();
    const items = model.draft[name] as readonly Keyword[];
    const filterKey = JSON.stringify(
      Object.fromEntries(Object.entries(model.search).filter(([key]) => !Object.values(model.view).includes(key))),
    );
    useEffect(() => {
      pending.current = '';
      setText('');
    }, [filterKey]);
    /** 추가 버튼과 검색 제출이 같은 정규화 경로를 쓴다. */
    function add() {
      if (pending.current.trim() === '') return true;
      if (!choices.some((choice) => choice.value === field)) return false;
      model.patchDraft({ [name]: addKeyword(items, field, pending.current) } as Partial<D>);
      pending.current = '';
      setText('');
      return true;
    }
    useBinding({
      prepare: add,
      reset: () => {
        pending.current = '';
        setText('');
      },
    });
    return (
      <fieldset className="wk-field">
        <legend>{label}</legend>
        <select aria-label={`${label} 대상`} className="wk-input" value={field} onChange={(e) => setField(e.target.value)}>
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
        <input
          id={id}
          aria-label={label}
          className="wk-input"
          value={text}
          onChange={(e) => {
            pending.current = e.target.value;
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="wk-button" onClick={add}>
          추가
        </button>
        <ul>
          {items.map((item, index) => (
            <li key={`${item.field}:${item.value}`}>
              {choices.find((choice) => choice.value === item.field)?.label ?? item.field}: {item.value}{' '}
              <button
                type="button"
                aria-label={`${item.value} 제거`}
                onClick={() => model.patchDraft({ [name]: items.filter((_, i) => i !== index) } as Partial<D>)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
    );
  }
  /** 표의 결과 상태·선택·정렬·행 이동을 키트 수명에 연결한다. */
  function Table({
    columns,
    rowId,
    onOpen,
    selectable = false,
  }: {
    columns: readonly ListColumn<Row>[];
    rowId: (row: Row) => string;
    onOpen?: (row: Row) => void;
    selectable?: boolean;
  }) {
    const { model } = useListContext();
    const copy = useContext(ListMessagesContext);
    const all = useRef<HTMLInputElement>(null);
    const resultId = useId();
    useEffect(() => {
      if (all.current) all.current.indeterminate = model.selection.isMixed;
    }, [model.selection.isMixed]);
    const status = model.status;
    const failed = status.kind === 'failed' || (status.kind === 'idle' && status.reason === 'check-failed');
    const retry = status.kind === 'failed' ? status.retry : status.kind === 'idle' && 'resume' in status ? status.resume : model.refresh;
    return (
      <RetryRegion
        failed={failed}
        message={status.kind === 'failed' ? copy.failed : copy.optionsFailed}
        onRetry={retry}
        controlId={resultId}
        retryLabel={copy.retry}
      >
        <section id={resultId} tabIndex={-1} className="wk-results" aria-busy={model.isFetching}>
          {status.kind === 'idle' && (
            <div role="status">
              {status.reason === 'check-failed' ? copy.optionsFailed : copy.notReady}
              {'resume' in status && (
                <button className="wk-button" onClick={status.resume}>
                  {copy.retry}
                </button>
              )}
            </div>
          )}
          {status.kind === 'pending' && <p role="status">{copy.loading}</p>}
          {status.kind === 'empty' && <p role="status">{copy.empty}</p>}
          {model.failure !== undefined && (
            <div role="alert">
              {copy.refreshFailed}
              <button className="wk-button" onClick={model.refresh}>
                {copy.retry}
              </button>
            </div>
          )}
          {model.rows.length > 0 && (
            <table className="wk-table">
              <thead>
                <tr>
                  {selectable && (
                    <th>
                      <input
                        ref={all}
                        type="checkbox"
                        aria-label={copy.selectPage}
                        disabled={!model.isCurrent || model.selection.isRunning}
                        checked={model.selection.isAllChecked}
                        onChange={(e) => model.selection.togglePage(e.target.checked)}
                      />
                    </th>
                  )}
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      aria-sort={
                        model.search[model.view.sort] === column.key
                          ? model.search[model.view.order] === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          onClick={() => {
                            const next = nextSort(
                              {
                                sort: String(model.search[model.view.sort] ?? ''),
                                order: model.search[model.view.order] === 'asc' ? 'asc' : 'desc',
                              },
                              column.key,
                            );
                            model.setSort(next.sort, next.order);
                          }}
                        >
                          {column.label}
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {model.rows.map((row) => (
                  <tr
                    key={rowId(row)}
                    tabIndex={onOpen ? 0 : undefined}
                    onClick={(e) =>
                      activateTableRow(e, onOpen ? () => onOpen(row) : undefined, {
                        keys: ['Enter'],
                        interactiveSelector: 'button,a,input,select,textarea,[role="button"]',
                      })
                    }
                    onKeyDown={(e) =>
                      activateTableRow(e, onOpen ? () => onOpen(row) : undefined, {
                        keys: ['Enter'],
                        interactiveSelector: 'button,a,input,select,textarea,[role="button"]',
                      })
                    }
                  >
                    {selectable && (
                      <td>
                        <input
                          type="checkbox"
                          aria-label={copy.selectRow}
                          disabled={!model.selection.canSelect(rowId(row)) || model.selection.isRunning}
                          checked={model.selection.isChecked(rowId(row))}
                          onChange={(e) => model.selection.toggleRow(rowId(row), e.target.checked)}
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td key={column.key}>{column.render(row)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </RetryRegion>
    );
  }
  /** 허용 크기와 현재 총 건수로 페이지 이동을 제공한다. */
  function Pagination({ sizes }: { sizes: readonly number[] }) {
    const { model } = useListContext();
    const copy = useContext(ListMessagesContext);
    const page = Number(model.search[model.view.page] ?? 1);
    const size = Number(model.search[model.view.size] ?? sizes[0] ?? 1);
    const last = Math.max(1, Math.ceil(model.total / Math.max(1, size)));
    return (
      <nav className="wk-actions" aria-label="페이지 이동">
        <button type="button" className="wk-button" disabled={page <= 1} onClick={() => model.goToPage(page - 1)}>
          {copy.previous}
        </button>
        <span>
          {page} / {last}
        </span>
        <button type="button" className="wk-button" disabled={page >= last} onClick={() => model.goToPage(page + 1)}>
          {copy.next}
        </button>
        <select aria-label={copy.size} className="wk-input" value={size} onChange={(e) => model.setSize(Number(e.target.value))}>
          {sizes.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </nav>
    );
  }
  /** 확인한 선택과 현재 결과가 같을 때만 일괄 업무를 실행한다. */
  function BulkAction<T>({
    label,
    run,
    check,
    title = label,
    confirmLabel = '확인',
    cancelLabel = '취소',
    renderFailure,
  }: {
    label: string;
    run: (ids: readonly string[]) => Promise<{ completedIds: readonly string[]; value?: T }>;
    check?: (ids: readonly string[]) => string | undefined;
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    renderFailure?: (failure: unknown) => ReactNode;
  }) {
    const { model } = useListContext();
    const [pending, setPending] = useState<{ ids: readonly string[]; page: unknown }>();
    const [error, setError] = useState<unknown>();
    const running = useRef(false);
    const signature = JSON.stringify(model.selection.selectedIds);
    const current = useRef(model);
    current.current = model;
    useEffect(() => {
      if (
        !running.current &&
        pending !== undefined &&
        (pending.page !== model.page ||
          JSON.stringify(pending.ids) !== signature ||
          !model.isCurrent ||
          pending.ids.some((id) => !model.selection.canSelect(id)))
      )
        setPending(undefined);
    }, [pending, signature, model.page, model.isCurrent, model.selection]);
    /** 마지막 순간에도 업무 조건과 선택 snapshot을 다시 확인한다. */
    async function confirm() {
      if (running.current) return;
      const snapshot = pending;
      const now = current.current;
      if (
        snapshot === undefined ||
        snapshot.page !== now.page ||
        JSON.stringify(snapshot.ids) !== JSON.stringify(now.selection.selectedIds) ||
        !now.isCurrent ||
        snapshot.ids.some((id) => !now.selection.canSelect(id))
      ) {
        setPending(undefined);
        return;
      }
      const refusal = check?.(snapshot.ids);
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
    return (
      <>
        <button
          type="button"
          className="wk-button"
          disabled={!model.isCurrent || model.selection.selectedIds.length === 0 || model.selection.isRunning}
          onClick={() => {
            const refusal = check?.(model.selection.selectedIds);
            setError(refusal);
            if (!refusal) setPending({ ids: [...model.selection.selectedIds], page: model.page });
          }}
        >
          {label}
        </button>
        <ConfirmDialog
          open={pending !== undefined}
          title={title}
          pending={model.selection.isRunning}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          onConfirm={() => {
            void confirm();
          }}
          onCancel={() => {
            if (!running.current) setPending(undefined);
          }}
        >
          {pending?.ids.length ?? 0}개 항목
          {error !== undefined && (
            <p role="alert">
              {typeof error === 'string' ? error : (renderFailure?.(error) ?? '작업을 완료하지 못했습니다. 결과를 확인해 주세요.')}
            </p>
          )}
        </ConfirmDialog>
        {pending === undefined && error !== undefined && (
          <p role="alert">{typeof error === 'string' ? error : (renderFailure?.(error) ?? '작업을 완료하지 못했습니다.')}</p>
        )}
      </>
    );
  }

  /** 검색용 단일 선택. 빈 선택은 선언한 기본 표현을 따른다. */
  function Select<K extends Matching<D, string | undefined>>({
    name,
    label,
    options,
    emptyLabel = '전체',
    disabled = false,
  }: {
    name: K;
    label: string;
    options: readonly { value: string; label: string }[];
    emptyLabel?: string;
    disabled?: boolean;
  }) {
    const { model } = useListContext();
    return (
      <label className="wk-field">
        {label}
        <select
          className="wk-input"
          disabled={disabled}
          value={(model.draft[name] as string | undefined) ?? ''}
          onChange={(e) =>
            model.patchDraft({
              [name]: e.target.value === '' && model.defaults[name] === undefined ? undefined : e.target.value,
            } as Partial<D>)
          }
        >
          <option value="">{emptyLabel}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  /** 검색의 빈 배열은 제한 없음이며 일부 선택만 배열에 남긴다. */
  function MultiSelect<K extends Matching<D, readonly string[]>>({
    name,
    label,
    options,
  }: {
    name: K;
    label: string;
    options: readonly { value: string; label: string }[];
  }) {
    const { model } = useListContext();
    const selected = model.draft[name] as readonly string[];
    const effective = selected.length === 0 ? options.map((option) => option.value) : selected;
    return (
      <fieldset className="wk-field">
        <legend>{label}</legend>
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              checked={effective.includes(option.value)}
              onChange={(e) => {
                const next = e.target.checked ? [...effective, option.value] : effective.filter((value) => value !== option.value);
                model.patchDraft({
                  [name]: normalizeFilterSelection(
                    next,
                    options.map((item) => item.value),
                  ),
                } as Partial<D>);
              }}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    );
  }
  return { Filter, Text, Select, MultiSelect, Period, Keywords, Table, Pagination, BulkAction };
}

/** 한 목록의 기본 UI는 같은 model과 타입을 공유한다. */
export function ListView<Row, D extends object>({
  model,
  children,
  messages,
}: {
  readonly model: ListUiModel<Row, D>;
  readonly children: (parts: ListParts<Row, D>) => ReactNode;
  readonly messages?: Partial<ListMessages>;
}) {
  const [parts] = useState(() => createParts<Row, D>());
  const [bindings] = useState(() => new Map<object, Binding>());
  const context: Context<Row, D> = {
    model,
    bindings,
    submit: () => {
      let valid = true;
      for (const binding of bindings.values()) if (!binding.prepare()) valid = false;
      if (valid) model.submit();
    },
    reset: () => {
      for (const binding of bindings.values()) binding.reset();
      model.reset();
    },
  };
  return (
    <ListMessagesContext.Provider value={{ ...defaultMessages, ...messages }}>
      <ListContext.Provider value={context}>{children(parts)}</ListContext.Provider>
    </ListMessagesContext.Provider>
  );
}
