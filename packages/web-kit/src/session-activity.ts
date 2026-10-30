// 파일 책임: 선택한 사용자 조작을 감지하고 공유된 마지막 연장 시도 이후의 간격을 제한한다.
import type { IdleTimer } from './session-idle';
/** 붙인 동안만 활동 연장을 보낸다. 저장 형식과 마감 채택은 타이머가 소유한다. */
export function attachSessionActivity({ idle, intervalMs, events = ['click', 'mousedown', 'keydown', 'wheel', 'touchstart', 'popstate'] }: {
  readonly idle: IdleTimer;
  readonly intervalMs: number;
  readonly events?: readonly string[];
}): () => void {
  /** 이미 기록된 시도는 성공·실패와 무관하게 간격에 포함한다. */
  function activity() {
    const state = idle.state();
    if (state.phase !== 'active' || state.paused || state.deadline === null || state.deadlineSource === 'grace') return;
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
    const previous = idle.lastAttemptAt();
    if (previous !== null && Date.now() - previous < intervalMs) return;
    void idle.extend();
  }
  for (const event of events) window.addEventListener(event, activity, { passive: true });
  return () => { for (const event of events) window.removeEventListener(event, activity); };
}
