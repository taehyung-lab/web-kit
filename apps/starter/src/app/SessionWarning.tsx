// 파일 책임: 경고 닫음·재노출을 프로젝트 화면 상태로 관리한다. 시간과 만료 판정은 키트가 맡는다.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { IdleTimer } from '@boosterlab/web-kit/session/idle';
import { Dialog } from '@/shared/ui/web-kit/ui/dialog';

/** 대표 탭의 경고를 표시하고 경고 탈출·문서 재표시·계정 교체 때 닫음 기록을 푼다. */
export function SessionWarning({ idle }: { readonly idle: IdleTimer }) {
  const state = useSyncExternalStore(idle.subscribe, idle.state);
  const [dismissed, setDismissed] = useState(false);
  const [seconds, setSeconds] = useState(() => Math.ceil((idle.remaining() ?? 0) / 1000));
  useEffect(() => idle.subscribeTick(() => setSeconds(Math.ceil((idle.remaining() ?? 0) / 1000))), [idle]);
  useEffect(() => {
    // 경고 상태·보이기·계정의 변화를 구독하되 매초 tick은 닫음을 바꾸지 않는다.
    const reset = () => setDismissed(false);
    let previous = idle.state();
    return idle.subscribe(() => {
      const next = idle.state();
      if (next.phase !== 'warning' || (!previous.visible && next.visible) || previous.sessionId !== next.sessionId) reset();
      previous = next;
    });
  }, [idle]);
  return (
    <Dialog open={state.phase === 'warning' && state.leader && !dismissed} title="세션 만료 안내" onClose={() => setDismissed(true)}>
      <p>남은 시간: {seconds}초</p>
      <button type="button" className="wk-button wk-button-primary" disabled={state.extending} onClick={() => void idle.extend()}>연장</button>
    </Dialog>
  );
}
