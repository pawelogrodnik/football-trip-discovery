import { suggestDiscoverTrips } from 'lib/discover';
import {
  DEFAULT_INTER_TRAVEL_KM,
  DISTANCE_OPTIONS,
  FIND_RADIUS_MAX_KM,
  FOOTBALL_DISTANCE_OPTIONS_KM,
  MAX_INTER_TRAVEL_KM,
  MIN_INTER_TRAVEL_KM,
  parseFindRadiusKm,
  parseMaxInterTravelKm,
  snapRadiusUp,
} from 'lib/distance';
import { TripMatch } from 'lib/tripOptimizer';

function mkMatch(id: string, dateTime: string, lat: number, lon: number): TripMatch {
  return {
    id,
    homeTeam: { name: `Home ${id}` },
    awayTeam: { name: `Away ${id}` },
    competition: { name: 'Serie A' },
    date: { dateTime },
    stadium: { geo: { latitude: lat, longitude: lon }, city: 'Milan', name: `Stadium ${id}` },
  } as unknown as TripMatch;
}

describe('distance constants', () => {
  it('supports compact trips down to 5 km with 100 km default', () => {
    expect(MIN_INTER_TRAVEL_KM).toBe(5);
    expect(DEFAULT_INTER_TRAVEL_KM).toBe(100);
    expect(DISTANCE_OPTIONS.map((o) => o.value)).toEqual([5, 10, 25, 50, 100, 150, 250]);
  });

  it('shares one distance scale across Discover and Find Matches', () => {
    expect([...FOOTBALL_DISTANCE_OPTIONS_KM]).toEqual([5, 10, 25, 50, 100, 150, 250]);
    expect(FOOTBALL_DISTANCE_OPTIONS_KM).toContain(5);
    expect(FOOTBALL_DISTANCE_OPTIONS_KM).toContain(10);
    // Discover chips derive from the same scale — no duplicated arrays
    expect(DISTANCE_OPTIONS.map((o) => o.value)).toEqual([...FOOTBALL_DISTANCE_OPTIONS_KM]);
  });

  it('Discover still defaults to 100 km', () => {
    expect(DEFAULT_INTER_TRAVEL_KM).toBe(100);
    expect(FOOTBALL_DISTANCE_OPTIONS_KM).toContain(DEFAULT_INTER_TRAVEL_KM);
  });
});

describe('parseMaxInterTravelKm', () => {
  it.each([5, 10, 25, 50, 100, 150, 250, MAX_INTER_TRAVEL_KM])('accepts %i km', (value) => {
    expect(parseMaxInterTravelKm(value)).toBe(value);
  });

  it('accepts the 5 km compact minimum', () => {
    expect(parseMaxInterTravelKm(5)).toBe(5);
  });

  it('accepts the 10 km city value', () => {
    expect(parseMaxInterTravelKm(10)).toBe(10);
  });

  it.each([4, 0, -1, 2.5])('rejects below-minimum value %p', (value) => {
    expect(() => parseMaxInterTravelKm(value)).toThrow(RangeError);
  });

  it('rejects values above the supported maximum', () => {
    expect(() => parseMaxInterTravelKm(MAX_INTER_TRAVEL_KM + 1)).toThrow(RangeError);
  });

  it.each([NaN, 'abc', undefined, null, {}, []])('rejects non-numeric value %p', (value) => {
    expect(() => parseMaxInterTravelKm(value)).toThrow(TypeError);
  });
});

describe('candidate generation respects maxInterTravelKm', () => {
  // A and B are ~1.3 km apart; C is ~75 km away from both.
  const matches = [
    mkMatch('a', '2026-09-07T18:00:00.000Z', 45.46, 9.19),
    mkMatch('b', '2026-09-08T18:00:00.000Z', 45.4705, 9.205),
    mkMatch('c', '2026-09-09T18:00:00.000Z', 46.0, 9.9),
  ];

  it('5 km keeps compact chains and never links the far venue', () => {
    const trips = suggestDiscoverTrips(matches, '2026-09-07', '2026-09-09', [3], {
      maxInterTravelKm: 5,
    });
    expect(trips.length).toBeGreaterThan(0);
    for (const t of trips) {
      for (const leg of t.legs ?? []) {
        expect(leg.km).toBeLessThanOrEqual(5);
      }
      const ids = t.matches.map((m) => String((m as { id?: string }).id ?? ''));
      // c must travel alone — never chained with a/b under a 5 km hop limit
      if (ids.includes('c')) {
        expect(ids).toEqual(['c']);
      }
    }
    // compact pair still forms a 2-match trip
    expect(trips.some((t) => t.matchCount === 2)).toBe(true);
  });

  it('100 km allows the regional chain of all three', () => {
    const trips = suggestDiscoverTrips(matches, '2026-09-07', '2026-09-09', [3], {
      maxInterTravelKm: 100,
    });
    expect(trips.some((t) => t.matchCount === 3)).toBe(true);
  });
});

describe('parseFindRadiusKm (Find Matches radius semantics)', () => {
  it.each([...FOOTBALL_DISTANCE_OPTIONS_KM])('accepts shared scale value %i km', (value) => {
    expect(parseFindRadiusKm(value)).toBe(value);
  });

  it('accepts a 5 km local radius', () => {
    expect(parseFindRadiusKm(5)).toBe(5);
  });

  it('accepts a 10 km radius', () => {
    expect(parseFindRadiusKm(10)).toBe(10);
  });

  it.each([4, 0, -3])('rejects radius below the 5 km minimum: %p', (value) => {
    expect(() => parseFindRadiusKm(value)).toThrow(RangeError);
  });

  it('allows custom larger radii for derived trip areas', () => {
    expect(parseFindRadiusKm(300)).toBe(300);
    expect(() => parseFindRadiusKm(FIND_RADIUS_MAX_KM + 1)).toThrow(RangeError);
  });
});

describe('snapRadiusUp (Customize radius)', () => {
  it.each([
    [17, 25],
    [44, 50],
    [91, 100],
    [25, 25],
    [5, 5],
    [3, 5],
    [150, 150],
    [200, 250],
    [250, 250],
  ])('snaps required %i km up to %i km', (required, expected) => {
    expect(snapRadiusUp(required)).toBe(expected);
  });

  it('never snaps downward below the required radius', () => {
    for (let required = 1; required <= 260; required += 1) {
      expect(snapRadiusUp(required)).toBeGreaterThanOrEqual(required);
    }
  });

  it('falls back to a rounded custom value above the largest option instead of dropping venues', () => {
    const snapped = snapRadiusUp(251);
    expect(snapped).toBeGreaterThanOrEqual(251);
    expect(snapped).toBeLessThanOrEqual(FIND_RADIUS_MAX_KM);
    expect(parseFindRadiusKm(snapped)).toBe(snapped);
  });
});

describe('frontend options and backend validation cannot drift', () => {
  it('every shared option passes Discover validation', () => {
    for (const v of FOOTBALL_DISTANCE_OPTIONS_KM) {
      expect(parseMaxInterTravelKm(v)).toBe(v);
    }
  });

  it('every shared option passes Find radius validation', () => {
    for (const v of FOOTBALL_DISTANCE_OPTIONS_KM) {
      expect(parseFindRadiusKm(v)).toBe(v);
    }
  });
});
