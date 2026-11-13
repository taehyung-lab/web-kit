// 파일 책임: 지정 시간대의 달력 하루를 절대시각 구간으로 변환한다. 표시·서버 종료 정밀도는 소비자가 정한다.
import { isCalendarDate } from './date-range';

export type CalendarDayResult =
  | { readonly ok: true; readonly start: number; readonly endExclusive: number }
  | { readonly ok: false; readonly reason: 'invalid-date' | 'invalid-time-zone' | 'nonexistent-date' };

const DAY = 86_400_000;

/** Date.UTC의 0~99년 보정을 피하고 달력 산술만 수행한다. */
function utcValue(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  value.setUTCHours(hour, minute, second, 0);
  return value.getTime();
}

/**
 * YYYY-MM-DD(0000~9999)와 명시적인 IANA 시간대를 받는다. 반환 시각은 epoch milliseconds다.
 * 중복 자정은 첫 발생, 사라진 자정은 전환 후 첫 유효 순간을 쓴다. 날짜 전체가 없으면 실패다.
 * endExclusive는 다음 날 시작이므로 23/25시간 및 날짜 건너뜀을 포함한다. 서버 종료값을 차감하지 않는다.
 */
export function calendarDayBounds(date: string, timeZone: string): CalendarDayResult {
  if (!isCalendarDate(date)) return { ok: false, reason: 'invalid-date' };
  let formatter: Intl.DateTimeFormat;
  try {
    // undefined를 런타임에서 받더라도 브라우저 시간대를 암묵적으로 선택하지 않는다.
    if (typeof timeZone !== 'string' || timeZone.length === 0) return { ok: false, reason: 'invalid-time-zone' };
    formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
      timeZone, era: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
  } catch {
    return { ok: false, reason: 'invalid-time-zone' };
  }
  const wallTime = (instant: number): number => {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
    const year = parts.era === 'BC' ? 1 - Number(parts.year) : Number(parts.year);
    return utcValue(year, Number(parts.month), Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  };
  const offset = (instant: number) => wallTime(instant) - instant;
  const midnight = (wall: number): number => {
    // 전환 전후 offset으로 후보를 만든 뒤 현지 시각으로 역검증한다.
    const offsets = new Set([offset(wall - DAY), offset(wall), offset(wall + DAY)]);
    const candidates = [...offsets].map(value => wall - value);
    const exact = candidates.filter(candidate => wallTime(candidate) === wall);
    if (exact.length) return Math.min(...exact);
    // 자정을 가로지른 공백은 자정을 밀어내지 않고 실제 전환 시각에서 시작한다.
    let before = Math.min(...candidates);
    let after = Math.max(...candidates);
    while (after - before > 1000) {
      const middle = Math.floor((before + after) / 2000) * 1000;
      if (wallTime(middle) < wall) before = middle;
      else after = middle;
    }
    return after;
  };
  const wall = Date.parse(`${date}T00:00:00Z`);
  const start = midnight(wall);
  // 자정 gap은 허용하지만, 날짜 전체가 건너뛰어진 경우 다른 날로 정규화하지 않는다.
  const resolvedWall = wallTime(start);
  if (resolvedWall < wall || resolvedWall >= wall + DAY) return { ok: false, reason: 'nonexistent-date' };
  return { ok: true, start, endExclusive: midnight(wall + DAY) };
}
