// 파일 책임: 적합성 검사에 주입하는 UI의 구조 타입 계약이며 런타임 구현은 포함하지 않는다.
/** 필드의 라벨·설명·오류 접근성 구조를 렌더한다. 번역·필수 판정·스타일은 소비자가 제공한다. */
import type { ReactNode } from "react";
export interface FieldControlProps {
    readonly id: string;
    readonly "aria-describedby"?: string;
    readonly "aria-invalid": boolean;
}
/** 설명과 첫 표시 오류를 입력에 연결하고 오류 슬롯을 제공한다. */
export declare function FieldFeedback({ id, message, describedBy, errorClassName, children, }: {
    readonly id: string;
    readonly message?: string;
    readonly describedBy?: readonly string[];
    readonly errorClassName: string;
    readonly children: (control: FieldControlProps, error: ReactNode) => ReactNode;
}): ReactNode;
/** 단일 입력/묶음 라벨과 설명 위치를 유지하면서 공통 오류 슬롯으로 연결한다. */
export declare function FieldFrame({ id, label, required, description, descriptionPosition, labelTarget, message, classes, children, }: {
    readonly id: string;
    readonly label: string;
    readonly required: boolean;
    readonly description?: string;
    readonly descriptionPosition?: "afterLabel" | "afterControl";
    readonly labelTarget?: "control" | "group";
    readonly message?: string;
    readonly classes: {
        readonly root: string;
        readonly label: string;
        readonly required: string;
        readonly description: string;
        readonly error: string;
    };
    readonly children: (control: FieldControlProps, labelId: string) => ReactNode;
}): import("react").JSX.Element;
