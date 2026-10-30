// 파일 책임: 기본 대화창 세 가지(Dialog·ConfirmDialog·AlertDialog)와 그 포커스 규칙.
// 열린 직후부터 닫힐 때까지 키보드 포커스가 창 밖으로 한 순간도 나가지 않게 한다(Base UI의 focus guard 경유를 막는다).
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import type { ReactNode, RefObject } from 'react';
import { useDialogBinding, useConfirmBinding, useAcknowledgeBinding } from '@boosterlab/web-kit/dialog';
import { Pending } from './pending';

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
  const { rootProps, popupRef, popupProps } = useDialogBinding({ open, closable, onClose, returnFocus });
  return (
    <BaseDialog.Root {...rootProps}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="wk-backdrop" />
        <BaseDialog.Popup
          ref={popupRef}
          role={role}
          {...popupProps}
          className={join('wk-dialog', className)}
          aria-describedby={undefined}

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
  const binding = useConfirmBinding({ pending, onConfirm, onCancel });
  return (
    <Dialog
      open={open}
      title={title}
      role="alertdialog"
      closable={binding.closable}
      onClose={binding.cancel}
      returnFocus={returnFocus}
      footer={
        <>
          <button type="button" className="wk-button wk-button-secondary" disabled={binding.locked} onClick={binding.cancel}>
            {cancelLabel}
          </button>
          <button type="button" className="wk-button wk-button-primary" disabled={binding.locked} onClick={binding.confirm}>
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
  const binding = useAcknowledgeBinding({ open, pending, onConfirm });
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
            onClick={binding.confirm}
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

function join(...names: readonly (string | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
