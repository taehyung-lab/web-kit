// 파일 책임: 목록 UI의 공개 입구. 역할별 구현을 List.*·별칭·선언 기반 타입으로 함께 내보낸다.
import type { ReactNode } from 'react';
import type { SearchMeta, SearchMetaEntry } from '@boosterlab/web-kit/search';
import { ListRoot, Check } from './list/list-context';
import { Filter, FilterActions, Detail, Choice, Text, Select, MultiSelect, Period, Keywords } from './list/list-filters';
import { Result, Table, Total, PageSize, SortSelect, Pagination } from './list/list-results';
import { Actions, BulkAction, BulkSelectAction, Download } from './list/list-actions';

export { ListDefaults } from './list/list-context';
export type { ListMessages, FailurePlace, RenderFailure } from './list/list-context';
export { VIRTUALIZE_FROM_ROWS } from './list/list-results';
export type { ListColumn } from './list/list-results';
export { useListModel, useListField } from '@boosterlab/web-kit/list';
export type { ListModel, PeriodShortcut, DownloadControl } from '@boosterlab/web-kit/list';

/** 선언의 칸 종류와 문구를 검사하는 타입 입구. 실행 구현은 List와 같다. */
type Props<C> = C extends (props: infer P) => unknown ? P : never;
type Names<M extends SearchMeta, K extends SearchMetaEntry['kind']> = {
  [N in keyof M & string]: M[N]['kind'] extends K ? N : never;
}[keyof M & string];
type NamedLabels<M extends SearchMeta, K extends SearchMetaEntry['kind'], P, L extends string, V extends string> = {
  [N in Names<M, K>]: Omit<P, 'name' | L | 'options' | 'choices' | 'from' | 'to' | 'type'> & { readonly name: N } &
    { readonly [Label in L]: Readonly<Record<M[N] extends Record<V, readonly (infer Value extends string)[]> ? Value : never, string>> }
}[Names<M, K>];
type MultiMeta<M extends SearchMeta> = { [N in keyof M as M[N] extends { multiple: true } ? N : never]: M[N] };
export type TypedList<M extends SearchMeta> = typeof ListRoot & Omit<typeof List, 'of' | 'Keywords' | 'MultiSelect' | 'Period' | 'SortSelect' | 'Detail'> & {
  readonly Keywords: (props: NamedLabels<M, 'keywords', Props<typeof Keywords>, 'choiceLabels', 'targets'>) => ReactNode;
  readonly MultiSelect: (props: NamedLabels<MultiMeta<M>, 'choices', Props<typeof MultiSelect>, 'optionLabels', 'values'>) => ReactNode;
  readonly Period: (props: NamedLabels<M, 'dateRange', Props<typeof Period>, 'typeLabels', 'types'>) => ReactNode;
  readonly SortSelect: (props: Omit<Props<typeof SortSelect>, 'options' | 'optionLabels'> & {
    readonly optionLabels: Readonly<Record<M[Names<M, 'sort'>] extends { values: readonly (infer V extends string)[] } ? V : never, string>>;
  }) => ReactNode;
  readonly Detail: (props: Omit<Props<typeof Detail>, 'keys'> & { readonly keys: readonly (keyof M & string)[] }) => ReactNode;
};

/** 목록 기본 UI. <List model={useList(...)}> 안에 부품을 원하는 배치로 둔다. */
export const List = Object.assign(ListRoot, {
  of: <S extends { readonly meta: SearchMeta },>() => List as unknown as TypedList<S['meta']>,
  Filter,
  Choice,
  FilterActions,
  Detail,
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
  Detail as FilterDetails,
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
