// 파일 책임: 목록 UI의 공개 입구. 역할별 구현을 List.*·별칭·선언 기반 타입으로 함께 내보낸다.
import type { ReactNode } from 'react';
import type { SearchMeta, SearchMetaEntry } from '@boosterlab/web-kit/search';
import { ListRoot, Check } from './list/list-context';
import {
  Filter,
  FilterActions,
  FilterDetails,
  Choice,
  Text,
  Select,
  MultiSelect,
  Period,
  Keywords,
} from './list/list-filters';
import { Result, Table, Total, PageSize, SortSelect, Pagination } from './list/list-results';
import { Actions, BulkAction, BulkSelectAction, Download } from './list/list-actions';

export { ListDefaults } from './list/list-context';
export type {
  ListMessages,
  FailurePlace,
  RenderFailure,
  KeywordEnterSearch,
  RefusalNotice,
} from './list/list-context';
export { VIRTUALIZE_FROM_ROWS } from './list/list-results';
export type { ListColumn } from './list/list-results';
import type { ListColumn } from './list/list-results';
export { useListModel, useListField } from '@boosterlab/web-kit/list';
export type {
  ListModel,
  PeriodShortcut,
  DownloadControl,
  BulkResult,
  BulkRunResult,
} from '@boosterlab/web-kit/list';

/** 선언의 칸 종류와 문구를 검사하는 타입 입구. 실행 구현은 List와 같다. */
type Props<C> = C extends (props: infer P) => unknown ? P : never;
type Names<M extends SearchMeta, K extends SearchMetaEntry['kind']> = {
  [N in keyof M & string]: M[N]['kind'] extends K ? N : never;
}[keyof M & string];
type NamedLabels<
  M extends SearchMeta,
  K extends SearchMetaEntry['kind'],
  P,
  L extends string,
  V extends string,
> = {
  [N in Names<M, K>]: Omit<P, 'name' | L | 'options' | 'choices' | 'from' | 'to' | 'type'> & {
    readonly name: N;
  } & {
    readonly [Label in L]: Readonly<
      Record<
        M[N] extends Record<V, readonly (infer Value extends string)[]> ? Value : never,
        string
      >
    >;
  };
}[Names<M, K>];
/** 기간 칸이 차지하는 주소 키(시작·끝·기준). 이 키들은 칸 이름이 아니다. */
type DateKeysOf<M extends SearchMeta> = {
  [N in keyof M]: M[N] extends { kind: 'dateRange'; keys: infer DK } ? DK[keyof DK] : never;
}[keyof M];
/** 상세검색 펼침이 받는 칸 이름: 종류로 선언한 검색 칸과 직접 선언한 칸. */
type FilterNames<M extends SearchMeta, K extends string> =
  | Names<M, 'keywords' | 'choices' | 'serverChoices' | 'dateRange'>
  | Exclude<K, keyof M | DateKeysOf<M>>;
type MultiMeta<M extends SearchMeta> = {
  [N in keyof M as M[N] extends { multiple: true } ? N : never]: M[N];
};
/** 선언한 정렬 값. 표 열의 sort에 쓸 수 있는 이름이다. */
type SortValues<M extends SearchMeta> = M[Names<M, 'sort'>] extends {
  values: readonly (infer V extends string)[];
}
  ? V
  : never;
/**
 * M은 화면 칸 이름과 종류(선언의 meta), K는 확정 조건의 주소 키(선언의 fields)다. 둘은 다르다:
 * 기간 칸 `period`는 M에만 있고 그 값은 K의 시작일·종료일·기준으로 나뉘며, 직접 선언한 칸은 K에만 있다.
 */
export type TypedList<M extends SearchMeta, K extends string = string> = typeof ListRoot &
  Omit<
    typeof List,
    'of' | 'Keywords' | 'MultiSelect' | 'Period' | 'SortSelect' | 'FilterDetails' | 'Table'
  > & {
    readonly Keywords: (
      props: NamedLabels<M, 'keywords', Props<typeof Keywords>, 'valueLabels', 'targets'>
    ) => ReactNode;
    readonly MultiSelect: (
      props: NamedLabels<
        MultiMeta<M>,
        'choices',
        Props<typeof MultiSelect>,
        'valueLabels',
        'values'
      >
    ) => ReactNode;
    readonly Period: (
      props: NamedLabels<M, 'dateRange', Props<typeof Period>, 'valueLabels', 'types'>
    ) => ReactNode;
    readonly SortSelect: (
      props: Omit<Props<typeof SortSelect>, 'options' | 'valueLabels'> & {
        readonly valueLabels: Readonly<Record<SortValues<M>, string>>;
      }
    ) => ReactNode;
    /** names는 접힌 칸의 이름이다(다른 부품의 name과 같은 이름). 그중 하나라도 확정 값이 있으면 처음부터 펼친다. */
    readonly FilterDetails: (
      props: Omit<Props<typeof FilterDetails>, 'names'> & {
        readonly names: readonly FilterNames<M, K>[];
      }
    ) => ReactNode;
    /** 열의 sort에는 선언한 정렬 값만 쓸 수 있다. */
    readonly Table: <Row>(
      props: Omit<Parameters<typeof Table<Row>>[0], 'columns'> & {
        readonly columns: readonly ListColumn<Row, SortValues<M>>[];
      }
    ) => ReactNode;
  };

/** 목록 기본 UI. <List model={useList(...)}> 안에 부품을 원하는 배치로 둔다. */
export const List = Object.assign(ListRoot, {
  of: <S extends { readonly meta: SearchMeta }>() =>
    List as unknown as TypedList<
      S['meta'],
      S extends { readonly fields: infer F } ? keyof F & string : string
    >,
  Filter,
  Choice,
  FilterActions,
  FilterDetails,
  Text,
  Select,
  MultiSelect,
  Period,
  Keywords,
  Result,
  Table,
  Total,
  PageSize,
  SortSelect,
  Pagination,
  Actions,
  BulkAction,
  BulkSelectAction,
  Download,
  Check,
});

/** 같은 목록 상태를 일반 JSX 이름으로 조립하는 입구. 기존 List.*와 구현·수명이 같다. */
export {
  ListRoot as ListProvider,
  Filter as FilterPanel,
  FilterActions,
  FilterDetails,
  Text as TextFilter,
  Choice as ChoiceFilter,
  Select as SelectFilter,
  MultiSelect as MultiChoiceFilter,
  Period as PeriodFilter,
  Keywords as KeywordFilter,
  Result as ListResult,
  Table as ResultTable,
  Total as ResultTotal,
  PageSize,
  SortSelect,
  Pagination,
  Actions as ListActions,
  BulkAction,
  BulkSelectAction,
  Download as ListDownload,
  Check as ListCheck,
};
