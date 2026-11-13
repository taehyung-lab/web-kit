// 파일 책임: 포장한 키트의 공개 날짜 경계를 소비하고 서로 다른 서버 종료 정책을 조립할 수 있음을 확인한다.
import { calendarDayBounds } from '@boosterlab/web-kit';
import { expect, it } from 'vitest';
it('uses the installed public calculation without imposing an inclusive server end', () => {
  const day = calendarDayBounds('2026-03-08', 'America/New_York');
  expect(day.ok).toBe(true);
  if (!day.ok) throw new Error(day.reason);
  expect(new Date(day.start).toISOString()).toBe('2026-03-08T05:00:00.000Z');
  expect(new Date(day.endExclusive).toISOString()).toBe('2026-03-09T04:00:00.000Z');
  expect(new Date(day.endExclusive - 1000).toISOString()).toBe('2026-03-09T03:59:59.000Z');
  expect(day.endExclusive - day.start).toBe(23 * 60 * 60 * 1000);
});
