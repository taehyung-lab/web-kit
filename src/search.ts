// 파일 책임: URL 필드의 개별 복구와 직접 입력한 달력 날짜 쌍의 엄격한 검증을 분리한다.
export interface RecoverableField<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}
/** URL 필드 하나만 읽고 실패하면 기본값 해소 단계에 맡긴다. 입력 제출 검증에 쓰지 않는다. */
export function recoverUrlField<T>(schema: RecoverableField<T>, value: unknown): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}
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
