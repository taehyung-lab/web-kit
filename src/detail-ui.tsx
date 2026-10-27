/** 단건 상태·상세 항목·이미 해석된 이력을 기본 표현으로 연결한다. */
import { useId, type ReactNode } from 'react';
import type { RecordState } from './record';
import { RetryRegion } from './ui/retry';
export { RetryRegion } from './ui/retry';
export { DetailField } from './DetailField';

/** 단건 오류와 재조회를 같은 기본 화면 구조로 표시한다. */
export function RecordView<T>({
  state,
  children,
  missingAction,
  renderFailure,
  messages,
}: {
  readonly state: RecordState<T>;
  readonly children: (value: T) => ReactNode;
  readonly missingAction?: () => ReactNode;
  readonly renderFailure?: (failure: unknown) => ReactNode;
  readonly messages?: Partial<{ loading: string; retry: string; refreshFailed: string }>;
}) {
  const id = useId();
  const copy = { loading: '불러오는 중입니다.', retry: '다시 시도', refreshFailed: '새로 고침에 실패했습니다.', ...messages };
  if (state.kind === 'missing')
    return (
      <div role="alert">
        <p>{renderFailure?.(state.failure) ?? '항목이 없거나 접근할 수 없습니다.'}</p>
        {missingAction?.()}
      </div>
    );
  return (
    <RetryRegion
      failed={state.kind === 'failed'}
      message={state.kind === 'failed' ? (renderFailure?.(state.failure) ?? '항목을 불러오지 못했습니다.') : undefined}
      onRetry={state.kind === 'failed' ? state.retry : () => undefined}
      controlId={id}
      retryLabel={copy.retry}
    >
      {state.kind === 'pending' ? (
        <p role="status">{copy.loading}</p>
      ) : state.kind === 'ready' ? (
        <section id={id} tabIndex={-1} aria-busy={state.refresh.refreshing}>
          {state.refresh.failure !== undefined && (
            <div role="alert">
              {copy.refreshFailed}
              <button type="button" className="wk-button" onClick={state.refresh.retry}>
                {copy.retry}
              </button>
            </div>
          )}
          {children(state.data)}
        </section>
      ) : null}
    </RetryRegion>
  );
}
/** 업무가 해석한 시간·수정자·변경 내용을 순서대로 표시한다. */
export function HistoryList({
  items,
  emptyLabel = '변경 이력이 없습니다.',
}: {
  readonly items: readonly {
    readonly id: string;
    readonly at: ReactNode;
    readonly actor: ReactNode;
    readonly changes: readonly ReactNode[];
  }[];
  readonly emptyLabel?: string;
}) {
  if (items.length === 0) return <p>{emptyLabel}</p>;
  return (
    <ol className="wk-history">
      {items.map((item) => (
        <li key={item.id}>
          <div>
            {item.at} · {item.actor}
          </div>
          <ul>
            {item.changes.map((change, index) => (
              <li key={index}>{change}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
