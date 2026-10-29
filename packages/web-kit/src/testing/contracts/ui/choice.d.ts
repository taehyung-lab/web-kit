// 파일 책임: 적합성 검사에 주입하는 UI의 구조 타입 계약이며 런타임 구현은 포함하지 않는다.
import { type CheckboxTreeNode } from '@boosterlab/web-kit';
export type ChoiceNode = CheckboxTreeNode;
export type ChoiceValue = string | readonly string[] | undefined;
export interface ChoiceProps {
    readonly nodes: readonly ChoiceNode[];
    readonly value: ChoiceValue;
    readonly onValueChange: (value: ChoiceValue) => void;
    readonly multiple?: boolean;
    readonly appearance?: 'vertical' | 'horizontal' | 'dropdown' | 'menu' | 'search';
    readonly label: string;
    readonly allLabel?: string;
    readonly placeholder?: string;
    /** 이 이름을 주면 단일 선택을 비우는 동작을 제공한다. placeholder와는 별개다. */
    readonly clearLabel?: string;
    /** 서버 검색의 상위 조건·언어 등. 함수 identity 대신 이 값이 바뀔 때 다시 조회한다. */
    readonly searchKey?: readonly (string | number | boolean | null | undefined)[];
    readonly disabled?: boolean;
    readonly id?: string;
    readonly 'aria-describedby'?: string;
    readonly 'aria-invalid'?: boolean;
    readonly 'aria-required'?: boolean;
    readonly onBlur?: () => void;
    /** 서버 검색은 요청 취소 신호를 받고 트리를 반환한다. 검색 결과와 선택 값은 따로 유지한다. */
    readonly search?: (text: string, signal: AbortSignal) => Promise<readonly ChoiceNode[]>;
    readonly debounceMs?: number;
    readonly messages?: {
        readonly loading?: string;
        readonly failed?: string;
        readonly retry?: string;
        readonly empty?: string;
    };
}
/** 같은 leaf 값 모델을 모든 모양에서 사용한다. 가지 ID는 저장하지 않는다. */
export declare function Choice(props: ChoiceProps): import("react").JSX.Element;
