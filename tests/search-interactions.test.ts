/** 검색 값 전이의 달력·중복·전체 선택 의미를 검사한다. */
import { expect, it } from 'vitest';
import { addKeyword, nextSort, normalizeFilterSelection, calendarDate, shiftCalendarDate } from '../src/search/interactions';
it('키워드는 공백·동일 필드 중복을 제거하지만 다른 필드의 같은 문자는 유지한다', () => {
  const once = addKeyword([], 'name', ' A ');
  expect(addKeyword(once, 'name', 'A')).toEqual(once);
  expect(addKeyword(once, 'email', 'A')).toHaveLength(2);
  expect(addKeyword(once, 'name', ' ')).toEqual(once);
});
it('새 정렬 열은 방향을 유지하고 같은 열은 전환한다', () => {
  expect(nextSort({ sort: 'a', order: 'asc' }, 'b')).toEqual({ sort: 'b', order: 'asc' });
  expect(nextSort({ sort: 'a', order: 'desc' }, 'a')).toEqual({ sort: 'a', order: 'asc' });
});
it('검색의 모두 선택은 빈 배열로 정규화한다', () => {
  expect(normalizeFilterSelection(['b', 'a'], ['a', 'b'])).toEqual([]);
  expect(normalizeFilterSelection(['a', 'unknown'], ['a', 'b'])).toEqual(['a']);
});
it('시간대와 월말을 명시적으로 계산한다', () => {
  const now = new Date('2024-03-01T00:30:00Z');
  expect(calendarDate(now, 'America/Los_Angeles')).toBe('2024-02-29');
  expect(shiftCalendarDate('2024-03-31', { unit: 'month', amount: -1 })).toBe('2024-02-29');
  expect(shiftCalendarDate('2024-03-01', { unit: 'day', amount: -6 })).toBe('2024-02-24');
  expect(() => shiftCalendarDate('2024-02-30', { unit: 'day', amount: 1 })).toThrow();
});
