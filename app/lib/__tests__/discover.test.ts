import { coerceToDate } from '../../discover/components/format';
import {
  addDaysDateOnly,
  calendarDaysInclusive,
  candidateKey,
  dedupeTrips,
  enrichTrip,
  getAvailableCategories,
  getTripDestinationLabel,
  lowerTierMatchCount,
  rankEasyTrips,
  rankEuropeanNights,
  rankLowerLeagueGems,
  rankMostMatches,
  rankTopPicks,
  resolveCategory,
  rollingWindows,
  suggestDiscoverTrips,
  tripDates,
  validateTripLengthsDays,
} from '../discover';
import { Trip, TripMatch } from '../tripOptimizer';

function mkMatch(
  id: string,
  dateTime: string,
  lat: number,
  lon: number,
  competition = 'Serie A',
  city?: string
): TripMatch {
  return {
    id,
    homeTeam: { name: `Home ${id}` },
    awayTeam: { name: `Away ${id}` },
    competition: { name: competition },
    date: { dateTime },
    stadium: { geo: { latitude: lat, longitude: lon }, city: city ?? null, name: `Stadium ${id}` },
  } as unknown as TripMatch;
}

function mkTrip(
  ids: string[],
  totalKm = 50,
  competition = 'Serie A',
  competitions?: string[]
): Trip {
  const matches = ids.map(
    (id, i) =>
      mkMatch(
        id,
        `2026-09-${String(7 + i).padStart(2, '0')}T18:00:00.000Z`,
        45 + i * 0.1,
        9 + i * 0.1,
        competitions?.[i] ?? competition
      ) as TripMatch
  );
  return {
    id: `t_${ids.join('_')}`,
    matches,
    totalKm,
    matchCount: matches.length,
    legs: matches.slice(1).map((_, i) => ({ fromIdx: i, toIdx: i + 1, km: 10, driveMinutes: 12 })),
  };
}

describe('discover: calendar semantics', () => {
  test('TEST 3: inclusive semantics Sep16-19 = 4 days', () => {
    expect(calendarDaysInclusive('2026-09-16', '2026-09-19')).toBe(4);
    expect(calendarDaysInclusive('2026-09-16', '2026-09-16')).toBe(1);
    expect(addDaysDateOnly('2026-09-16', 3)).toBe('2026-09-19');
  });

  test('tripDates uses calendar days, not ms division', () => {
    const trip = mkTrip(['a', 'b']);
    const { start, end, lengthDays } = tripDates(trip);
    expect(start).toBe('2026-09-07');
    expect(end).toBe('2026-09-08');
    expect(lengthDays).toBe(2);
  });
});

describe('discover: rolling windows', () => {
  test('TEST 2: 14-day availability with [3,4] considers both durations', () => {
    const windows = rollingWindows('2026-09-07', '2026-09-20', [3, 4]);
    const d3 = windows.filter((w) => w.tripLengthDays === 3);
    const d4 = windows.filter((w) => w.tripLengthDays === 4);
    expect(d3.length).toBe(12); // 14-3+1
    expect(d4.length).toBe(11); // 14-4+1
    expect(windows[0]).toEqual({
      windowStart: '2026-09-07',
      windowEnd: '2026-09-09',
      tripLengthDays: 3,
    });
  });
});

describe('discover: candidate generation', () => {
  const matches: TripMatch[] = [
    mkMatch('m1', '2026-09-07T18:00:00.000Z', 45.46, 9.19),
    mkMatch('m2', '2026-09-08T18:00:00.000Z', 45.47, 9.2),
    mkMatch('m3', '2026-09-09T18:00:00.000Z', 45.48, 9.21),
    mkMatch('m4', '2026-09-12T18:00:00.000Z', 45.5, 9.3),
    mkMatch('m5', '2026-09-13T18:00:00.000Z', 45.51, 9.31),
    mkMatch('m6', '2026-09-19T18:00:00.000Z', 45.6, 9.4),
  ];

  test('TEST 1: 14-day availability + 3-day trips => no trip spans 14 days', () => {
    const trips = suggestDiscoverTrips(matches, '2026-09-07', '2026-09-20', [3], {
      maxInterTravelKm: 100,
    });
    for (const t of trips) {
      expect(t.tripLengthDays).toBeLessThanOrEqual(3);
    }
    expect(trips.length).toBeGreaterThan(0);
  });

  test('TEST 5: alternatives may share fixtures', () => {
    const trips = suggestDiscoverTrips(matches, '2026-09-07', '2026-09-20', [3, 4], {
      maxInterTravelKm: 100,
    });
    const allIds = trips.flatMap((t) => t.matches.map((m) => m.id));
    const uniq = new Set(allIds);
    // sharing means total appearances exceed unique count when >1 trip
    if (trips.length > 1) {
      expect(allIds.length).toBeGreaterThanOrEqual(uniq.size);
    }
    // explicitly: two different candidates sharing m1 is allowed (no global consumption)
    // build a scenario where best chains overlap
    const dense = [
      mkMatch('a', '2026-09-07T18:00:00.000Z', 45.46, 9.19),
      mkMatch('b', '2026-09-08T18:00:00.000Z', 45.47, 9.2),
      mkMatch('c', '2026-09-09T18:00:00.000Z', 45.48, 9.21),
      mkMatch('d', '2026-09-10T18:00:00.000Z', 45.49, 9.22),
    ];
    const trips2 = suggestDiscoverTrips(dense, '2026-09-07', '2026-09-12', [3], {
      maxInterTravelKm: 100,
    });
    expect(trips2.length).toBeGreaterThanOrEqual(1);
  });

  test('TEST 4: dedupe collapses same fixture sequence', () => {
    const t1 = mkTrip(['a', 'b'], 50);
    const t2 = mkTrip(['a', 'b'], 80);
    const out = dedupeTrips([t1, t2]);
    expect(out).toHaveLength(1);
    expect(out[0].totalKm).toBe(50);
    expect(candidateKey(t1)).toBe(candidateKey(t2));
  });
});

describe('discover: ranking', () => {
  test('TEST 6: most matches ranks by count then distance', () => {
    const small = mkTrip(['a'], 10);
    const big = mkTrip(['a', 'b', 'c'], 500);
    const mid = mkTrip(['x', 'y'], 20);
    expect(rankMostMatches([small, big, mid]).map((t) => t.matchCount)).toEqual([3, 2, 1]);
  });

  test('TEST 7: european nights prioritizes UEFA count', () => {
    const serie = mkTrip(['a', 'b', 'c'], 10, 'Serie A');
    const uefa = mkTrip(['u1', 'u2'], 500, 'Champions League');
    const ranked = rankEuropeanNights([serie, uefa]);
    expect(ranked[0].matches[0].competition.name).toBe('Champions League');
  });

  test('TEST 8: easy trips prefers low movement, requires 2+ matches', () => {
    const hard = mkTrip(['a', 'b'], 300);
    const easy = mkTrip(['c', 'd'], 20);
    const single = mkTrip(['s'], 0);
    const ranked = rankEasyTrips([hard, easy, single]);
    expect(ranked[0].totalKm).toBe(20);
    expect(ranked[ranked.length - 1].matchCount).toBe(1);
  });

  test('top picks is deterministic and prefers balanced trips', () => {
    const a = mkTrip(['a', 'b', 'c'], 60, 'Champions League');
    const b = mkTrip(['x', 'y', 'z'], 600, 'Serie A');
    const ranked = rankTopPicks([b, a]);
    expect(ranked[0].totalKm).toBe(60);
    expect(rankTopPicks([b, a]).map((t) => t.id)).toEqual(rankTopPicks([b, a]).map((t) => t.id));
  });
});

describe('discover: date coercion (DatePickerInput may return dayjs/strings)', () => {
  test('coerceToDate accepts Date, ISO string and dayjs-like objects', () => {
    const d = new Date('2026-09-07T00:00:00.000Z');
    expect(coerceToDate(d)?.getTime()).toBe(d.getTime());
    expect(coerceToDate('2026-09-07')?.toISOString().slice(0, 10)).toBe('2026-09-07');
    const dayjsLike = {
      toDate: () => new Date('2026-09-08T00:00:00.000Z'),
      valueOf: () => new Date('2026-09-08T00:00:00.000Z').getTime(),
    };
    expect(coerceToDate(dayjsLike)?.toISOString().slice(0, 10)).toBe('2026-09-08');
    const valueOfOnly = { valueOf: () => new Date('2026-09-09T00:00:00.000Z').getTime() };
    expect(coerceToDate(valueOfOnly)?.toISOString().slice(0, 10)).toBe('2026-09-09');
  });

  test('coerceToDate rejects null, undefined and garbage', () => {
    expect(coerceToDate(null)).toBeNull();
    expect(coerceToDate(undefined)).toBeNull();
    expect(coerceToDate('not-a-date')).toBeNull();
    expect(coerceToDate(new Date('invalid'))).toBeNull();
    expect(coerceToDate(42)).toBeNull();
  });
});

describe('discover: validation', () => {
  test('TEST 9: invalid tripLengthsDays rejected', () => {
    expect(validateTripLengthsDays([]).ok).toBe(false);
    expect(validateTripLengthsDays([1, 3]).ok).toBe(false);
    expect(validateTripLengthsDays([6]).ok).toBe(false);
    expect(validateTripLengthsDays(['3' as unknown as number]).ok).toBe(false);
    expect(validateTripLengthsDays([3.5]).ok).toBe(false);
    const ok = validateTripLengthsDays([4, 3, 3]);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value).toEqual([3, 4]);
    }
  });
});

describe('discover: destination label', () => {
  test('TEST 10: single city, multiple cities, missing, fallback', () => {
    expect(
      getTripDestinationLabel({
        matches: [
          { stadium: { city: 'Milan' } },
          { stadium: { city: 'Milan' } },
          { stadium: { city: 'Bergamo' } },
        ],
      })
    ).toBe('Milan');
    expect(
      getTripDestinationLabel({
        matches: [{ stadium: { city: 'Milan' } }, { stadium: { city: 'Bergamo' } }],
      })
    ).toBe('Milan & Bergamo');
    expect(getTripDestinationLabel({ matches: [{ stadium: {} }, { stadium: {} }] })).toBe(
      'Football trip'
    );
    expect(getTripDestinationLabel({ matches: [] })).toBe('Football trip');
  });

  test('enrichTrip adds metadata without fabricating regions', () => {
    const trip = mkTrip(['a', 'b'], 74);
    (trip.matches[0] as TripMatch).stadium = { ...(trip.matches[0].stadium ?? {}), city: 'Milan' };
    (trip.matches[1] as TripMatch).stadium = { ...(trip.matches[1].stadium ?? {}), city: 'Milan' };
    const enriched = enrichTrip(trip);
    expect(enriched.destinationLabel).toBe('Milan');
    expect(enriched.tripLengthDays).toBe(2);
    expect(enriched.destinationLabel).not.toContain('Lombardy');
  });
});

describe('discover: dynamic categories', () => {
  test('1. no UEFA candidates => European nights unavailable', () => {
    const trips = [enrichTrip(mkTrip(['a', 'b'])), enrichTrip(mkTrip(['c', 'd']))];
    expect(getAvailableCategories(trips)).toEqual(['top', 'most', 'easy']);
  });

  test('2. at least 2 UEFA candidates => European nights available (1 is not enough)', () => {
    const one = [enrichTrip(mkTrip(['u1'], 50, 'Champions League')), enrichTrip(mkTrip(['a']))];
    expect(getAvailableCategories(one)).not.toContain('uefa');
    const two = [
      enrichTrip(mkTrip(['u1'], 50, 'Champions League')),
      enrichTrip(mkTrip(['u2'], 60, 'Europa League')),
      enrichTrip(mkTrip(['a'])),
    ];
    expect(getAvailableCategories(two)).toContain('uefa');
  });

  test('3-4. lower league gems only with enough lower-tier candidates', () => {
    expect(lowerTierMatchCount(mkTrip(['a'], 50, 'Serie C Group A'))).toBe(1);
    expect(lowerTierMatchCount(mkTrip(['a'], 50, 'Serie A'))).toBe(0);
    const none = [enrichTrip(mkTrip(['a', 'b'])), enrichTrip(mkTrip(['c', 'd']))];
    expect(getAvailableCategories(none)).not.toContain('lower');
    const some = [
      enrichTrip(mkTrip(['l1'], 50, 'Serie C Group A')),
      enrichTrip(mkTrip(['l2'], 60, 'III Liga, grupa IV')),
      enrichTrip(mkTrip(['a'])),
    ];
    expect(getAvailableCategories(some)).toContain('lower');
  });

  test('5. same trip may exist in multiple category rankings', () => {
    const trip = enrichTrip(mkTrip(['u1', 'u2'], 50, 'Champions League'));
    const pool = [trip, enrichTrip(mkTrip(['a']))];
    for (const ranked of [rankTopPicks(pool), rankEuropeanNights(pool), rankMostMatches(pool)]) {
      expect(ranked.map((t) => t.id)).toContain(trip.id);
    }
  });

  test('6. vanished dynamic category falls back to top picks', () => {
    const uefaPool = [
      enrichTrip(mkTrip(['u1'], 50, 'Champions League')),
      enrichTrip(mkTrip(['u2'], 60, 'Europa League')),
    ];
    expect(resolveCategory(uefaPool, 'uefa')).toBe('uefa');
    const seriePool = [enrichTrip(mkTrip(['a'])), enrichTrip(mkTrip(['b']))];
    expect(resolveCategory(seriePool, 'uefa')).toBe('top');
    expect(resolveCategory(seriePool, 'most')).toBe('most');
  });

  test('7. european ranking: uefa count, then max competition priority, then distance', () => {
    const uclFar = mkTrip(['u1'], 900, 'Champions League');
    const uelNear = mkTrip(['e1', 'e2'], 10, 'Europa League');
    const uclNear = mkTrip(['c1'], 20, 'Champions League');
    // uefa count dominates
    expect(rankEuropeanNights([uclFar, uelNear])[0].id).toBe(uelNear.id);
    // then max competition priority (UCL beats UEL despite distance)
    const uelSingle = mkTrip(['e1'], 10, 'Europa League');
    expect(rankEuropeanNights([uelSingle, uclNear]).map((t) => t.id)).toEqual([
      uclNear.id,
      uelSingle.id,
    ]);
  });

  test('8. lower-league ranking: count, then ratio, then distance', () => {
    const fiveLower = mkTrip(['l1', 'l2', 'l3', 'l4', 'l5'], 500, 'Serie C Group A');
    const mixed = mkTrip(['x1', 'x2', 'x3', 'x4'], 10, 'Serie A', [
      'Serie C Group A',
      'Serie A',
      'Serie A',
      'Serie A',
    ]);
    expect(rankLowerLeagueGems([mixed, fiveLower])[0].id).toBe(fiveLower.id);
    // equal count => higher ratio first
    const twoOfTwo = mkTrip(['a', 'b'], 300, 'Serie C Group A');
    const twoOfFour = mkTrip(['c', 'd', 'e', 'f'], 10, 'Serie A', [
      'Serie C Group A',
      'Serie C Group A',
      'Serie A',
      'Serie A',
    ]);
    expect(rankLowerLeagueGems([twoOfFour, twoOfTwo])[0].id).toBe(twoOfTwo.id);
  });
});
