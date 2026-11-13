// 파일 책임: 상세 기본 UI의 묶음 부품(Record.*). useRecord가 판정한 네 상태(대기·없음·실패·준비됨)와 갱신 실패를 그리고,
// 준비된 내용은 Record.Fields·Field·History로 배치한다. 문구·앱 경계 무표시는 프로젝트가 renderFailure·missing 값으로 정한다.
import { createContext, useContext, useId, type ReactNode } from 'react';
import type { RecordState } from '@boosterlab/web-kit/record';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { RetryRegion } from './ui/retry';

const defaultMessages = {
  loading: '불러오는 중입니다.',
  failed: '항목을 불러오지 못했습니다.',
  missing: '항목이 없거나 접근할 수 없습니다.',
  refreshFailed: '최신 내용을 불러오지 못했습니다.',
  retry: '다시 시도',
  empty: '-',
  historyEmpty: '변경 이력이 없습니다.',
};
export type RecordMessages = typeof defaultMessages;

/** 실패가 보이는 자리. load는 내용 없는 실패, missing은 없음·이 조회의 거부, refresh는 내용을 보이는 중 재조회 실패다. */
export type RecordFailurePlace = 'load' | 'missing' | 'refresh';
/** 실패 문구. undefined면 키트 기본 문구, null이면 그 자리에 아무것도 그리지 않는다(앱 경계가 이미 알린 401·403 등). */
export type RenderRecordFailure = (failure: unknown, place: RecordFailurePlace) => ReactNode | null | undefined;

/** 앱이 RecordDefaults로 준 기본값. 없으면 키트 기본 문구만 쓴다. */
type Defaults = { readonly messages: Partial<RecordMessages>; readonly renderFailure?: RenderRecordFailure };
const DefaultsContext = createContext<Defaults>({ messages: {} });
/** Record 안의 문구. Record 밖에 둔 Field·History는 null을 보고 앱 기본값을 직접 읽는다. */
const MessagesContext = createContext<RecordMessages | null>(null);

/** 값이 undefined인 키를 버린다. 「이 문구는 따로 정하지 않음」이 아래 단계의 문구를 지우지 않게 한다. */
function definedOnly<T extends object>(value: T | undefined): Partial<T> {
  if (value === undefined) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

/** 가까운 쪽 실패 문구를 먼저 묻고, undefined(정하지 않음)일 때만 다음 단계에 묻는다. null·''은 그 단계의 답으로 그대로 쓴다. */
function chainFailure(first: RenderRecordFailure | undefined, next: RenderRecordFailure | undefined): RenderRecordFailure | undefined {
  if (first === undefined) return next;
  if (next === undefined) return first;
  return (failure, place) => {
    const own = first(failure, place);
    return own === undefined ? next(failure, place) : own;
  };
}

/** 키트 기본 → 앱 기본(RecordDefaults) → 이 Record의 messages 순으로 덮어쓴 문구. */
function useRecordCopy(messages?: Partial<RecordMessages>): RecordMessages {
  const defaults = useContext(DefaultsContext);
  return { ...defaultMessages, ...defaults.messages, ...definedOnly(messages) };
}

/** Field·History가 읽는 문구. Record 안이면 그 Record의 문구, 밖이면 앱 기본값이다. */
function useFieldCopy(): RecordMessages {
  const local = useContext(MessagesContext);
  const fallback = useRecordCopy();
  return local ?? fallback;
}

/**
 * 앱 전체의 상세 기본 문구와 실패 문구. 앱 골격에 한 번 두고 언어가 바뀌면 새 messages로 다시 그린다.
 * 각 <Record messages renderFailure>는 이 값 위에 덮어쓴다. 안쪽 RecordDefaults는 바깥 값 위에 덮어쓴다.
 * renderFailure는 가까운 쪽부터 묻고 undefined면 다음 단계(바깥 → 키트 기본 문구)로 넘긴다. null이면 그리지 않는다.
 */
export function RecordDefaults({
  messages,
  renderFailure,
  children,
}: {
  readonly messages?: Partial<RecordMessages>;
  readonly renderFailure?: RenderRecordFailure;
  readonly children: ReactNode;
}) {
  const outer = useContext(DefaultsContext);
  const value: Defaults = {
    messages: { ...outer.messages, ...definedOnly(messages) },
    renderFailure: chainFailure(renderFailure, outer.renderFailure),
  };
  return <DefaultsContext.Provider value={value}>{children}</DefaultsContext.Provider>;
}

/**
 * 단건 하나의 상태를 그린다. 준비됨일 때만 children(data)을 그리고, 식별 전환·없음·실패는 useRecord 판정을 그대로 따른다.
 * missing은 없음 안내(무엇이 없는지와 돌아갈 길)다. 재조회 실패는 내용을 지우지 않고 위에 알린다.
 */
function RecordRoot<T>({
  state,
  children,
  missing,
  renderFailure: localFailure,
  messages,
}: {
  readonly state: RecordState<T>;
  readonly children: (data: T) => ReactNode;
  readonly missing?: ReactNode;
  readonly renderFailure?: RenderRecordFailure;
  readonly messages?: Partial<RecordMessages>;
}) {
  const id = useId();
  const copy = useRecordCopy(messages);
  const defaults = useContext(DefaultsContext);
  const renderFailure: RenderRecordFailure = chainFailure(localFailure, defaults.renderFailure) ?? (() => undefined);
  let body: ReactNode;
  if (state.kind === 'missing') {
    const text = renderFailure(state.failure, 'missing');
    body =
      text === null ? null : (
        <div role="status" className="grid justify-items-center gap-3 py-8 text-sm text-muted-foreground">
          {missing ?? <p>{text ?? copy.missing}</p>}
        </div>
      );
  } else {
    const loadText = state.kind === 'failed' ? renderFailure(state.failure, 'load') : undefined;
    const refreshText = state.kind === 'ready' && state.refresh.failure !== undefined ? renderFailure(state.refresh.failure, 'refresh') : null;
    body =
      loadText === null ? null : (
        <RetryRegion
          failed={state.kind === 'failed'}
          message={<p>{loadText ?? copy.failed}</p>}
          onRetry={state.kind === 'failed' ? state.retry : () => undefined}
          controlId={id}
          retryLabel={copy.retry}
        >
          {state.kind === 'pending' ? (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              {copy.loading}
            </p>
          ) : state.kind === 'ready' ? (
            <section id={id} tabIndex={-1} aria-busy={state.refresh.refreshing} className="grid gap-4">
              {state.refresh.failure !== undefined && refreshText !== null ? (
                <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
                  {refreshText ?? copy.refreshFailed}
                  <Button type="button" variant="outline" size="sm" onClick={state.refresh.retry}>
                    {copy.retry}
                  </Button>
                </div>
              ) : null}
              {children(state.data)}
            </section>
          ) : null}
        </RetryRegion>
      );
  }
  return <MessagesContext.Provider value={copy}>{body}</MessagesContext.Provider>;
}

/** 라벨·값 항목들의 묶음(dl). */
function Fields({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return <dl className={cn('grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-x-4 gap-y-1', className)}>{children}</dl>;
}

/** 라벨·값 한 칸. null·undefined·''만 빈 값 표시('-')이고 0은 그대로 보인다. 값의 의미·마스킹·포맷은 프로젝트가 정한다. */
function Field({ label, children }: { readonly label: ReactNode; readonly children?: ReactNode }) {
  const copy = useFieldCopy();
  const empty = children === null || children === undefined || children === '' || children === false;
  return (
    <div className="min-w-0 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm [overflow-wrap:anywhere] whitespace-pre-line">{empty ? copy.empty : children}</dd>
    </div>
  );
}

export interface RecordHistoryEntry {
  readonly id: string;
  /** 이미 표시 형식으로 쓴 변경 일시. */
  readonly at: ReactNode;
  readonly actor: ReactNode;
  /** 변경 내용 줄. */
  readonly changes: readonly ReactNode[];
}

/** 변경 이력 표(일시·변경 내용·담당자). 항목은 프로젝트가 서버 어휘를 해석해 넘긴다. 0건이면 빈 문구. */
function History({
  entries,
  labels,
  empty,
  headerClassName,
}: {
  readonly entries: readonly RecordHistoryEntry[];
  readonly labels: { readonly at: ReactNode; readonly changes: ReactNode; readonly actor: ReactNode };
  readonly empty?: ReactNode;
  /** 머리글(thead) 표면. 목록 표의 headerClassName과 같은 디자인을 맞출 때 쓴다. */
  readonly headerClassName?: string;
}) {
  const copy = useFieldCopy();
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{empty ?? copy.historyEmpty}</p>;
  return (
    <Table>
      <TableHeader className={headerClassName}>
        <TableRow>
          <TableHead scope="col">{labels.at}</TableHead>
          <TableHead scope="col">{labels.changes}</TableHead>
          <TableHead scope="col">{labels.actor}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>{entry.at}</TableCell>
            <TableCell className="[overflow-wrap:anywhere] whitespace-pre-line">
              {entry.changes.map((change, index) => (
                <div key={index}>{change}</div>
              ))}
            </TableCell>
            <TableCell>{entry.actor === '' ? copy.empty : entry.actor}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** 상세 묶음 부품. `<Record state={useRecord(...)}>{(data) => <Record.Fields>…</Record.Fields>}</Record>` */
export const Record = Object.assign(RecordRoot, { Fields, Field, History });
export { RetryRegion } from './ui/retry';
