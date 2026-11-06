// 파일 책임: 기본 대화창 세 가지(Dialog·ConfirmDialog·AlertDialog)와 그 포커스 규칙.
// 열린 직후부터 닫힐 때까지 키보드 포커스가 창 밖으로 한 순간도 나가지 않게 한다(Base UI의 focus guard 경유를 막는다).
// 창·버튼 모양은 프로젝트의 shadcn Dialog·Button이 정하고, 여기서는 열림·닫기 정책·포커스·잠금 연결만 맡는다.
// 버튼 기본 문구(닫기·확인·취소·처리 중)는 앱 맨 위의 DialogDefaults 한 곳에서 받는다. 화면이 준 문구는 그 창에서만 앞선다.
import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import { useDialogBinding, useConfirmBinding, useAcknowledgeBinding } from '@boosterlab/web-kit/dialog';
import { Button } from '@/shared/ui/button';
import { Dialog as DialogRoot, DialogClose, DialogContent, DialogFooter, DialogTitle } from '@/shared/ui/dialog';
import { Pending } from './pending';

/** 대화창 버튼의 앱 기본 문구. pending은 실행 중 진행 표시를 화면 낭독기가 읽는 문구다. */
export interface DialogLabels {
  readonly close: string;
  readonly confirm: string;
  readonly cancel: string;
  readonly pending: string;
}

/** 키트가 제공하는 한국어 문구. 한국어 앱은 이 값을 DialogDefaults에 그대로 넘긴다(공급이 없으면 한국어로 떨어지지 않고 오류가 난다). */
export const defaultDialogLabels: DialogLabels = {
  close: '닫기',
  confirm: '확인',
  cancel: '취소',
  pending: '처리 중입니다.',
};

const DialogLabelsContext = createContext<DialogLabels | undefined>(undefined);

/**
 * 앱 맨 위에 한 번 두고 대화창 기본 문구 전체를 넘긴다. 이 아래의 Dialog·ConfirmDialog·AlertDialog(폼·목록이 그리는 창 포함)가 이 문구를 쓴다.
 * 폼 기본 문구(FormDefaults)와 따로 두어, 폼 없이 대화창만 설치한 앱도 이것만으로 쓴다.
 */
export function DialogDefaults({ labels, children }: { readonly labels: DialogLabels; readonly children: ReactNode }) {
  return <DialogLabelsContext.Provider value={labels}>{children}</DialogLabelsContext.Provider>;
}

/** 앱 기본 문구를 읽는다. 공급이 없으면 조용히 다른 언어로 그리지 않고 바로 오류로 알린다. */
function useDialogLabels(part: string): DialogLabels {
  const labels = useContext(DialogLabelsContext);
  if (labels === undefined) throw new Error(`<${part}> requires <DialogDefaults labels> above it`);
  return labels;
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
  closeLabel,
  role = 'dialog',
  returnFocus,
  className,
}: DialogProps) {
  const labels = useDialogLabels('Dialog');
  const { rootProps, popupRef, popupProps } = useDialogBinding({ open, closable, onClose, returnFocus });
  return (
    <DialogRoot {...rootProps}>
      {/* 닫기 버튼은 아래 버튼 자리 하나로만 둔다(shadcn 기본 모서리 닫기 버튼을 끈다). 첫 포커스 순서가 창 안 내용부터 시작한다. */}
      <DialogContent
        ref={popupRef}
        role={role}
        {...popupProps}
        showCloseButton={false}
        className={className}
        aria-describedby={undefined}
      >
        <DialogTitle>{title}</DialogTitle>
        {children === undefined ? null : <div data-slot="dialog-body" className="grid gap-3">{children}</div>}
        {footer === undefined && !closable ? null : (
          <DialogFooter className="items-center">
            {footer}
            {closable && footer === undefined ? <DialogClose render={<Button variant="outline" />}>{closeLabel ?? labels.close}</DialogClose> : null}
          </DialogFooter>
        )}
      </DialogContent>
    </DialogRoot>
  );
}

/** 실행 전 확인. 실행 중(pending)에는 닫기·재실행이 막히고 버튼 옆에 진행 표시가 선다. 승인·취소의 판정은 호출자가 한다. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  pending = false,
  pendingLabel,
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
  const labels = useDialogLabels('ConfirmDialog');
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
          <Button type="button" variant="outline" disabled={binding.locked} onClick={binding.cancel}>
            {cancelLabel ?? labels.cancel}
          </Button>
          <Button type="button" disabled={binding.locked} onClick={binding.confirm}>
            {confirmLabel ?? labels.confirm}
          </Button>
          {pending ? <Pending label={pendingLabel ?? labels.pending} /> : null}
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
  confirmLabel,
  onConfirm,
  pending = false,
  pendingLabel,
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
  const labels = useDialogLabels('AlertDialog');
  const binding = useAcknowledgeBinding({ open, pending, onConfirm });
  return (
    <Dialog
      open={open}
      title={title}
      role="alertdialog"
      closable={false}
      footer={
        <>
          {/* 잠금은 aria-disabled로 한다. disabled면 포커스가 창 밖으로 떨어진다. */}
          <Button type="button" aria-disabled={pending || undefined} onClick={binding.confirm}>
            {confirmLabel ?? labels.confirm}
          </Button>
          {pending ? <Pending label={pendingLabel ?? labels.pending} /> : null}
        </>
      }
    >
      {children}
    </Dialog>
  );
}
