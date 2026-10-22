/** 확인 대상과 실행 상태를 소유하고 오류 정책·다이얼로그 표현은 프로젝트에 맡긴다. */
import { useRef, useState } from "react";
import { useSubmissionLifecycle } from "./useSubmissionLifecycle";

type ConfirmationState<T, F> =
  | { readonly kind: "closed" }
  | {
      readonly kind: "open";
      readonly values: T;
      readonly pending: boolean;
      readonly failure: F | undefined;
    };

/** 확인 → 실행 → 닫기/재시도를 한 수명으로 관리한다. */
export function useConfirmationState<T, F>({
  run,
  onError,
}: {
  readonly run: (values: T) => void | Promise<unknown>;
  readonly onError: (
    error: unknown,
  ) =>
    | { readonly kind: "close" }
    | { readonly kind: "show"; readonly failure: F };
}) {
  const [state, setState] = useState<ConfirmationState<T, F>>({
    kind: "closed",
  });
  const current = useRef(state);
  const lifecycle = useSubmissionLifecycle();
  /** 렌더 전 연속 호출도 최신 확인 대상을 관찰하게 한다. */
  function update(next: ConfirmationState<T, F>) {
    current.current = next;
    setState(next);
  }
  /** 실행 전 대상만 교체할 수 있다. */
  function request(values: T) {
    if (!lifecycle.isActive() || lifecycle.isRunning()) return;
    update({ kind: "open", values, pending: false, failure: undefined });
  }
  /** 실행 중에는 취소할 수 없다. */
  function close() {
    if (lifecycle.isActive() && !lifecycle.isRunning())
      update({ kind: "closed" });
  }
  /** 성공은 닫고 실패는 프로젝트가 분류한 표면에 남긴다. */
  async function confirm() {
    const requested = current.current;
    if (requested.kind !== "open" || requested.pending) return;
    await lifecycle.run(async () => {
      const { values } = requested;
      update({ kind: "open", values, pending: true, failure: undefined });
      try {
        await run(values);
        if (lifecycle.isActive()) update({ kind: "closed" });
      } catch (error: unknown) {
        if (!lifecycle.isActive()) return;
        const result = onError(error);
        update(
          result.kind === "close"
            ? { kind: "closed" }
            : { kind: "open", values, pending: false, failure: result.failure },
        );
      }
    });
  }
  return { state, request, close, confirm };
}
