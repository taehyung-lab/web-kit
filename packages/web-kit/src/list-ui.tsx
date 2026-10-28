// 파일 책임: 목록 기본 UI의 묶음 부품(List.*). 각 부품은 같은 목록 상태(useList)를 context로 읽어서, 필터·표·페이지 이동을
// 어디에 두어도 조회·정렬·선택 연결을 다시 쓰지 않는다. 검색 직전 보장(기간 검증·입력 중 키워드)은 상태가 맡고 부품은 표시만 한다.
import { Checkbox } from '@base-ui/react/checkbox';
import { useVirtualizer } from '@tanstack/react-virtual';
import { createContext, useContext, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { DownloadBlock, DownloadKind, DownloadState } from './list-download';
import { activateTableRow } from './row-activation';
import type { ViewKeys } from './search/fields';
import { calendarDate, normalizeFilterSelection, shiftCalendarDate, type Keyword, type PeriodPreset } from './search/interactions';
import { ConfirmDialog } from './ui/dialog';
import { Pending } from './ui/pending';
import type { DraftIssue, KeywordInput, ListStatus } from './use-list';

/** 기본 UI가 읽는 목록 상태(useList 결과와 같은 모양). */
export interface ListModel<Row = any, D extends object = any> {
  readonly search: Readonly<Record<string, unknown>>;
  readonly defaults: Readonly<Record<string, unknown>>;
  readonly view: ViewKeys;
  readonly draft: D;
  readonly issues: readonly DraftIssue[];
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

const defaultMessages = {
  search: '검색',
  reset: '초기화',
  detail: '상세 검색',
  retry: '다시 시도',
  notSearched: '검색 조건을 입력하고 검색해 주세요.',
  notReady: '조회 조건을 확인해 주세요.',
  optionsFailed: '선택지를 불러오지 못해 조회하지 않았습니다.',
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
  actionFailed: '작업을 완료하지 못했습니다. 결과를 확인해 주세요.',
  download: '다운로드',
  downloadKind: '다운로드 종류',
  downloadChoose: '선택',
  downloadAll: '전체 다운로드',
  downloadSelected: '선택 다운로드',
  downloading: '다운로드 중입니다.',
  downloadFailed: '다운로드하지 못했습니다.',
};
export type ListMessages = typeof defaultMessages;

/** 실패가 보이는 자리. list는 결과 없는 조회 실패, refresh는 이전 결과 유지 중 실패, action·download는 쓰기 실패다. */
export type FailurePlace = 'list' | 'refresh' | 'action' | 'download';
/**
 * 실패 원인 문구. undefined면 키트 기본 문구, null이면 그 자리에 아무것도 그리지 않는다(앱 경계가 이미 알린 실패 등).
 * refresh에서는 원인 뒤에 이전 결과 안내(messages.refreshFailed)를 붙이며 ''를 주면 원인 없이 안내만 보인다.
 */
export type RenderFailure = (failure: unknown, place: FailurePlace) => ReactNode | null | undefined;
type Context = {
  readonly model: ListModel;
  readonly copy: ListMessages;
  readonly renderFailure: RenderFailure;
};
const ListContext = createContext<Context | undefined>(undefined);

/** 현재 목록 context를 읽는다. List 밖에서 쓰면 바로 알린다. */
function useListContext(): Context {
  const value = useContext(ListContext);
  if (value === undefined) throw new Error('List parts require <List model>');
  return value;
}

/** 프로젝트 입력칸을 같은 초안에 연결한다. 검색 직전 보장은 상태가 맡으므로 입력칸을 바꿔도 남는다. */
export function useListField<T = unknown>(name: string) {
  const { model } = useListContext();
  return {
    value: (model.draft as Record<string, unknown>)[name] as T,
    set: (value: T) => model.patchDraft({ [name]: value }),
    issues: model.issues.filter((issue) => issue.field === name),
  };
}

/** 지금 목록 상태를 읽는다(프로젝트가 자기 표시를 그릴 때). */
export function useListModel<Row = unknown, D extends object = Record<string, unknown>>(): ListModel<Row, D> {
  return useListContext().model as ListModel<Row, D>;
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
  const context: Context = {
    model,
    copy: { ...defaultMessages, ...messages },
    renderFailure: renderFailure ?? (() => undefined),
  };
  return <ListContext.Provider value={context}>{children}</ListContext.Provider>;
}

/** 검색 영역. Enter·검색 버튼이 같은 확정(model.submit)을 부른다. */
function Filter({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  const { model } = useListContext();
  return (
    <form
      className={join('wk-filter', className)}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        model.submit();
      }}
    >
      {children}
    </form>
  );
}

/** 검색·초기화 버튼. Filter 안에 둔다. */
function FilterActions({ className, children }: { readonly className?: string; readonly children?: ReactNode }) {
  const { model, copy } = useListContext();
  return (
    <div className={join('wk-actions', className)}>
      {children}
      <button type="button" className="wk-button" onClick={model.reset}>
        {copy.reset}
      </button>
      <button type="submit" className="wk-button wk-button-primary">
        {copy.search}
      </button>
    </div>
  );
}

/** 접을 수 있는 상세 필터. 접어도 입력은 초안에 남는다. keys 중 확정 값이 있으면 펼친 채 시작한다. */
function Detail({ keys, children }: { readonly keys: readonly string[]; readonly children: ReactNode }) {
  const { model, copy } = useListContext();
  const hasValue = (value: unknown) =>
    value !== undefined && value !== null && value !== '' && value !== false && (!Array.isArray(value) || value.length > 0);
  const signature = JSON.stringify(keys.map((key) => model.search[key]));
  const active = keys.some((key) => hasValue(model.search[key]));
  const [open, setOpen] = useState(active);
  const [seen, setSeen] = useState(signature);
  const id = useId();
  if (signature !== seen) {
    setSeen(signature);
    setOpen(active);
  }
  return (
    <>
      <button type="button" className="wk-button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {copy.detail}
      </button>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </>
  );
}

/** 문자열 입력 하나. 빈 값은 기본값이 없을 때 undefined로 둔다. */
function Text({ name, label }: { readonly name: string; readonly label: string }) {
  const field = useListField<string | undefined>(name);
  const { model } = useListContext();
  const id = useId();
  return (
    <div className="wk-field">
      <label className="wk-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="wk-input"
        value={field.value ?? ''}
        onChange={(event) => field.set(event.target.value === '' && model.defaults[name] === undefined ? undefined : event.target.value)}
      />
    </div>
  );
}

/** 단일 선택. 빈 선택은 기본값이 없을 때 undefined다. */
function Select({
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
}) {
  const field = useListField<string | undefined>(name);
  const { model } = useListContext();
  const id = useId();
  return (
    <div className="wk-field">
      <label className="wk-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="wk-input"
        disabled={disabled}
        value={field.value ?? ''}
        onChange={(event) => field.set(event.target.value === '' && model.defaults[name] === undefined ? undefined : event.target.value)}
      >
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** 체크박스 하나(Base UI). 일부 선택은 indeterminate로 보인다. */
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
    <Checkbox.Root
      className="wk-check"
      aria-label={label}
      checked={checked}
      indeterminate={mixed}
      disabled={disabled}
      onCheckedChange={(next) => onChange(next)}
    >
      <Checkbox.Indicator className="wk-check-indicator" />
    </Checkbox.Root>
  );
  if (children === undefined) return box;
  return (
    <label className="wk-check-label">
      {box}
      {children}
    </label>
  );
}

/** 다중 선택. 빈 배열은 제한 없음(전부 체크 표시)이고 전부 고르면 빈 배열로 돌린다. "전체"는 allLabel이 있을 때만 둔다. */
function MultiSelect({
  name,
  label,
  options,
  allLabel,
}: {
  readonly name: string;
  readonly label: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly allLabel?: string;
}) {
  const field = useListField<readonly string[]>(name);
  const values = options.map((option) => option.value);
  const selected = field.value ?? [];
  const effective = selected.length === 0 ? values : selected.filter((value) => values.includes(value));
  const set = (next: readonly string[]) => field.set(normalizeFilterSelection(next, values));
  return (
    <fieldset className="wk-field">
      <legend className="wk-label">{label}</legend>
      <div className="wk-options">
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
            onChange={(on) => set(on ? [...effective, option.value] : effective.filter((value) => value !== option.value))}
          >
            {option.label}
          </Check>
        ))}
      </div>
    </fieldset>
  );
}

/** 기간 단축 하나. range를 주면 그 계산을, value를 주면 오늘에서 그만큼 이동한 쌍을 쓴다. */
export type PeriodShortcut =
  | { readonly label: string; readonly value: PeriodPreset }
  | { readonly label: string; readonly range: (today: string) => { readonly from?: string; readonly to?: string } };

/** 기간: 기준 선택(선택)·단축·직접 입력. 맞지 않는 기간은 검색할 때 상태가 기본값으로 돌린다. */
function Period({
  from,
  to,
  label,
  timeZone,
  now,
  presets = [],
  type,
  startLabel,
  endLabel,
}: {
  readonly from: string;
  readonly to: string;
  readonly label: string;
  /** 단축이 오늘을 읽는 시간대. 브라우저 시간대를 암묵적으로 쓰지 않는다. */
  readonly timeZone: string;
  readonly now: () => Date;
  readonly presets?: readonly PeriodShortcut[];
  /** 기간 기준 필드(공연일·등록일 등). */
  readonly type?: { readonly name: string; readonly options: readonly { readonly value: string; readonly label: string }[] };
  /** 날짜 칸 이름. 생략하면 "{label} {messages.periodStart/End}". */
  readonly startLabel?: string;
  readonly endLabel?: string;
}) {
  const { model, copy } = useListContext();
  const draft = model.draft as Record<string, unknown>;
  const issue = model.issues.find((item) => item.field === from);
  const typeId = useId();
  const set = (range: { from?: string; to?: string }) => model.patchDraft({ [from]: range.from || undefined, [to]: range.to || undefined });
  /** 단축 하나가 지금 만드는 기간. 누른 순간과 선택 표시가 같은 계산을 쓴다. */
  const rangeOf = (preset: PeriodShortcut): { from?: string; to?: string } => {
    const today = calendarDate(now(), timeZone);
    if ('range' in preset) return preset.range(today);
    const other = shiftCalendarDate(today, preset.value);
    return other < today ? { from: other, to: today } : { from: today, to: other };
  };
  return (
    <fieldset className="wk-field">
      <legend className="wk-label">{label}</legend>
      <div className="wk-period">
        {type !== undefined && (
          <select
            id={typeId}
            aria-label={copy.periodType}
            className="wk-input"
            value={String(draft[type.name] ?? '')}
            onChange={(event) => model.patchDraft({ [type.name]: event.target.value })}
          >
            {type.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
        <input
          className="wk-input"
          type="date"
          aria-label={startLabel ?? `${label} ${copy.periodStart}`}
          aria-invalid={issue !== undefined || undefined}
          value={(draft[from] as string | undefined) ?? ''}
          onChange={(event) => model.patchDraft({ [from]: event.target.value || undefined })}
        />
        <span aria-hidden="true">~</span>
        <input
          className="wk-input"
          type="date"
          aria-label={endLabel ?? `${label} ${copy.periodEnd}`}
          aria-invalid={issue !== undefined || undefined}
          value={(draft[to] as string | undefined) ?? ''}
          onChange={(event) => model.patchDraft({ [to]: event.target.value || undefined })}
        />
      </div>
      {presets.length > 0 && (
        <div className="wk-actions">
          {presets.map((preset) => {
            const range = rangeOf(preset);
            const active = (range.from ?? '') === ((draft[from] as string | undefined) ?? '') && (range.to ?? '') === ((draft[to] as string | undefined) ?? '');
            return (
            <button
              type="button"
              className="wk-button"
              key={preset.label}
              aria-pressed={active}
              onClick={() => set(rangeOf(preset))}
            >
              {preset.label}
            </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

/** 키워드: 대상 선택·입력·추가·칩. 입력 중 글자는 상태(keywordInput)에 있어 추가를 누르지 않아도 검색에 들어간다. */
function Keywords({
  name,
  label,
  choices,
  targetLabel,
  inputLabel,
  removeLabel,
}: {
  readonly name: string;
  readonly label: string;
  readonly choices: readonly { readonly value: string; readonly label: string }[];
  /** 대상 선택·입력 칸·칩 제거 버튼 이름. 생략하면 label과 messages로 만든다. */
  readonly targetLabel?: string;
  readonly inputLabel?: string;
  readonly removeLabel?: (item: Keyword, choiceLabel: string) => string;
}) {
  const { model, copy } = useListContext();
  const input = model.keywordInput(name, choices.map((choice) => choice.value));
  const items = ((model.draft as Record<string, unknown>)[name] as readonly Keyword[] | undefined) ?? [];
  return (
    <fieldset className="wk-field">
      <legend className="wk-label">{label}</legend>
      <div className="wk-keywords">
        {choices.length > 1 && (
          <select aria-label={targetLabel ?? `${label} ${copy.keywordTarget}`} className="wk-input" value={input.choice} onChange={(event) => input.setChoice(event.target.value)}>
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        )}
        <input
          aria-label={inputLabel ?? label}
          className="wk-input"
          value={input.text}
          onChange={(event) => input.setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              input.add();
            }
          }}
        />
        <button type="button" className="wk-button" onClick={input.add}>
          {copy.keywordAdd}
        </button>
      </div>
      {items.length > 0 && (
        <ul className="wk-chips">
          {items.map((item, index) => {
            const choiceLabel = choices.find((choice) => choice.value === item.field)?.label ?? item.field;
            return (
            <li key={`${item.field}:${item.value}`} className="wk-chip">
              {choiceLabel}: {item.value}
              <button
                type="button"
                className="wk-chip-remove"
                aria-label={removeLabel?.(item, choiceLabel) ?? `${item.value} ${copy.keywordRemove}`}
                onClick={() => model.patchDraft({ [name]: items.filter((_, i) => i !== index) })}
              >
                ×
              </button>
            </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}

/** 결과 영역: 조회 안 함·로딩·실패(재시도)·빈 결과·이전 결과 유지 중 실패 안내. 결과가 있을 때만 children(표)을 그린다. */
function Result({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  const { model, copy, renderFailure } = useListContext();
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
      <div role="status" className="wk-state">
        {text}
        {'resume' in status && status.reason !== 'not-searched' && (
          <button type="button" className="wk-button" onClick={status.resume}>
            {copy.retry}
          </button>
        )}
      </div>
    );
  } else if (status.kind === 'pending' && model.rows.length === 0) {
    body = (
      <p role="status" className="wk-state">
        {copy.loading}
      </p>
    );
  } else if (status.kind === 'failed') {
    const custom = renderFailure(status.failure, 'list');
    const text = custom === undefined ? copy.failed : custom;
    body =
      text === null ? null : (
        <div role="alert" className="wk-state">
          {text}
          <button type="button" className="wk-button" onClick={status.retry}>
            {copy.retry}
          </button>
        </div>
      );
  } else if (status.kind === 'empty') {
    body = (
      <p role="status" className="wk-state">
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
    <section id={resultId} tabIndex={-1} className={join('wk-results', className)} aria-busy={model.isFetching || undefined}>
      {refreshText !== null && (
        <div role="alert" className="wk-notice">
          {refreshText}
          <button type="button" className="wk-button" onClick={model.refresh}>
            {copy.retry}
          </button>
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
const INTERACTIVE = 'a,button,input,select,textarea,label,[role="button"],[role="checkbox"]';
/** 이 행 수부터 화면에 보이는 행만 그린다. */
export const VIRTUALIZE_FROM_ROWS = 50;

/** 결과 표: 선택 열·정렬 머리글·행 이동(클릭·Enter)·많은 행의 가상화. 이전 조건 결과는 선택할 수 없다. */
function Table<Row>({
  columns,
  rowId,
  onOpen,
  selectable = false,
  rowLabel,
  virtualizeFrom = VIRTUALIZE_FROM_ROWS,
  className,
}: {
  readonly columns: readonly ListColumn<Row>[];
  readonly rowId: (row: Row) => string;
  readonly onOpen?: (row: Row) => void;
  readonly selectable?: boolean;
  /** 행 선택 체크박스의 이름. */
  readonly rowLabel?: (row: Row) => string;
  readonly virtualizeFrom?: number;
  readonly className?: string;
}) {
  const { model, copy } = useListContext();
  const rows = model.rows as readonly Row[];
  const viewport = useRef<HTMLDivElement>(null);
  const virtualize = rows.length >= virtualizeFrom;
  const sortKey = model.search[model.view.sort];
  const order = model.search[model.view.order] === 'asc' ? 'asc' : 'desc';
  const locked = !model.isCurrent || model.selection.isRunning;
  const columnCount = columns.length + (selectable ? 1 : 0);

  /** 행 하나. 가상화 중이면 측정 ref와 위치를 받는다. */
  const renderRow = (row: Row, measure?: { readonly index: number; readonly ref: (node: Element | null) => void }) => {
    const id = rowId(row);
    const activate = onOpen === undefined ? undefined : () => onOpen(row);
    return (
      <tr
        key={id}
        data-index={measure?.index}
        ref={measure?.ref}
        data-selected={model.selection.isChecked(id) || undefined}
        tabIndex={activate ? 0 : undefined}
        className={activate ? 'wk-row-link' : undefined}
        onClick={(event) => activateTableRow(event, activate, { keys: ['Enter'], interactiveSelector: INTERACTIVE })}
        onKeyDown={(event) => activateTableRow(event, activate, { keys: ['Enter'], interactiveSelector: INTERACTIVE })}
      >
        {selectable && (
          <td className="wk-cell-select">
            <Check
              label={rowLabel?.(row) ?? copy.selectRow}
              checked={model.selection.isChecked(id)}
              disabled={locked || !model.selection.canSelect(id)}
              onChange={(on) => model.selection.toggleRow(id, on)}
            />
          </td>
        )}
        {columns.map((column) => (
          <td key={column.key} className={column.className}>
            {column.cell(row)}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div ref={viewport} className={join('wk-table-viewport', className)} data-virtual={virtualize || undefined}>
      <table className="wk-table">
        <thead>
          <tr>
            {selectable && (
              <th scope="col" className="wk-cell-select">
                <Check
                  label={copy.selectPage}
                  checked={model.selection.isAllChecked}
                  mixed={model.selection.isMixed}
                  disabled={locked}
                  onChange={(on) => model.selection.togglePage(on)}
                />
              </th>
            )}
            {columns.map((column) => {
              const direction = column.sort !== undefined && column.sort === sortKey ? order : undefined;
              return (
                <th key={column.key} scope="col" aria-sort={direction ? ARIA_SORT[direction] : undefined} className={column.className}>
                  {column.sort === undefined ? (
                    column.header
                  ) : (
                    <button type="button" className="wk-sort" onClick={() => model.toggleSort(column.sort!)}>
                      {column.header}
                      <span aria-hidden="true" className="wk-sort-glyph" data-active={direction !== undefined || undefined}>
                        {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '↕'}
                      </span>
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {virtualize ? (
            <VirtualRows rows={rows} rowId={rowId} viewport={viewport} columnCount={columnCount} renderRow={renderRow} />
          ) : (
            rows.map((row) => renderRow(row))
          )}
        </tbody>
      </table>
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
        return row === undefined ? null : renderRow(row, { index: item.index, ref: virtualizer.measureElement });
      })}
      {trailing > 0 && spacer(trailing)}
    </>
  );
}

/** 총 건수. 이전 조건 결과를 보이는 동안은 그 숫자가 틀린 정보라 '…'이다. */
function Total({ className }: { readonly className?: string }) {
  const { model, copy } = useListContext();
  const shown = model.status.kind === 'rows' || model.status.kind === 'empty' || (model.status.kind === 'pending' && model.rows.length > 0);
  const count = !shown ? '0' : model.isCurrent ? model.total.toLocaleString() : '…';
  return (
    <p className={join('wk-total', className)}>
      {copy.total} <strong>{count}</strong>
      {copy.totalUnit}
    </p>
  );
}

/** 페이지 크기 선택. 바꾸면 첫 페이지로 확정한다. */
function PageSize({ sizes }: { readonly sizes: readonly number[] }) {
  const { model, copy } = useListContext();
  const id = useId();
  return (
    <span className="wk-inline">
      <label htmlFor={id}>{copy.size}</label>
      <select id={id} className="wk-input" value={Number(model.search[model.view.size])} onChange={(event) => model.setSize(Number(event.target.value))}>
        {sizes.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </span>
  );
}

/** 정렬 키 선택. 고르면 그 키의 첫 방향(sortFirst)으로, 같은 키면 지금 방향으로 확정한다. */
function SortSelect({ options }: { readonly options: readonly { readonly value: string; readonly label: string }[] }) {
  const { model, copy } = useListContext();
  const current = String(model.search[model.view.sort] ?? '');
  return (
    <select
      aria-label={copy.sort}
      className="wk-input"
      value={current}
      onChange={(event) => {
        if (event.target.value !== current) model.toggleSort(event.target.value);
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

const WINDOW = 5;
/** 지금 페이지 주변 번호들. 처음·끝 페이지는 항상 보인다. */
function pageWindow(page: number, last: number): readonly number[] {
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), last - WINDOW + 1));
  const pages = new Set([1, last]);
  for (let current = start; current < start + WINDOW && current <= last; current += 1) pages.add(current);
  return [...pages].sort((a, b) => a - b);
}

/** 번호 페이지 이동. 한 페이지뿐이면 그리지 않는다. */
function Pagination({ className }: { readonly className?: string }) {
  const { model, copy } = useListContext();
  const size = Math.max(1, Number(model.search[model.view.size]) || 1);
  const last = Math.max(1, Math.ceil(model.total / size));
  if (last <= 1 || model.rows.length === 0) return null;
  const page = Math.min(Math.max(Number(model.search[model.view.page]) || 1, 1), last);
  return (
    <nav aria-label={copy.pagination} className={join('wk-pagination', className)}>
      <button type="button" className="wk-button" disabled={page === 1} onClick={() => model.goToPage(page - 1)}>
        {copy.previous}
      </button>
      {pageWindow(page, last).map((number, index, all) => (
        <span key={number} className="wk-inline">
          {index > 0 && number - (all[index - 1] ?? number) > 1 && <span aria-hidden="true">…</span>}
          <button
            type="button"
            className="wk-button"
            aria-current={number === page ? 'page' : undefined}
            onClick={() => model.goToPage(number)}
          >
            {number}
          </button>
        </span>
      ))}
      <button type="button" className="wk-button" disabled={page === last} onClick={() => model.goToPage(page + 1)}>
        {copy.next}
      </button>
    </nav>
  );
}

/** 선택 기반 쓰기 액션 자리. 이전 조건 결과를 보이는 동안 통째로 잠근다. */
function Actions({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  const { model } = useListContext();
  return (
    <fieldset disabled={!model.isCurrent} className={join('wk-actions wk-fieldset', className)}>
      {children}
    </fieldset>
  );
}

/** 확인창을 거치는 일괄 작업. 확인 당시 결과와 선택이 바뀌면 실행하지 않고, 실패는 확인창에 남기며 선택은 유지한다. */
function BulkAction<T>({
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
}) {
  const { model, copy, renderFailure } = useListContext();
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
  const custom = error === undefined || typeof error === 'string' ? undefined : renderFailure(error, 'action');
  const errorText = error === undefined ? null : typeof error === 'string' ? error : custom === undefined ? copy.actionFailed : custom;
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
        confirmLabel={confirmLabel ?? copy.confirm}
        cancelLabel={cancelLabel ?? copy.cancel}
        onConfirm={() => void confirm()}
        onCancel={() => {
          if (!running.current) setPending(undefined);
        }}
      >
        {pending === undefined ? null : (describe?.(pending.ids) ?? `${pending.ids.length}${copy.items}`)}
        {errorText !== null && (
          <p role="alert" className="wk-error">
            {errorText}
          </p>
        )}
      </ConfirmDialog>
      {pending === undefined && errorText !== null && (
        <p role="alert" className="wk-error">
          {errorText}
        </p>
      )}
    </>
  );
}

/** Download가 읽는 다운로드 흐름(useListDownload 결과). */
export interface DownloadControl {
  readonly state: DownloadState;
  readonly blockOf: (kind: DownloadKind) => DownloadBlock | undefined;
  readonly start: (kind: DownloadKind) => Promise<boolean>;
  readonly clear: () => void;
}

/** 다운로드 종류 선택과 실행 버튼. 진행 중에는 잠기고 실패는 원인과 함께 남는다. kinds 순서대로 보인다. */
function Download({
  control,
  kinds = ['all', 'selected'],
  label,
}: {
  readonly control: DownloadControl;
  readonly kinds?: readonly DownloadKind[];
  readonly label?: string;
}) {
  const { copy, renderFailure } = useListContext();
  const [kind, setKind] = useState<DownloadKind | ''>('');
  const kindLabel = (value: DownloadKind) => (value === 'all' ? copy.downloadAll : copy.downloadSelected);
  const blocked = kind === '' || control.blockOf(kind) !== undefined;
  const custom = control.state.kind === 'failed' ? renderFailure(control.state.failure, 'download') : null;
  const failure = control.state.kind !== 'failed' ? null : custom === undefined ? copy.downloadFailed : custom;
  const running = control.state.kind === 'running';
  return (
    <span className="wk-inline" aria-busy={running || undefined}>
      <select
        aria-label={copy.downloadKind}
        className="wk-input"
        disabled={running}
        value={kind}
        onChange={(event) => {
          control.clear();
          setKind(kinds.find((value) => value === event.target.value) ?? '');
        }}
      >
        <option value="">{copy.downloadChoose}</option>
        {kinds.map((value) => (
          <option key={value} value={value}>
            {kindLabel(value)}
          </option>
        ))}
      </select>
      <button type="button" className="wk-button" disabled={blocked} onClick={() => kind !== '' && void control.start(kind)}>
        {label ?? copy.download}
      </button>
      {/* 진행 중에는 종류·버튼을 잠그고 옆에 로딩 표시만 둔다. 문구는 화면 낭독기에만 읽힌다. */}
      {running && <Pending label={copy.downloading} />}
      {failure !== null && (
        <span role="alert" className="wk-error">
          {failure}
        </span>
      )}
    </span>
  );
}

/** 클래스 이름을 잇는다. */
function join(...names: readonly (string | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

/** 목록 기본 UI. <List model={useList(...)}> 안에 부품을 원하는 배치로 둔다. */
export const List = Object.assign(ListRoot, {
  Filter,
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
  Download,
  Check,
});
