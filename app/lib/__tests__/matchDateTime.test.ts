import { APPROXIMATE_KICKOFF_TIME, normalizeMatchDateTime } from '../matchDateTime';

describe('normalizeMatchDateTime', () => {
  test('exact dateTime passes through untouched', () => {
    expect(normalizeMatchDateTime({ dateTime: '2026-09-12T15:00:00.000Z' })).toEqual({
      dateTime: '2026-09-12T15:00:00.000Z',
      approximate: false,
    });
  });

  test('preserves an existing approximate flag on exact times', () => {
    expect(
      normalizeMatchDateTime({ dateTime: '2026-09-12T15:00:00.000Z', approximate: true })
    ).toEqual({ dateTime: '2026-09-12T15:00:00.000Z', approximate: true });
  });

  test('date-only match gets neutral midday kickoff marked approximate', () => {
    expect(normalizeMatchDateTime({ date: '2026-09-12' })).toEqual({
      dateTime: `2026-09-12${APPROXIMATE_KICKOFF_TIME}`,
      approximate: true,
    });
  });

  test('date-only wins over garbage dateTime', () => {
    expect(normalizeMatchDateTime({ date: '2026-09-13', dateTime: 'not-a-date' })).toEqual({
      dateTime: `2026-09-13${APPROXIMATE_KICKOFF_TIME}`,
      approximate: true,
    });
  });

  test('missing or garbage dates return null (still dropped)', () => {
    expect(normalizeMatchDateTime(null)).toBeNull();
    expect(normalizeMatchDateTime({})).toBeNull();
    expect(normalizeMatchDateTime({ dateTime: 'garbage' })).toBeNull();
    expect(normalizeMatchDateTime({ date: 'kolejka 4' })).toBeNull();
  });
});
