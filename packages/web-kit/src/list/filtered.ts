// 파일 책임: 확정 조건에 실제로 결과를 거르는 값이 있는지 칸 단위로 판단한다.
// 빈 결과(empty)의 filtered와 상세검색 펼침의 시작 상태가 같은 규칙을 쓴다.
// "기본값과 다른가"가 아니다: 기본값으로 걸린 값(기본 기간 등)도 결과를 거르므로 조건이다.
import type { ViewKeys } from '../search/fields';
import type { SearchMeta, SearchMetaEntry } from '../search/list-search';

/** 판단에 필요한 목록 선언(검색 정의와 목록 모델이 같은 모양으로 갖는다). */
export interface FilterSource {
  readonly defaults: Readonly<Record<string, unknown>>;
  readonly view: ViewKeys;
  readonly meta?: SearchMeta;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);
}

/** 칸 종류 하나가 차지하는 주소 키. 기간은 시작·끝·기준, 페이지·정렬은 보기 키, 그 밖은 칸 이름이다. */
function keysOfEntry(name: string, entry: SearchMetaEntry): readonly string[] {
  if (entry.kind === 'dateRange') return [entry.keys.from, entry.keys.to, entry.keys.type];
  if (entry.kind === 'paging') return [entry.keys.page, entry.keys.size];
  if (entry.kind === 'sort') return [entry.keys.sort, entry.keys.order];
  return [name];
}

/**
 * 종류로 선언한 칸 하나에 조건이 걸렸는가. 검색어·서버 선택지는 비어 있지 않음, 다중 선택은 비어 있지 않고 전부 고른 것도 아님
 * (전부 선택은 조건 없음), 단일 선택은 값 있음, 기간은 시작·끝 중 하나라도 있음(기간 기준만 있으면 아님). 페이지·정렬은 거르지 않는다.
 */
function entryFiltered(name: string, entry: SearchMetaEntry, criteria: Readonly<Record<string, unknown>>): boolean {
  switch (entry.kind) {
    case 'paging':
    case 'sort':
      return false;
    case 'dateRange':
      return hasValue(criteria[entry.keys.from]) || hasValue(criteria[entry.keys.to]);
    case 'choices': {
      const value = criteria[name];
      if (!entry.multiple) return hasValue(value);
      return Array.isArray(value) && value.length > 0 && !entry.values.every((option) => value.includes(option));
    }
    case 'keywords':
    case 'serverChoices':
      return hasValue(criteria[name]);
  }
}

/** 종류 정보가 없는 필드(defineSearch, listSearch에 직접 넣은 필드)는 값이 있으면(빈 문자열·빈 배열·null·undefined가 아니면) 조건이다. */
function plainFieldFiltered(key: string, criteria: Readonly<Record<string, unknown>>): boolean {
  return hasValue(criteria[key]);
}

/** 판단에서 빼는 키(보기 키·조회 표시)와 종류로 선언한 칸이 차지한 주소 키. */
function claimedKeys(source: FilterSource): Set<string> {
  const keys = new Set<string>(['searched', ...Object.values(source.view) as string[]]);
  for (const [name, entry] of Object.entries(source.meta ?? {})) for (const key of keysOfEntry(name, entry)) keys.add(key);
  return keys;
}

/** 필터 칸 이름 하나의 주소 키. 선언에 없는 이름·페이지·정렬·기간의 주소 키는 칸 이름이 아니라 오류다. */
export function filterFieldKeys(source: FilterSource, name: string): readonly string[] {
  const entry = source.meta?.[name];
  if (entry !== undefined) {
    if (entry.kind === 'paging' || entry.kind === 'sort') throw new Error(`list: "${name}" is a paging/sort field, not a filter field`);
    return entry.kind === 'dateRange' && entry.types.length === 0 ? [entry.keys.from, entry.keys.to] : keysOfEntry(name, entry);
  }
  if (!(name in source.defaults) || claimedKeys(source).has(name)) throw new Error(`list: "${name}" is not a filter field name of this list`);
  return [name];
}

/** 필터 칸 이름 하나에 확정 조건이 걸렸는가(위 종류별 규칙). 이름 검사는 filterFieldKeys와 같다. */
export function isFieldFiltered(source: FilterSource, name: string, criteria: Readonly<Record<string, unknown>>): boolean {
  filterFieldKeys(source, name);
  const entry = source.meta?.[name];
  return entry === undefined ? plainFieldFiltered(name, criteria) : entryFiltered(name, entry, criteria);
}

/** 확정 조건 전체에 조건이 걸렸는가. 종류로 선언한 칸은 종류로, 나머지 필드는 값이 있는지로 판단한다. */
export function isFiltered(source: FilterSource, criteria: Readonly<Record<string, unknown>>): boolean {
  const claimed = claimedKeys(source);
  return (
    Object.entries(source.meta ?? {}).some(([name, entry]) => entryFiltered(name, entry, criteria)) ||
    Object.keys(source.defaults).some((key) => !claimed.has(key) && plainFieldFiltered(key, criteria))
  );
}
