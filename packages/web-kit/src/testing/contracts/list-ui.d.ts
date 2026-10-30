// 파일 책임: 적합성 검사에 주입하는 UI의 구조 타입 계약이며 런타임 구현은 포함하지 않는다.
import { useListModel, useListField, type PeriodShortcut, type DownloadControl, type ListModel } from '@boosterlab/web-kit/list';
import { type ChoiceProps } from './ui/choice';
import { type ReactNode } from 'react';
import type { DownloadKind } from '@boosterlab/web-kit/list';
import { type Keyword } from '@boosterlab/web-kit/search';
declare const defaultMessages: {
    search: string;
    reset: string;
    detail: string;
    retry: string;
    notSearched: string;
    notReady: string;
    optionsFailed: string;
    fieldOptionsFailed: string;
    loading: string;
    failed: string;
    empty: string;
    refreshFailed: string;
    selectPage: string;
    selectRow: string;
    previous: string;
    next: string;
    pagination: string;
    size: string;
    sort: string;
    total: string;
    totalUnit: string;
    keywordTarget: string;
    keywordAdd: string;
    keywordRemove: string;
    periodStart: string;
    periodEnd: string;
    periodType: string;
    all: string;
    confirm: string;
    cancel: string;
    items: string;
    actionFailed: string;
    download: string;
    downloadKind: string;
    downloadChoose: string;
    downloadAll: string;
    downloadSelected: string;
    downloading: string;
    downloadFailed: string;
};
export type ListMessages = Omit<typeof defaultMessages, 'fieldOptionsFailed'> & {
    readonly fieldOptionsFailed?: string;
};
/** 실패가 보이는 자리. list는 결과 없는 조회 실패, refresh는 이전 결과 유지 중 실패, action·download는 쓰기 실패다. */
export type FailurePlace = 'list' | 'refresh' | 'action' | 'download';
/**
 * 실패 원인 문구. undefined면 키트 기본 문구, null이면 그 자리에 아무것도 그리지 않는다(앱 경계가 이미 알린 실패 등).
 * refresh에서는 원인 뒤에 이전 결과 안내(messages.refreshFailed)를 붙이며 ''를 주면 원인 없이 안내만 보인다.
 */
export type RenderFailure = (failure: unknown, place: FailurePlace) => ReactNode | null | undefined;
export { useListModel, useListField };
export type { ListModel };
/** 목록 하나의 부품들이 같은 상태를 쓰게 한다. 배치는 children이 정한다. */
declare function ListRoot({ model, messages, renderFailure, children, }: {
    readonly model: ListModel;
    readonly messages?: Partial<ListMessages>;
    readonly renderFailure?: RenderFailure;
    readonly children: ReactNode;
}): import("react").JSX.Element;
/** 검색 영역. Enter·검색 버튼이 같은 확정(model.submit)을 부른다. */
declare function Filter({ model: explicitModel, children, className }: {
    readonly children: ReactNode;
    readonly className?: string;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 검색·초기화 버튼. Filter 안에 둔다. */
declare function FilterActions({ model: explicitModel, className, children }: {
    readonly className?: string;
    readonly children?: ReactNode;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 접을 수 있는 상세 필터. 접어도 입력은 초안에 남는다. keys 중 확정 값이 있으면 펼친 채 시작한다. */
declare function Detail({ model: explicitModel, keys, children }: {
    readonly keys: readonly string[];
    readonly children: ReactNode;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 선택지 조회와 URL 확인이 같은 선언을 쓰는 목록 선택 칸. */
declare function Choice({ model: explicitModel, name, searchName, nodes, ...props }: Omit<ChoiceProps, 'value' | 'onValueChange' | 'nodes'> & {
    readonly name: string;
    readonly searchName?: string;
    readonly nodes?: ChoiceProps['nodes'];
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 문자열 입력 하나. 빈 값은 기본값이 없을 때 undefined로 둔다. */
declare function Text({ model: explicitModel, name, label }: {
    readonly name: string;
    readonly label: string;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 단일 선택. 빈 선택은 기본값이 없을 때 undefined다. */
declare function Select({ model: explicitModel, name, label, options, emptyLabel, disabled, }: {
    readonly name: string;
    readonly label: string;
    readonly options: readonly {
        readonly value: string;
        readonly label: string;
    }[];
    /** 있으면 맨 앞에 빈 선택을 둔다. */
    readonly emptyLabel?: string;
    readonly disabled?: boolean;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 체크박스 하나(Base UI). 일부 선택은 indeterminate로 보인다. */
declare function Check({ label, checked, mixed, disabled, onChange, children, }: {
    readonly label?: string;
    readonly checked: boolean;
    readonly mixed?: boolean;
    readonly disabled?: boolean;
    readonly onChange: (checked: boolean) => void;
    readonly children?: ReactNode;
}): import("react").JSX.Element;
/** 다중 선택. 빈 배열은 제한 없음(전부 체크 표시)이고 전부 고르면 빈 배열로 돌린다. "전체"는 allLabel이 있을 때만 둔다. */
declare function MultiSelect({ model: explicitModel, name, label, options, allLabel, }: {
    readonly name: string;
    readonly label: string;
    readonly options: readonly {
        readonly value: string;
        readonly label: string;
    }[];
    readonly allLabel?: string;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
export type { PeriodShortcut } from '@boosterlab/web-kit/list';
/** 기간: 기준 선택(선택)·단축·직접 입력. 맞지 않는 기간은 검색할 때 상태가 기본값으로 돌린다. */
declare function Period({ model: explicitModel, from, to, label, timeZone, now, presets, type, startLabel, endLabel, }: {
    readonly from: string;
    readonly to: string;
    readonly label: string;
    /** 단축이 오늘을 읽는 시간대. 생략하면 브라우저 시간대를 쓴다. */
    readonly timeZone?: string;
    readonly now?: () => Date;
    readonly presets?: readonly PeriodShortcut[];
    /** 기간 기준 필드(공연일·등록일 등). */
    readonly type?: {
        readonly name: string;
        readonly options: readonly {
            readonly value: string;
            readonly label: string;
        }[];
    };
    /** 날짜 칸 이름. 생략하면 "{label} {messages.periodStart/End}". */
    readonly startLabel?: string;
    readonly endLabel?: string;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 키워드: 대상 선택·입력·추가·칩. 입력 중 글자는 상태(keywordInput)에 있어 추가를 누르지 않아도 검색에 들어간다. */
declare function Keywords({ model: explicitModel, name, label, choices, targetLabel, inputLabel, removeLabel, }: {
    readonly name: string;
    readonly label: string;
    readonly choices: readonly {
        readonly value: string;
        readonly label: string;
    }[];
    /** 대상 선택·입력 칸·칩 제거 버튼 이름. 생략하면 label과 messages로 만든다. */
    readonly targetLabel?: string;
    readonly inputLabel?: string;
    readonly removeLabel?: (item: Keyword, choiceLabel: string) => string;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 결과 영역: 조회 안 함·로딩·실패(재시도)·빈 결과·이전 결과 유지 중 실패 안내. 결과가 있을 때만 children(표)을 그린다. */
declare function Result({ model: explicitModel, children, className }: {
    readonly children: ReactNode;
    readonly className?: string;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 표 컬럼 하나. sort를 주면 머리글이 그 정렬 키로 정렬한다. */
export interface ListColumn<Row> {
    readonly key: string;
    readonly header: ReactNode;
    readonly cell: (row: Row) => ReactNode;
    readonly sort?: string;
    readonly className?: string;
}
/** 이 행 수부터 화면에 보이는 행만 그린다. */
export declare const VIRTUALIZE_FROM_ROWS = 50;
/** 결과 표: 선택 열·정렬 머리글·행 이동(클릭·Enter)·많은 행의 가상화. 이전 조건 결과는 선택할 수 없다. */
declare function Table<Row>({ model: explicitModel, columns, rowId, onOpen, selectable, rowLabel, virtualizeFrom, className, }: {
    readonly columns: readonly ListColumn<Row>[];
    readonly rowId: (row: Row) => string;
    readonly onOpen?: (row: Row) => void;
    readonly selectable?: boolean;
    /** 행 선택 체크박스의 이름. */
    readonly rowLabel?: (row: Row) => string;
    readonly virtualizeFrom?: number;
    readonly className?: string;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 총 건수. 이전 조건 결과를 보이는 동안은 그 숫자가 틀린 정보라 '…'이다. */
declare function Total({ model: explicitModel, className }: {
    readonly className?: string;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 페이지 크기 선택. 바꾸면 첫 페이지로 확정한다. */
declare function PageSize({ model: explicitModel, sizes }: {
    readonly sizes: readonly number[];
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 정렬 키 선택. 고르면 그 키의 첫 방향(sortFirst)으로, 같은 키면 지금 방향으로 확정한다. */
declare function SortSelect({ model: explicitModel, options }: {
    readonly options: readonly {
        readonly value: string;
        readonly label: string;
    }[];
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 번호 페이지 이동. 한 페이지뿐이면 그리지 않는다. */
declare function Pagination({ model: explicitModel, className }: {
    readonly className?: string;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element | null;
/** 선택 기반 쓰기 액션 자리. 이전 조건 결과를 보이는 동안 통째로 잠근다. */
declare function Actions({ model: explicitModel, children, className }: {
    readonly children: ReactNode;
    readonly className?: string;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 확인창을 거치는 일괄 작업. 확인 당시 결과와 선택이 바뀌면 실행하지 않고, 실패는 확인창에 남기며 선택은 유지한다. */
declare function BulkAction<T>({ model: explicitModel, label, run, check, title, confirmLabel, cancelLabel, describe, }: {
    readonly label: string;
    readonly run: (ids: readonly string[]) => Promise<{
        completedIds: readonly string[];
        value?: T;
    }>;
    /** 업무상 거절 사유. 있으면 실행하지 않고 보인다. */
    readonly check?: (ids: readonly string[]) => string | undefined;
    readonly title?: string;
    readonly confirmLabel?: string;
    readonly cancelLabel?: string;
    readonly describe?: (ids: readonly string[]) => ReactNode;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
export type { DownloadControl } from '@boosterlab/web-kit/list';
/** 다운로드 종류 선택과 실행 버튼. 진행 중에는 잠기고 실패는 원인과 함께 남는다. kinds 순서대로 보인다. */
declare function Download({ model: explicitModel, control, kinds, label, }: {
    readonly control: DownloadControl;
    readonly kinds?: readonly DownloadKind[];
    readonly label?: string;
} & {
    readonly model?: ListModel;
}): import("react").JSX.Element;
/** 목록 기본 UI. <List model={useList(...)}> 안에 부품을 원하는 배치로 둔다. */
export declare const List: typeof ListRoot & {
    Filter: typeof Filter;
    Choice: typeof Choice;
    FilterActions: typeof FilterActions;
    Detail: typeof Detail;
    Text: typeof Text;
    Select: typeof Select;
    MultiSelect: typeof MultiSelect;
    Period: typeof Period;
    Keywords: typeof Keywords;
    Result: typeof Result;
    Table: typeof Table;
    Total: typeof Total;
    PageSize: typeof PageSize;
    SortSelect: typeof SortSelect;
    Pagination: typeof Pagination;
    Actions: typeof Actions;
    BulkAction: typeof BulkAction;
    Download: typeof Download;
    Check: typeof Check;
};
/** 같은 목록 상태를 일반 JSX 이름으로 조립하는 입구. 기존 List.*와 구현·수명이 같다. */
export { ListRoot as ListProvider, Filter as FilterPanel, FilterActions, Detail as FilterDetails, Text as TextFilter, Choice as ChoiceFilter, Select as SelectFilter, MultiSelect as MultiChoiceFilter, Period as PeriodFilter, Keywords as KeywordFilter, Result as ListResult, Table as ResultTable, Total as ResultTotal, PageSize, SortSelect, Pagination, Actions as ListActions, BulkAction, Download as ListDownload, Check as ListCheck, };
