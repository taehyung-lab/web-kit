/** 확인 대상과 실행 상태를 소유하고 오류 정책·다이얼로그 표현은 프로젝트에 맡긴다. */
import { useLayoutEffect, useRef, useState } from "react";
import { useFullPageProgress } from "./full-page-progress";
import { useLifetime, useVisit } from "./lifetime";

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
 * `progress: 'delete'`면 실행하는 동안 화면 전체 진행 덮개(registry FullPageProgress)를 삭제 문구로 띄우고 `covered`가 true다.
 * 그동안 확인창은 그리지 않는다(확인창 → 덮개 → 이동, 실패하면 덮개가 닫히고 확인창이 실패 문구와 함께 다시 보인다).
 * 실행 수명(lifetime.ts)을 따른다: 방문이 바뀌면 열린 확인을 닫고 늦은 완료 처리·실패 표시를 하지 않는다(이미 보낸 실행은 끝까지 간다).
 * 실행 실패는 앱에 먼저 알리고, 앱이 직접 알렸으면('handled') onError를 부르지 않고 닫는다.
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
  const lifetime = useLifetime();
  const visit = useVisit();
  const seenVisit = useRef(visit);
  useLayoutEffect(() => {
    latest.current = { run, onError, onSuccess };
    // 대상이 바뀌거나 방문이 끝나면(앱이 leave로 알린 순간 주소는 이미 바뀌었다) 열린 확인·진행 표시·완료 기록을 모두 버린다.
    // 이미 보낸 실행은 끝까지 가지만 결과는 이 부품에 돌아오지 않고, 새 방문은 곧바로 새 확인을 열 수 있다.
    if (
      !Object.is(scope.current.identity, identity) ||
      seenVisit.current !== visit
    ) {
      seenVisit.current = visit;
      scope.current = { identity, generation: scope.current.generation + 1 };
      committed.current = undefined;
      current.current = { kind: "closed" };
      setState(current.current);
    }
  }, [identity, visit, run, onError, onSuccess]);
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
    const execution = lifetime.begin("action");
    /** 결과를 이 창에 전달해도 되는가: 아직 현재 확인이고, 시작한 방문·로그인이 그대로다. */
    const isCurrent = () =>
      mounted.current &&
      scope.current.generation === generation &&
      execution.here();
    const callbacks = latest.current;
    // 요청(run) 단계인가. 완료 처리(onSuccess) 단계의 실패는 요청 실패가 아니라 이 창이 다시 시도하게 한다.
    let requesting = false;
    update({ ...requested, pending: true, failure: undefined });
    try {
      if (committed.current === undefined) {
        requesting = true;
        const result = await callbacks.run(requested.values);
        requesting = false;
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
      const shown = isCurrent();
      // 요청의 실패는 앱에 먼저 알린다. 화면을 떠났으면 그 자리가 없으므로 알리기만 한다.
      const answer = requesting ? execution.fail(error, shown) : "local";
      if (!shown) return;
      if (answer === "handled") {
        update({ kind: "closed" });
        return;
      }
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
  // 전환 렌더에서는 이전 대상·이전 방문의 창을 노출하지 않는다. ref 변경은 commit에서만 한다.
  const visibleState: ConfirmationState<T, F> =
    Object.is(scope.current.identity, identity) && seenVisit.current === visit
      ? state
      : { kind: "closed" };
  const covered =
    progress !== undefined &&
    visibleState.kind === "open" &&
    visibleState.pending &&
    !visibleState.completed;
  useFullPageProgress(progress ?? "delete", covered);
  return { state: visibleState, covered, request, close, confirm };
}

export {
  useDialogBinding,
  useConfirmBinding,
  useAcknowledgeBinding,
} from "./dialog-binding";
