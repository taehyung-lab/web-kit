/** 실패 자리의 다시 시도 버튼이 사라질 때만 결과로 focus를 옮긴다. */
import type { ReactNode } from 'react';
import { useRetryFocus } from '../retry-focus';
/** 재시도 전에 다른 곳으로 이동한 focus는 빼앗지 않는다. */
export function RetryRegion({
  failed,
  message,
  onRetry,
  controlId,
  children,
  retryLabel = '다시 시도',
}: {
  readonly failed: boolean;
  readonly message?: ReactNode;
  readonly onRetry: () => void;
  readonly controlId: string;
  readonly children: ReactNode;
  readonly retryLabel?: string;
}) {
  const { retryRef } = useRetryFocus(failed, controlId);
  if (!failed) return children;
  return (
    <div role="alert">
      {message}
      <button type="button" ref={retryRef} className="wk-button" onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  );
}
