// 파일 책임: 상세 기본 UI의 묶음 부품(Record.*). useRecord가 판정한 네 상태(대기·없음·실패·준비됨)와 갱신 실패를 그리고,
// 준비된 내용은 Record.Fields·Field·History로 배치한다. 문구·앱 경계 무표시는 프로젝트가 renderFailure·missing 값으로 정한다.
import { createContext, useContext, useId, type ReactNode } from 'react';
import type { RecordState } from '@boosterlab/web-kit/record';
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

const MessagesContext = createContext<RecordMessages>(defaultMessages);

/**
 * 단건 하나의 상태를 그린다. 준비됨일 때만 children(data)을 그리고, 식별 전환·없음·실패는 useRecord 판정을 그대로 따른다.
 * missing은 없음 안내(무엇이 없는지와 돌아갈 길)다. 재조회 실패는 내용을 지우지 않고 위에 알린다.
 */
function RecordRoot<T>({
  state,
  children,
  missing,
  renderFailure = () => undefined,
  messages,
}: {
  readonly state: RecordState<T>;
  readonly children: (data: T) => ReactNode;
  readonly missing?: ReactNode;
  readonly renderFailure?: RenderRecordFailure;
  readonly messages?: Partial<RecordMessages>;
}) {
  const id = useId();
  const copy = { ...defaultMessages, ...messages };
  let body: ReactNode;
  if (state.kind === 'missing') {
    const text = renderFailure(state.failure, 'missing');
    body =
      text === null ? null : (
        <div role="status" className="wk-record-missing">
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
            <p role="status" className="wk-record-loading">
              {copy.loading}
            </p>
          ) : state.kind === 'ready' ? (
            <section id={id} tabIndex={-1} aria-busy={state.refresh.refreshing} className="wk-record">
              {state.refresh.failure !== undefined && refreshText !== null ? (
                <div role="alert" className="wk-record-refresh-failed">
                  {refreshText ?? copy.refreshFailed}
                  <button type="button" className="wk-button wk-button-ghost" onClick={state.refresh.retry}>
                    {copy.retry}
                  </button>
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
  return <dl className={['wk-record-fields', className].filter(Boolean).join(' ')}>{children}</dl>;
}

/** 라벨·값 한 칸. null·undefined·''만 빈 값 표시('-')이고 0은 그대로 보인다. 값의 의미·마스킹·포맷은 프로젝트가 정한다. */
function Field({ label, children }: { readonly label: ReactNode; readonly children?: ReactNode }) {
  const copy = useContext(MessagesContext);
  const empty = children === null || children === undefined || children === '' || children === false;
  return (
    <div className="wk-record-field">
      <dt className="wk-record-label">{label}</dt>
      <dd className="wk-record-value">{empty ? copy.empty : children}</dd>
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
}: {
  readonly entries: readonly RecordHistoryEntry[];
  readonly labels: { readonly at: ReactNode; readonly changes: ReactNode; readonly actor: ReactNode };
  readonly empty?: ReactNode;
}) {
  const copy = useContext(MessagesContext);
  if (entries.length === 0) return <p className="wk-record-history-empty">{empty ?? copy.historyEmpty}</p>;
  return (
    <table className="wk-table wk-record-history">
      <thead>
        <tr>
          <th scope="col">{labels.at}</th>
          <th scope="col">{labels.changes}</th>
          <th scope="col">{labels.actor}</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td>{entry.at}</td>
            <td className="wk-record-changes">
              {entry.changes.map((change, index) => (
                <div key={index}>{change}</div>
              ))}
            </td>
            <td>{entry.actor === '' ? copy.empty : entry.actor}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 상세 묶음 부품. `<Record state={useRecord(...)}>{(data) => <Record.Fields>…</Record.Fields>}</Record>` */
export const Record = Object.assign(RecordRoot, { Fields, Field, History });
export { RetryRegion } from './ui/retry';
