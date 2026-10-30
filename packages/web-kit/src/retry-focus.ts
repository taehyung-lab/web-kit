// 파일 책임: 재시도 버튼이 사라진 뒤 결과 요소로 포커스를 연결한다.
import { useCallback, useLayoutEffect, useRef } from 'react';
/** 사라지는 재시도 버튼에 있던 포커스만 결과로 옮긴다. */
export function useRetryFocus(failed: boolean, controlId: string) {
  const move = useRef(false);
  const retryRef = useCallback((node: HTMLButtonElement | null) => {
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
  return { retryRef };
}
