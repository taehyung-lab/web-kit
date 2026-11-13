import { describe, expect, it } from 'vitest';
import { calendarDayBounds } from '../src/index';

describe('calendarDayBounds public contract', () => {
  it.each([
    ['America/Toronto', '1919-03-30', '1919-03-30T05:00:00.000Z', '1919-03-31T04:30:00.000Z'],
    ['America/Toronto', '1919-03-31', '1919-03-31T04:30:00.000Z', '1919-04-01T04:00:00.000Z'],
    ['Asia/Seoul', '2026-10-01', '2026-09-30T15:00:00.000Z', '2026-10-01T15:00:00.000Z'],
    ['America/New_York', '2026-03-08', '2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z'],
    ['America/New_York', '2026-11-01', '2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z'],
    ['Australia/Sydney', '2026-10-04', '2026-10-03T14:00:00.000Z', '2026-10-04T13:00:00.000Z'],
    ['Africa/Cairo', '2026-04-24', '2026-04-23T22:00:00.000Z', '2026-04-24T21:00:00.000Z'],
    ['America/Havana', '2026-11-01', '2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z'],
    ['America/Godthab', '2026-03-28', '2026-03-28T02:00:00.000Z', '2026-03-29T01:00:00.000Z'],
    ['Pacific/Apia', '2011-12-29', '2011-12-29T10:00:00.000Z', '2011-12-30T10:00:00.000Z'],
    ['UTC', '0099-12-31', '0099-12-31T00:00:00.000Z', '0100-01-01T00:00:00.000Z'],
    ['UTC', '0000-01-01', '0000-01-01T00:00:00.000Z', '0000-01-02T00:00:00.000Z'],
    ['UTC', '9999-12-31', '9999-12-31T00:00:00.000Z', '+010000-01-01T00:00:00.000Z'],
  ])('%s %s returns boundaries without server precision policy', (zone, date, start, end) => {
    expect(calendarDayBounds(date, zone)).toEqual({ ok: true, start: Date.parse(start), endExclusive: Date.parse(end) });
  });
  it.each(['', '2026-02-30', '2025-02-29', '2026-13-01', '2026-01-32', '26-01-01', '2026-01-01T00:00', ' 2026-01-01', '10000-01-01'])('rejects invalid calendar input %s', date => {
    expect(calendarDayBounds(date, 'UTC')).toEqual({ ok: false, reason: 'invalid-date' });
  });
  it.each(['', 'Moon/Sea', 'Asia/NotAZone'])('rejects invalid time zone %s', zone => {
    expect(calendarDayBounds('2026-01-01', zone)).toEqual({ ok: false, reason: 'invalid-time-zone' });
  });
  it('does not normalize a completely skipped date into another day', () => {
    expect(calendarDayBounds('2011-12-30', 'Pacific/Apia')).toEqual({ ok: false, reason: 'nonexistent-date' });
  });
  it('does not silently choose a browser zone for a missing runtime input', () => {
    expect(calendarDayBounds('2026-01-01', undefined as unknown as string)).toEqual({ ok: false, reason: 'invalid-time-zone' });
  });
});
