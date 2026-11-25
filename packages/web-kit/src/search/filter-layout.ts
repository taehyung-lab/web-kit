import type { SearchMeta, SearchMetaEntry } from './list-search';

type Placement = { readonly section: 'basic' | 'detail' };
type ValueLabels<K extends string> = Readonly<Record<K, string>>;
type FilterPresentation<Entry> =
  Entry extends { kind: 'keywords'; targets: readonly (infer K extends string)[] } ? { valueLabels: ValueLabels<K> }
  : Entry extends { kind: 'dateRange'; types: readonly (infer K extends string)[] } ? { valueLabels: ValueLabels<K> }
  : Entry extends { kind: 'choices'; values: readonly (infer K extends string)[] } ? { title: string; valueLabels: ValueLabels<K> }
  : { title: string };

/**
 * 화면이 정하는 칸 순서(객체 선언 순서), 기본·상세 위치, 번역 문구. 페이지와 정렬은 표 도구다.
 * title은 칸 제목, valueLabels는 선언한 값(검색 대상·기간 기준·선택지)마다 보일 문구다.
 */
export type ListFilterLayout<M extends SearchMeta> = {
  readonly [K in keyof M as M[K] extends { kind: 'paging' | 'sort' } ? never : K]:
    Placement & FilterPresentation<M[K]>;
};

interface PlacedFilter extends Placement {
  /** 칸 이름(선언의 fields 키). 기본 부품의 name과 List.FilterDetails의 names가 이 이름을 받는다. */
  readonly name: string;
  readonly meta: Exclude<SearchMetaEntry, { kind: 'paging' | 'sort' }>;
  readonly title?: string;
  readonly valueLabels?: ValueLabels<string>;
}

/** 같은 배치에서 기본 칸과 상세 칸을 나눈다. 상세검색 펼침은 상세 칸의 이름을 그대로 받는다. */
export function listFilterLayout<M extends SearchMeta>(meta: M, layout: ListFilterLayout<NoInfer<M>>) {
  const basic: PlacedFilter[] = [];
  const detail: PlacedFilter[] = [];
  for (const [name, presentation] of Object.entries<Placement & { title?: string; valueLabels?: ValueLabels<string> }>(layout)) {
    const entry = meta[name];
    if (!entry || entry.kind === 'paging' || entry.kind === 'sort') throw new Error('Unknown list filter: ' + name);
    const field = { ...presentation, name, meta: entry };
    if (field.section === 'basic') basic.push(field);
    else detail.push(field);
  }
  return { basic, detail };
}

/** 검색 제출 때 대상 전체의 개수를 확인한다. 주소 진입 시의 복구 규칙과 분리한다. */
export function keywordLimitIssues(meta: SearchMeta, criteria: Readonly<Record<string, unknown>>) {
  return Object.entries(meta).flatMap(([field, entry]) => {
    const items = criteria[field];
    return entry.kind === 'keywords' && entry.maxTotal !== undefined && Array.isArray(items) && items.length > entry.maxTotal
      ? [{ field, code: 'keyword-limit' }]
      : [];
  });
}
