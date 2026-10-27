// 파일 책임: 직접 입력한 달력 날짜 쌍을 엄격하게 검증한다. URL 복구는 같은 폴더의 fields가 맡는다.
export type DateRangeIssue = 'incomplete' | 'invalid' | 'reversed';
/** 실제 달력에 존재하는 yyyy-MM-dd 값인지 확인한다. */
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
}
/** 빈 기간은 허용하고, 입력 중인 불완전·잘못된 날짜·역순 기간은 복구하지 않고 거절한다. */
export function validateDateRange(start?: string, end?: string): DateRangeIssue | undefined {
  if (!start && !end) return undefined;
  if (!start || !end) return 'incomplete';
  if (!validDate(start) || !validDate(end)) return 'invalid';
  return start > end ? 'reversed' : undefined;
}
