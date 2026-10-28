// 파일 책임: 기본 대화창 세 가지(Dialog·ConfirmDialog·AlertDialog)와 그 포커스 규칙.
// 열린 직후부터 닫힐 때까지 키보드 포커스가 창 밖으로 한 순간도 나가지 않게 한다(Base UI의 focus guard 경유를 막는다).
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { useCallback, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

const TABBABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** 창 안에서 Tab으로 갈 수 있는 요소를 문서 순서로 고른다(숨김·guard 제외). */
function tabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (element) =>
      !element.hasAttribute('data-base-ui-focus-guard') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      !element.closest('[hidden],[inert]'),
  );
}

/**
 * Tab·Shift+Tab의 끝에서 반대쪽 끝으로 같은 이벤트 안에서 옮긴다.
 * Base UI는 끝에서 팝업 밖 guard에 포커스를 둔 뒤 다음 프레임에 되돌리므로, 그 한 프레임 동안 포커스가 창 밖에 있었다.
 */
function trapTab(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab' || event.defaultPrevented) return;
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

export interface DialogProps {
  readonly open: boolean;
  readonly title: ReactNode;
  readonly children?: ReactNode;
  /** 창 아래 버튼 자리. */
  readonly footer?: ReactNode;
  /** 닫기 요청(Esc·바깥 클릭·닫기 버튼). 판정은 호출자가 한다. */
  readonly onClose?: () => void;
  /** false면 Esc·바깥 클릭·닫기 버튼으로 닫히지 않는다(확인만 받는 알림, 실행 중). */
  readonly closable?: boolean;
  readonly closeLabel?: string;
  readonly role?: 'dialog' | 'alertdialog';
  /** 닫힌 뒤 포커스를 돌려줄 요소. 없으면 연 요소로 돌아간다. */
  readonly returnFocus?: RefObject<HTMLElement | null>;
  readonly className?: string;
}

/** 기본 대화창. 열리면 첫 입력·버튼에 바로 포커스하고 Tab 순환을 창 안에 가둔다. */
export function Dialog({
  open,
  title,
  children,
  footer,
  onClose,
  closable = true,
  closeLabel = '닫기',
  role = 'dialog',
  returnFocus,
  className,
}: DialogProps) {
  const popup = useRef<HTMLDivElement | null>(null);
  // 열리는 순간(마운트 커밋) 첫 칸에 동기로 포커스한다. Base UI의 첫 포커스는 다음 프레임이라 그 사이 Tab이 창 밖에서 시작했다.
  const attach = useCallback((node: HTMLDivElement | null) => {
    popup.current = node;
    if (node === null || node.contains(document.activeElement)) return;
    (tabbables(node)[0] ?? node).focus();
  }, []);
  return (
    <BaseDialog.Root
      open={open}
      disablePointerDismissal={!closable}
      onOpenChange={(next) => {
        if (!next && closable) onClose?.();
      }}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="wk-backdrop" />
        <BaseDialog.Popup
          ref={attach}
          role={role}
          tabIndex={-1}
          className={join('wk-dialog', className)}
          aria-describedby={undefined}
          initialFocus={() => (popup.current === null ? true : (tabbables(popup.current)[0] ?? popup.current))}
          finalFocus={returnFocus ?? true}
          onKeyDown={(event) => {
            trapTab(event);
            // Base UI는 Esc를 막지 않으면 닫기 요청으로 보낸다. 닫을 수 없는 창은 여기서 멈춘다.
            if (event.key === 'Escape' && !closable) event.preventDefault();
          }}
        >
          <BaseDialog.Title className="wk-dialog-title">{title}</BaseDialog.Title>
          {children === undefined ? null : <div className="wk-dialog-body">{children}</div>}
          {footer === undefined && !closable ? null : (
            <div className="wk-dialog-footer">
              {footer}
              {closable && footer === undefined ? (
                <BaseDialog.Close className="wk-button wk-button-secondary">{closeLabel}</BaseDialog.Close>
              ) : null}
            </div>
          )}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

/** 실행 전 확인. 실행 중(pending)에는 닫기·재실행이 막히고 버튼 옆에 진행 표시가 선다. 승인·취소의 판정은 호출자가 한다. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
  pending = false,
  pendingLabel = '처리 중입니다.',
  returnFocus,
}: {
  readonly open: boolean;
  readonly title: ReactNode;
  readonly children?: ReactNode;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly pending?: boolean;
  /** 실행 중 표시의 화면 낭독기 문구. */
  readonly pendingLabel?: string;
  readonly returnFocus?: RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      role="alertdialog"
      closable={!pending}
      onClose={onCancel}
      returnFocus={returnFocus}
      footer={
        <>
          <button type="button" className="wk-button wk-button-secondary" disabled={pending} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="wk-button wk-button-primary" disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </button>
          {pending ? <Pending label={pendingLabel} /> : null}
        </>
      }
    >
      {children}
    </Dialog>
  );
}

/** 확인만 받는 알림(저장 완료 등). Esc·바깥 클릭으로 닫히지 않고, 확인을 연타해도 한 번만 알린다. */
export function AlertDialog({
  open,
  title,
  children,
  confirmLabel = '확인',
  onConfirm,
  pending = false,
  pendingLabel = '처리 중입니다.',
}: {
  readonly open: boolean;
  readonly title: ReactNode;
  readonly children?: ReactNode;
  readonly confirmLabel?: string;
  readonly onConfirm: () => void;
  /** 확인 뒤 할 일이 진행 중이면 true. 버튼이 잠기고 옆에 진행 표시가 선다. */
  readonly pending?: boolean;
  /** 진행 표시의 화면 낭독기 문구. */
  readonly pendingLabel?: string;
}) {
  const done = useRef(false);
  if (!open) done.current = false;
  return (
    <Dialog
      open={open}
      title={title}
      role="alertdialog"
      closable={false}
      footer={
        <>
          <button
            type="button"
            className="wk-button wk-button-primary"
            aria-disabled={pending || undefined}
            onClick={() => {
              if (pending || done.current) return;
              done.current = true;
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
          {pending ? <Pending label={pendingLabel} /> : null}
        </>
      }
    >
      {children}
    </Dialog>
  );
}

/** 진행 중 표시: 버튼 옆 회전 표시와 화면 낭독기용 문구(목록 다운로드·폼 저장과 같은 마크업). */
export function Pending({ label }: { readonly label: string }) {
  return (
    <span role="status" className="wk-spinner">
      <span className="wk-visually-hidden">{label}</span>
    </span>
  );
}

function join(...names: readonly (string | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
