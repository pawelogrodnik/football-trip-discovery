import {
  dedupeMatches,
  formatDayHeader,
  formatDistanceKmDisplay,
  formatKickoffTime,
  formatShortDayRange,
  groupMatchesByDay,
  matchIdOf,
  selectedTripRange,
} from '../findResultsUtils';

function mkMatch(id: string, dateTime: string, extra: Record<string, unknown> = {}) {
  return {
    _id: id,
    homeTeam: { name: `Home ${id}`, crest: `https://example.com/${id}-h.png` },
    awayTeam: { name: `Away ${id}`, crest: `https://example.com/${id}-a.png` },
    competition: { name: 'IV liga' },
    date: { dateTime },
    stadium: { venue: `Stadion ${id}`, geo: { latitude: 50, longitude: 19 } },
    _distanceKm: 4.97,
    ...extra,
  };
}

describe('findResultsUtils', () => {
  test('matchIdOf prefers _id over id', () => {
    expect(matchIdOf({ _id: 'a', id: 'b' } as never)).toBe('a');
    expect(matchIdOf({ id: 'b' } as never)).toBe('b');
  });

  test('groups chronologically and sorts kickoff within day', () => {
    const groups = groupMatchesByDay([
      mkMatch('m3', '2026-09-10T18:00:00.000Z'),
      mkMatch('m1', '2026-09-07T15:30:00.000Z'),
      mkMatch('m2', '2026-09-07T12:00:00.000Z'),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].matches.map((m) => matchIdOf(m))).toEqual(['m2', 'm1']);
    expect(groups[1].matches.map((m) => matchIdOf(m))).toEqual(['m3']);
  });

  test('distance rounds for presentation', () => {
    expect(formatDistanceKmDisplay(4.97)).toBe('5 km');
    expect(formatDistanceKmDisplay(0.4)).toBe('0.4 km');
    expect(formatDistanceKmDisplay('x')).toBeNull();
  });

  test('selected range uses selected fixtures only (inclusive days)', () => {
    const range = selectedTripRange([
      mkMatch('m1', '2026-09-07T15:00:00.000Z'),
      mkMatch('m2', '2026-09-10T18:00:00.000Z'),
    ]);
    expect(range.count).toBe(2);
    expect(range.dayCount).toBe(4);
    const single = selectedTripRange([mkMatch('m1', '2026-09-07T15:00:00.000Z')]);
    expect(single.dayCount).toBe(1);
    expect(selectedTripRange([]).dayCount).toBe(0);
  });

  test('day header is localized, not hardcoded English', () => {
    const en = formatDayHeader('2026-09-07T15:00:00.000Z', 'en');
    const pl = formatDayHeader('2026-09-07T15:00:00.000Z', 'pl');
    expect(en).not.toBe('');
    expect(pl).not.toBe('');
    expect(en).not.toBe(pl);
  });

  test('kickoff shows time only; approximate prefixed', () => {
    const t = formatKickoffTime('2026-09-07T15:30:00.000Z', 'en', false);
    expect(t).toMatch(/\d/);
    expect(t).not.toContain('2026');
    expect(formatKickoffTime('2026-09-07T15:30:00.000Z', 'en', true).startsWith('~')).toBe(true);
  });

  test('short day range collapses single day', () => {
    expect(
      formatShortDayRange('2026-09-07T12:00:00.000Z', '2026-09-07T18:00:00.000Z', 'en')
    ).not.toContain('–');
    expect(
      formatShortDayRange('2026-09-07T12:00:00.000Z', '2026-09-10T18:00:00.000Z', 'en')
    ).toContain('–');
  });

  test('dedupeMatches drops same id and same fixture under different ids', () => {
    const a = mkMatch('m1', '2026-09-07T15:00:00.000Z');
    const sameId = mkMatch('m1', '2026-09-07T15:00:00.000Z');
    const sameFixtureNewId = {
      ...mkMatch('m2', '2026-09-07T15:00:00.000Z'),
      _id: 'other-form-of-m1',
      homeTeam: a.homeTeam,
      awayTeam: a.awayTeam,
      competition: a.competition,
      stadium: a.stadium,
    };
    const other = mkMatch('m3', '2026-09-10T18:00:00.000Z');
    const out = dedupeMatches([a, sameId, sameFixtureNewId as never, other]);
    expect(out.map((m) => matchIdOf(m))).toEqual(['m1', 'm3']);
  });
});
