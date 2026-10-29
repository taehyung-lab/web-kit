// 파일 책임: 적합성 검사에 주입하는 UI의 구조 타입 계약이며 런타임 구현은 포함하지 않는다.
import { type ReactNode } from 'react';
import type { RecordState } from '@boosterlab/web-kit/record';
declare const defaultMessages: {
    loading: string;
    failed: string;
    missing: string;
    refreshFailed: string;
    retry: string;
    empty: string;
    historyEmpty: string;
};
export type RecordMessages = typeof defaultMessages;
/** 실패가 보이는 자리. load는 내용 없는 실패, missing은 없음·이 조회의 거부, refresh는 내용을 보이는 중 재조회 실패다. */
export type RecordFailurePlace = 'load' | 'missing' | 'refresh';
/** 실패 문구. undefined면 키트 기본 문구, null이면 그 자리에 아무것도 그리지 않는다(앱 경계가 이미 알린 401·403 등). */
export type RenderRecordFailure = (failure: unknown, place: RecordFailurePlace) => ReactNode | null | undefined;
/**
 * 단건 하나의 상태를 그린다. 준비됨일 때만 children(data)을 그리고, 식별 전환·없음·실패는 useRecord 판정을 그대로 따른다.
 * missing은 없음 안내(무엇이 없는지와 돌아갈 길)다. 재조회 실패는 내용을 지우지 않고 위에 알린다.
 */
declare function RecordRoot<T>({ state, children, missing, renderFailure, messages, }: {
    readonly state: RecordState<T>;
    readonly children: (data: T) => ReactNode;
    readonly missing?: ReactNode;
    readonly renderFailure?: RenderRecordFailure;
    readonly messages?: Partial<RecordMessages>;
}): import("react").JSX.Element;
/** 라벨·값 항목들의 묶음(dl). */
declare function Fields({ children, className }: {
    readonly children: ReactNode;
    readonly className?: string;
}): import("react").JSX.Element;
/** 라벨·값 한 칸. null·undefined·''만 빈 값 표시('-')이고 0은 그대로 보인다. 값의 의미·마스킹·포맷은 프로젝트가 정한다. */
declare function Field({ label, children }: {
    readonly label: ReactNode;
    readonly children?: ReactNode;
}): import("react").JSX.Element;
export interface RecordHistoryEntry {
    readonly id: string;
    /** 이미 표시 형식으로 쓴 변경 일시. */
    readonly at: ReactNode;
    readonly actor: ReactNode;
    /** 변경 내용 줄. */
    readonly changes: readonly ReactNode[];
}
/** 변경 이력 표(일시·변경 내용·담당자). 항목은 프로젝트가 서버 어휘를 해석해 넘긴다. 0건이면 빈 문구. */
declare function History({ entries, labels, empty, }: {
    readonly entries: readonly RecordHistoryEntry[];
    readonly labels: {
        readonly at: ReactNode;
        readonly changes: ReactNode;
        readonly actor: ReactNode;
    };
    readonly empty?: ReactNode;
}): import("react").JSX.Element;
/** 상세 묶음 부품. `<Record state={useRecord(...)}>{(data) => <Record.Fields>…</Record.Fields>}</Record>` */
export declare const Record: typeof RecordRoot & {
    Fields: typeof Fields;
    Field: typeof Field;
    History: typeof History;
};
export { RetryRegion } from './ui/retry';
