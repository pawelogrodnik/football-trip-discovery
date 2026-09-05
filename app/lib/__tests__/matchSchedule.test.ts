import {
  getFixtureSchedule,
  getFixtureScheduleWindow,
  isDateWindowSchedule,
  isScheduleConfirmed,
  isScheduleTbc,
  scheduleDisplayOf,
  scheduleIntersectsRange,
} from '../matchSchedule';

describe('matchSchedule', () => {
  test('exact datetime normalizes to confirmed', () => {
    expect(getFixtureSchedule({ date: { dateTime: '2026-10-23T15:00:00+02:00' } })).toEqual({
      status: 'confirmed',
      dateTime: '2026-10-23T15:00:00+02:00',
    });
  });

  test('exact day without kickoff normalizes to date-confirmed (no fake time)', () => {
    expect(getFixtureSchedule({ date: { date: '2026-10-23' } })).toEqual({
      status: 'date-confirmed',
      date: '2026-10-23',
    });
  });

  test('weekend range normalizes to date-window and is never collapsed', () => {
    const schedule = getFixtureSchedule({
      schedule: { status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' },
    });
    expect(schedule).toEqual({
      status: 'date-window',
      startDate: '2026-10-22',
      endDate: '2026-10-23',
    });
    const display = scheduleDisplayOf({
      schedule: { status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' },
    });
    expect(display?.dateTime).toBeUndefined();
    expect(display?.startDateOnly).toBe('2026-10-22');
    expect(display?.endDateOnly).toBe('2026-10-23');
  });

  test('legacy date.startDate/endDate pair normalizes to date-window', () => {
    expect(
      getFixtureSchedule({ date: { startDate: '2026-10-22', endDate: '2026-10-23' } })
    ).toEqual({ status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' });
  });

  test('round-only labels do not resolve to a schedule', () => {
    expect(getFixtureSchedule({ date: { date: 'kolejka 7' } })).toBeNull();
    expect(getFixtureSchedule(null)).toBeNull();
  });

  test('window/search-range intersection (Find rule)', () => {
    const fixture = {
      schedule: { status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' },
    };
    expect(scheduleIntersectsRange(fixture, '2026-10-20', '2026-10-24')).toBe(true);
    expect(scheduleIntersectsRange(fixture, '2026-10-23', '2026-10-24')).toBe(true);
    expect(scheduleIntersectsRange(fixture, '2026-10-24', '2026-10-26')).toBe(false);
    expect(
      scheduleIntersectsRange(
        { date: { dateTime: '2026-10-23T15:00:00.000Z' } },
        '2026-10-23',
        '2026-10-23'
      )
    ).toBe(true);
  });

  test('status predicates', () => {
    expect(isScheduleConfirmed({ date: { dateTime: '2026-10-23T15:00:00.000Z' } })).toBe(true);
    expect(isScheduleTbc({ date: { date: '2026-10-23' } })).toBe(true);
    expect(
      isDateWindowSchedule({
        schedule: { status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' },
      })
    ).toBe(true);
    expect(isScheduleTbc({ date: { dateTime: '2026-10-23T15:00:00.000Z' } })).toBe(false);
  });

  test('schedule window spans full days for TBC fixtures', () => {
    const window = getFixtureScheduleWindow({
      schedule: { status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' },
    });
    expect(window).not.toBeNull();
    expect(window!.endMs - window!.startMs).toBeGreaterThan(24 * 3600 * 1000);
  });
});
