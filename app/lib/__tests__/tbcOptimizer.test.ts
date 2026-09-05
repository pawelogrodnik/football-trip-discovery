import { suggestDiscoverTrips } from '../discover';
import { isWindowOnlyMatch, suggestTrips, TripMatch } from '../tripOptimizer';

function mkMatch(
  id: string,
  extra: Partial<TripMatch> & { date?: TripMatch['date']; schedule?: unknown }
): TripMatch {
  return {
    id,
    homeTeam: { name: `Home ${id}` },
    awayTeam: { name: `Away ${id}` },
    competition: { name: 'IV liga' },
    date: {},
    stadium: { geo: { latitude: 50.06, longitude: 19.94 } },
    ...extra,
  } as TripMatch;
}

describe('optimizer 3-tier (issue #9)', () => {
  test('confirmed fixtures on different days chain normally', () => {
    const trips = suggestTrips(
      [
        mkMatch('c1', { date: { dateTime: '2026-10-22T15:00:00.000Z' } }),
        mkMatch('c2', { date: { dateTime: '2026-10-23T18:00:00.000Z' } }),
      ],
      { maxInterTravelKm: 100, limit: 1 }
    );
    expect(trips).toHaveLength(1);
    expect(trips[0].matches).toHaveLength(2);
  });

  test('two date-confirmed fixtures on the same day never share an itinerary', () => {
    const trips = suggestTrips(
      [
        mkMatch('d1', { date: { date: '2026-10-23' } }),
        mkMatch('d2', { date: { date: '2026-10-23' } }),
      ],
      { maxInterTravelKm: 100, limit: 3 }
    );
    for (const t of trips) {
      expect(t.matches.length).toBeLessThanOrEqual(1);
    }
  });

  test('confirmed + date-confirmed on the same day are incompatible', () => {
    const trips = suggestTrips(
      [
        mkMatch('c1', { date: { dateTime: '2026-10-23T15:00:00.000Z' } }),
        mkMatch('d1', { date: { date: '2026-10-23' } }),
      ],
      { maxInterTravelKm: 100, limit: 3 }
    );
    for (const t of trips) {
      expect(t.matches.length).toBeLessThanOrEqual(1);
    }
  });

  test('date-confirmed on different days can chain', () => {
    const trips = suggestTrips(
      [
        mkMatch('d1', { date: { date: '2026-10-22' } }),
        mkMatch('d2', { date: { date: '2026-10-24' } }),
      ],
      { maxInterTravelKm: 100, limit: 1 }
    );
    expect(trips[0]?.matches).toHaveLength(2);
  });

  test('date-window fixtures never enter the optimizer', () => {
    const windowMatch = mkMatch('w1', {
      schedule: { status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' },
    });
    expect(isWindowOnlyMatch(windowMatch)).toBe(true);
    const trips = suggestTrips(
      [windowMatch, mkMatch('c1', { date: { dateTime: '2026-10-22T15:00:00.000Z' } })],
      { maxInterTravelKm: 100, limit: 3 }
    );
    for (const t of trips) {
      expect(t.matches.map((m) => m.id)).not.toContain('w1');
    }
  });
});

describe('discover TBC attach', () => {
  test('window fixtures attach as tbcMatches without inflating matchCount', () => {
    const trips = suggestDiscoverTrips(
      [
        mkMatch('c1', { date: { dateTime: '2026-10-22T15:00:00.000Z' } }),
        mkMatch('c2', { date: { dateTime: '2026-10-23T18:00:00.000Z' } }),
        mkMatch('w1', {
          schedule: { status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' },
        }),
      ],
      '2026-10-21',
      '2026-10-24',
      [3],
      { maxInterTravelKm: 100 }
    );
    expect(trips.length).toBeGreaterThan(0);
    const withTbc = trips.find((t) => (t.tbcMatches?.length ?? 0) > 0);
    expect(withTbc).toBeDefined();
    expect(withTbc!.matchCount).toBe(withTbc!.matches.length);
    expect(withTbc!.tbcMatches!.map((m) => m.id)).toContain('w1');
  });
});
