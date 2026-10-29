// 파일 책임: 대화창 포커스와 닫기, 확인 이벤트의 공통 연결을 제공한다.
import { useCallback, useRef, type KeyboardEvent, type RefObject } from 'react';
import { tabbable } from 'tabbable';

/** 표시·disabled·radio 그룹 규칙을 포함해 현재 Tab 대상만 고른다. */
function tabbables(root: HTMLElement): ReturnType<typeof tabbable> {
  return tabbable(root).filter((element) => !element.hasAttribute('data-base-ui-focus-guard'));
}

/**
 * Tab·Shift+Tab의 끝에서 반대쪽 끝으로 같은 이벤트 안에서 옮긴다.
 * Base UI는 끝에서 팝업 밖 guard에 포커스를 둔 뒤 다음 프레임에 되돌리므로, 그 한 프레임 동안 포커스가 창 밖에 있었다.
 */
function trapTab(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target;
  // 포털로 열린 하위 선택창과 중첩 대화창의 키보드는 해당 창이 맡는다.
  if (target instanceof HTMLElement && (!event.currentTarget.contains(target) || target.closest('[role="dialog"], [role="alertdialog"]') !== event.currentTarget)) return;
  const items = tabbables(event.currentTarget);
  if (items.length === 0) {
    event.preventDefault();
    return;
  }
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const active = document.activeElement;
  const inside = active instanceof HTMLElement && event.currentTarget.contains(active);
  if (event.shiftKey && (!inside || active === first || active === event.currentTarget)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!inside || active === last)) {
    event.preventDefault();
    first.focus();
  }
}

/** 대화창의 실제 팝업에 첫 포커스·Tab 순환·닫기 정책을 연결한다. */
export function useDialogBinding({ open, closable = true, onClose, returnFocus }: {
  readonly open: boolean; readonly closable?: boolean; readonly onClose?: () => void;
  readonly returnFocus?: RefObject<HTMLElement | null>;
}) {
  const popup = useRef<HTMLDivElement | null>(null);
  // 열리는 순간(마운트 커밋) 첫 칸에 동기로 포커스한다. Base UI의 첫 포커스는 다음 프레임이라 그 사이 Tab이 창 밖에서 시작했다.
  const attach = useCallback((node: HTMLDivElement | null) => {
    popup.current = node;
    if (node === null || node.contains(document.activeElement)) return;
    (tabbables(node)[0] ?? node).focus();
  }, []);
  return {
    rootProps: { open, disablePointerDismissal: !closable, onOpenChange: (next: boolean) => { if (!next && closable) onClose?.(); } },
    popupRef: attach,
    popupProps: {
      tabIndex: -1,
      initialFocus: () => {
        if (popup.current === null) return true;
        (tabbables(popup.current)[0] ?? popup.current).focus();
        return false;
      },
      finalFocus: returnFocus ?? true,
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        trapTab(event);
        if (event.key === 'Escape' && !closable) event.preventDefault();
      },
    },
  };
}

/** 실행 중 확인·취소 이벤트를 차단한다. 실행 수명은 호출한 상태 소유자가 맡는다. */
export function useConfirmBinding({ pending = false, onConfirm, onCancel }: {
  readonly pending?: boolean; readonly onConfirm: () => void; readonly onCancel: () => void;
}) {
  const confirming = useRef(false);
  return { locked: pending, closable: !pending,
    confirm: () => {
      if (pending || confirming.current) return;
      confirming.current = true;
      try { onConfirm(); } finally { queueMicrotask(() => { confirming.current = false; }); }
    },
    cancel: () => { if (!pending) onCancel(); },
  };
}

/** 열림 주기마다 한 번만 확인하고 실행 중 확인은 차단한다. */
export function useAcknowledgeBinding({ open, pending = false, onConfirm }: {
  readonly open: boolean; readonly pending?: boolean; readonly onConfirm: () => void;
}) {
  const done = useRef(false);
  if (!open) done.current = false;
  return { confirm: () => {
    if (pending || done.current) return;
    done.current = true;
    onConfirm();
  } };
}
