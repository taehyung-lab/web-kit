// 파일 책임: 적합성 검사에 주입하는 UI의 구조 타입 계약이며 런타임 구현은 포함하지 않는다.
import { type ReactNode, type RefObject } from 'react';
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
export declare function Dialog({ open, title, children, footer, onClose, closable, closeLabel, role, returnFocus, className, }: DialogProps): import("react").JSX.Element;
/** 실행 전 확인. 실행 중(pending)에는 닫기·재실행이 막히고 버튼 옆에 진행 표시가 선다. 승인·취소의 판정은 호출자가 한다. */
export declare function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel, onConfirm, onCancel, pending, pendingLabel, returnFocus, }: {
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
}): import("react").JSX.Element;
/** 확인만 받는 알림(저장 완료 등). Esc·바깥 클릭으로 닫히지 않고, 확인을 연타해도 한 번만 알린다. */
export declare function AlertDialog({ open, title, children, confirmLabel, onConfirm, pending, pendingLabel, }: {
    readonly open: boolean;
    readonly title: ReactNode;
    readonly children?: ReactNode;
    readonly confirmLabel?: string;
    readonly onConfirm: () => void;
    /** 확인 뒤 할 일이 진행 중이면 true. 버튼이 잠기고 옆에 진행 표시가 선다. */
    readonly pending?: boolean;
    /** 진행 표시의 화면 낭독기 문구. */
    readonly pendingLabel?: string;
}): import("react").JSX.Element;
