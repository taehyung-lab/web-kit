/** 필터·정렬의 공통 값 전이. 날짜는 지정한 시간대의 달력 날짜로 계산한다. */
export interface Keyword {
  readonly field: string;
  readonly value: string;
}
/** 앞뒤 공백과 같은 필드의 중복을 제거한 키워드를 추가한다. */
export function addKeyword(items: readonly Keyword[], field: string, input: string): readonly Keyword[] {
  const value = input.trim();
  if (value === '' || items.some((item) => item.field === field && item.value === value)) return items;
  return [...items, { field, value }];
}
/** 같은 열은 방향을 바꾸고 새 열은 현재 방향을 유지한다. */
export function nextSort(current: { readonly sort: string; readonly order: 'asc' | 'desc' }, sort: string) {
  return { sort, order: current.sort === sort ? (current.order === 'asc' ? 'desc' : 'asc') : current.order } as const;
}
/** 검색용 전체 선택을 빈 배열로 정규화한다. 권한/등록 입력에는 사용하지 않는다. */
export function normalizeFilterSelection<T>(selected: readonly T[], options: readonly T[]): readonly T[] {
  const kept = options.filter((value) => selected.includes(value));
  return kept.length === options.length ? [] : kept;
}
export type PeriodPreset = { readonly unit: 'day' | 'month'; readonly amount: number };
/** 지정한 시각·시간대의 날짜만 읽는다. 브라우저 시간대를 암묵적으로 사용하지 않는다. */
export function calendarDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
/** 달력 날짜를 이동하며 월 이동은 말일로 보정한다. amount는 과거 음수/미래 양수다. */
export function shiftCalendarDate(date: string, preset: PeriodPreset): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const result = new Date(Date.UTC(year, month - 1, day));
  if (result.toISOString().slice(0, 10) !== date) throw new Error('invalid calendar date');
  if (!Number.isInteger(preset.amount)) throw new Error('period amount must be an integer');
  if (preset.unit === 'day') result.setUTCDate(day + preset.amount);
  else {
    result.setUTCDate(1);
    result.setUTCMonth(month - 1 + preset.amount);
    const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(day, last));
  }
  return result.toISOString().slice(0, 10);
}
