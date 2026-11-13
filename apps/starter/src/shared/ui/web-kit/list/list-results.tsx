// 파일 책임: 조회 상태·일반/가상화 표·건수·페이지 크기·정렬·페이지 이동을 그린다.
import { listPaginationBinding, listViewBinding, listRowBinding, useListVirtualRows, listFieldMeta, type ListModel } from '@boosterlab/web-kit/list';
import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Table as TableRoot, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { useListContext, Check, labelled, OptionSelect } from './list-context';


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
/** 결과 자리 안내(조회 전·로딩·실패·빈 결과). */
const stateClass = 'flex min-h-32 flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground';

export { Result, Table, Total, PageSize, SortSelect, Pagination };
