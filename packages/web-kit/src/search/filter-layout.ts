import type { SearchMeta, SearchMetaEntry } from './list-search';

type Placement = { readonly section: 'basic' | 'detail' };
type Labels<K extends string> = Readonly<Record<K, string>>;
type FilterPresentation<Entry> =
  Entry extends { kind: 'keywords'; targets: readonly (infer K extends string)[] } ? { labels: Labels<K> }
  : Entry extends { kind: 'dateRange'; types: readonly (infer K extends string)[] } ? { labels: Labels<K> }
  : Entry extends { kind: 'choices'; values: readonly (infer K extends string)[] } ? { label: string; labels: Labels<K> }
  : { label: string };

/** 화면이 정하는 칸 순서(객체 선언 순서), 기본·상세 위치, 번역 문구. 페이지와 정렬은 표 도구다. */
export type ListFilterLayout<M extends SearchMeta> = {
  readonly [K in keyof M as M[K] extends { kind: 'paging' | 'sort' } ? never : K]:
    Placement & FilterPresentation<M[K]>;
};

interface PlacedFilter extends Placement {
  readonly name: string;
  readonly meta: Exclude<SearchMetaEntry, { kind: 'paging' | 'sort' }>;
  readonly label?: string;
  readonly labels?: Labels<string>;
}

/** 같은 배치에서 화면 칸과 상세검색 펼침 키를 만든다. 기간은 화면 이름 하나가 여러 주소 키를 갖는다. */
export function listFilterLayout<M extends SearchMeta>(meta: M, layout: ListFilterLayout<NoInfer<M>>) {
  const basic: PlacedFilter[] = [];
  const detail: PlacedFilter[] = [];
  const detailKeys: string[] = [];
  for (const [name, presentation] of Object.entries<Placement & { label?: string; labels?: Labels<string> }>(layout)) {
    const entry = meta[name];
    if (!entry || entry.kind === 'paging' || entry.kind === 'sort') throw new Error('Unknown list filter: ' + name);
    const field = { ...presentation, name, meta: entry };
    if (field.section === 'basic') basic.push(field);
    else {
      detail.push(field);
      if (entry.kind === 'dateRange') {
        detailKeys.push(entry.keys.from, entry.keys.to);
        if (entry.types.length) detailKeys.push(entry.keys.type);
      } else detailKeys.push(name);
    }
  }
  return { basic, detail, detailKeys };
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
