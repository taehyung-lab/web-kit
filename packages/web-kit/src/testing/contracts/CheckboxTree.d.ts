// 파일 책임: 적합성 검사에 주입하는 UI의 구조 타입 계약이며 런타임 구현은 포함하지 않는다.
import type { ReactNode } from 'react';
import { type CheckboxTreeNode } from '@boosterlab/web-kit';
export interface TreeStyles {
    readonly root?: string;
    readonly list?: string;
    readonly item?: string;
    readonly children?: string;
    readonly label?: string;
    readonly separator?: string;
}
export interface TreeControl {
    readonly label: string;
    readonly checked: boolean;
    readonly mixed?: boolean;
    readonly toggle: () => void;
}
/** 명시적인 leaf 선택을 렌더한다. 부모·전체는 모든 leaf 선택 시 체크, 일부 선택 시 mixed다. */
export declare function CheckboxTree<T extends string>({ nodes, values, onValueChange, selectAllLabel, renderCheckbox, styles, id, labelledBy, describedBy, invalid, onBlur, }: {
    readonly nodes: readonly CheckboxTreeNode<T>[];
    readonly values: readonly T[];
    readonly onValueChange: (values: T[]) => void;
    readonly selectAllLabel?: string;
    readonly renderCheckbox: (control: TreeControl) => ReactNode;
    readonly styles?: TreeStyles;
    readonly id?: string;
    readonly labelledBy?: string;
    readonly describedBy?: string;
    readonly invalid?: boolean;
    readonly onBlur?: () => void;
}): import("react").JSX.Element;
