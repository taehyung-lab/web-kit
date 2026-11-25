// 파일 책임: 확정 조건에 실제로 결과를 거르는 값이 있는지 판단한다. 빈 결과(empty)의 filtered가 이것이다.
// "기본값과 다른가"가 아니다: 기본 기간이 걸린 목록도 기간으로 거르므로 filtered다.
import { sameSearchValue, type SearchDefinition } from '../search/fields';

type FilterSource = Pick<SearchDefinition<any>, 'fields' | 'defaults' | 'view' | 'meta'>;

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);
}

/**
 * listSearch로 선언한 칸은 종류로 판단한다: 검색어·서버 선택지는 비어 있지 않음, 다중 선택은 비어 있지 않고 전부 고른 것도 아님
 * (전부 선택은 조건 없음), 단일 선택은 값 있음, 기간은 시작·끝 중 하나라도 있음(기간 기준만 있으면 아님). 페이지·정렬은 거르지 않는다.
 * 종류 정보가 없는 칸(defineSearch, listSearch에 직접 넣은 필드)은 기본값과 다른지로 판단한다.
 */
export function isFiltered(definition: FilterSource, criteria: Readonly<Record<string, unknown>>): boolean {
  const judged = new Set<string>(['searched', ...Object.values(definition.view)]);
  let filtered = false;
  for (const [name, entry] of Object.entries(definition.meta ?? {})) {
    switch (entry.kind) {
      case 'paging':
      case 'sort':
        break;
      case 'dateRange':
        judged.add(entry.keys.from).add(entry.keys.to).add(entry.keys.type);
        if (hasValue(criteria[entry.keys.from]) || hasValue(criteria[entry.keys.to])) filtered = true;
        break;
      case 'choices': {
        judged.add(name);
        const value = criteria[name];
        if (!entry.multiple) {
          if (hasValue(value)) filtered = true;
        } else if (Array.isArray(value) && value.length > 0 && !entry.values.every((option) => value.includes(option))) filtered = true;
        break;
      }
      case 'keywords':
      case 'serverChoices':
        judged.add(name);
        if (hasValue(criteria[name])) filtered = true;
        break;
    }
  }
  for (const key of Object.keys(definition.fields)) {
    if (!judged.has(key) && !sameSearchValue(criteria[key], (definition.defaults as Record<string, unknown>)[key])) filtered = true;
  }
  return filtered;
}
