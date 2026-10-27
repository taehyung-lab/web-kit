/** Base UI로 기본 다이얼로그의 focus·키보드·접근성 구조를 제공한다. */
import { Dialog } from '@base-ui/react/dialog';
import type { ReactNode, RefObject } from 'react';

/** 닫기 요청의 판정은 호출자가 소유하고 표현은 한 구현을 쓴다. */
export function KitDialog({
  open,
  title,
  children,
  onClose,
  closeLabel = '닫기',
  pending = false,
  role = 'dialog',
  returnFocus,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly closeLabel?: string;
  readonly pending?: boolean;
  readonly role?: 'dialog' | 'alertdialog';
  readonly returnFocus?: RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="wk-backdrop" />
        <Dialog.Popup finalFocus={returnFocus} role={role} className="wk-dialog" aria-describedby={undefined}>
          <Dialog.Title>{title}</Dialog.Title>
          {children}
          <Dialog.Close disabled={pending} className="wk-button">
            {closeLabel}
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** 기본 확인창. 승인과 계속 편집 동작은 같은 수명 소유자에 돌려준다. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
  pending = false,
  returnFocus,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly returnFocus?: RefObject<HTMLElement | null>;
  readonly children?: ReactNode;
  readonly pending?: boolean;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <KitDialog
      open={open}
      title={title}
      onClose={onCancel}
      closeLabel={cancelLabel}
      pending={pending}
      role="alertdialog"
      returnFocus={returnFocus}
    >
      <div>{children}</div>
      <button type="button" className="wk-button" disabled={pending} onClick={onConfirm}>
        {confirmLabel}
      </button>
    </KitDialog>
  );
}
