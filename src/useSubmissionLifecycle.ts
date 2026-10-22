/** 제출의 즉시 잠금과 화면 수명에 묶인 오류 포커스 예약을 관리한다. */
import { useEffect, useMemo, useRef } from "react";

/** 폼·확인창에서 같은 실행/해제 경계를 사용한다. 기준선과 실제 작업은 호출자가 소유한다. */
export function useSubmissionLifecycle() {
  const active = useRef(false);
  const running = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lifecycle = useMemo(
    () => ({
      isActive: () => active.current,
      isRunning: () => running.current,
      /** 이전 오류 포커스를 취소한다. */
      cancelFocus() {
        clearTimeout(timer.current);
        timer.current = undefined;
      },
      /** disabled가 풀린 다음 작업에서 첫 오류 입력에 포커스한다. */
      scheduleFocus(focus: () => void) {
        lifecycle.cancelFocus();
        if (!active.current) return;
        timer.current = setTimeout(() => {
          timer.current = undefined;
          if (active.current) focus();
        }, 0);
      },
      /** 같은 tick의 재진입도 막고, 성공/실패 모두 잠금을 해제한다. */
      async run(task: () => void | Promise<unknown>) {
        if (!active.current || running.current) return;
        running.current = true;
        lifecycle.cancelFocus();
        try {
          await task();
        } finally {
          running.current = false;
        }
      },
    }),
    [],
  );
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      lifecycle.cancelFocus();
    };
  }, [lifecycle]);
  return lifecycle;
}
