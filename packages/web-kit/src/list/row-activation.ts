/** 표 렌더러와 무관하게 행 활성화와 내부 입력의 이벤트 경계를 관리한다. */
import type { KeyboardEvent, MouseEvent } from "react";

/** 소비자가 정한 키와 내부 입력 selector로 행 이동을 제한한다. */
export function activateTableRow(
  event: MouseEvent | KeyboardEvent,
  activate: (() => void) | undefined,
  policy: {
    readonly keys: readonly string[];
    readonly interactiveSelector: string;
  },
): void {
  if (activate === undefined) return;
  if (
    event.target instanceof Element &&
    event.target.closest(policy.interactiveSelector) !== null
  )
    return;
  if ("key" in event) {
    if (!policy.keys.includes(event.key)) return;
    event.preventDefault();
  }
  activate();
}
