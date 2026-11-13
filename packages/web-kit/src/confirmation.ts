/** 확인 대상과 실행 상태를 소유하고 오류 정책·다이얼로그 표현은 프로젝트에 맡긴다. */
import { useLayoutEffect, useRef, useState } from "react";
import { useBlockingProgress } from "./progress";

type ConfirmationState<T, F> =
  | { readonly kind: "closed" }
  | {
      readonly kind: "open";
      readonly values: T;
      readonly pending: boolean;
      readonly failure: F | undefined;
      readonly completed?: boolean;
    };

/**
 * 확인 → 실행 → 닫기/재시도를 한 수명으로 관리한다.
 * `progress: 'delete'`면 실행하는 동안 화면 전체 진행 덮개(`/ui` BlockingProgress)를 삭제 문구로 띄우고 `covered`가 true다.
 * 그동안 확인창은 그리지 않는다(확인창 → 덮개 → 이동, 실패하면 덮개가 닫히고 확인창이 실패 문구와 함께 다시 보인다).
 */
export function useConfirmationState<T, F, R = unknown>({
  run,
  onError,
  progress,
  identity,
  onSuccess,
}: {
  readonly progress?: "delete";
  /** 대상이 바뀌면 이전 확인과 늦은 완료 처리를 무효화한다. */
  readonly identity?: unknown;
  readonly run: (values: T) => R | Promise<R>;
  /** 요청 성공 뒤 처리. 실패하면 이 단계만 다시 실행하며 요청은 재전송하지 않는다. */
  readonly onSuccess?: (
    result: R,
    step: { readonly isCurrent: () => boolean },
  ) => unknown | Promise<unknown>;
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
  const mounted = useRef(false);
  const scope = useRef({ identity, generation: 0 });
  const committed = useRef<
    { values: T; result: R; complete: typeof onSuccess } | undefined
  >(undefined);
  const latest = useRef({ run, onError, onSuccess });
  useLayoutEffect(() => {
    latest.current = { run, onError, onSuccess };
    if (!Object.is(scope.current.identity, identity)) {
      scope.current = { identity, generation: scope.current.generation + 1 };
      committed.current = undefined;
      current.current = { kind: "closed" };
      setState(current.current);
    }
  }, [identity, run, onError, onSuccess]);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      scope.current.generation++;
    };
  }, []);
  function isPending() {
    return current.current.kind === "open" && current.current.pending;
  }
  function update(next: ConfirmationState<T, F>) {
    current.current = next;
    setState(next);
  }
  function request(values: T) {
    if (isPending()) return;
    scope.current.generation++;
    if (
      committed.current !== undefined &&
      !Object.is(committed.current.values, values)
    )
      committed.current = undefined;
    update({
      kind: "open",
      values,
      pending: false,
      failure: undefined,
      ...(committed.current === undefined ? {} : { completed: true }),
    });
  }
  function close() {
    if (isPending()) return;
    scope.current.generation++;
    // 후속 처리 실패를 닫아도 같은 대상의 완료 기록은 남긴다.
    update({ kind: "closed" });
  }
  async function confirm() {
    const requested = current.current;
    if (requested.kind !== "open" || requested.pending) return;
    const generation = scope.current.generation;
    const isCurrent = () =>
      mounted.current && scope.current.generation === generation;
    const callbacks = latest.current;
    update({ ...requested, pending: true, failure: undefined });
    try {
      if (committed.current === undefined) {
        const result = await callbacks.run(requested.values);
        if (!isCurrent()) return;
        committed.current = {
          values: requested.values,
          result,
          complete: callbacks.onSuccess,
        };
      }
      const saved = committed.current;
      await saved.complete?.(saved.result, { isCurrent });
      if (isCurrent()) {
        committed.current = undefined;
        update({ kind: "closed" });
      }
    } catch (error: unknown) {
      if (!isCurrent()) return;
      const result = callbacks.onError(error);
      if (!isCurrent()) return;
      if (result.kind === "close") {
        update({ kind: "closed" });
      } else
        update({
          kind: "open",
          values: requested.values,
          pending: false,
          failure: result.failure,
          ...(committed.current === undefined ? {} : { completed: true }),
        });
    }
  }
  // 전환 렌더에서는 이전 대상의 창을 노출하지 않는다. ref 변경은 commit에서만 한다.
  const visibleState: ConfirmationState<T, F> = Object.is(
    scope.current.identity,
    identity,
  )
    ? state
    : { kind: "closed" };
  const covered =
    progress !== undefined &&
    visibleState.kind === "open" &&
    visibleState.pending &&
    !visibleState.completed;
  useBlockingProgress(progress ?? "delete", covered);
  return { state: visibleState, covered, request, close, confirm };
}

export {
  useDialogBinding,
  useConfirmBinding,
  useAcknowledgeBinding,
} from "./dialog-binding";
export {
  useBlockingProgressBinding,
  BlockingProgressProvider,
  useBlockingProgress,
} from "./progress";
export type { BlockingKind } from "./progress";
