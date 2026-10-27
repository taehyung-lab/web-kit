/** 실패 자리의 다시 시도 버튼이 사라질 때만 결과로 focus를 옮긴다. */
import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
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
  const move = useRef(false);
  const ref = useCallback((node: HTMLButtonElement | null) => {
    if (node === null) return;
    return () => {
      move.current = document.activeElement === node;
    };
  }, []);
  useLayoutEffect(() => {
    if (!failed && move.current) {
      move.current = false;
      document.getElementById(controlId)?.focus();
    }
  }, [failed, controlId]);
  if (!failed) return children;
  return (
    <div role="alert">
      {message}
      <button type="button" ref={ref} className="wk-button" onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  );
}
