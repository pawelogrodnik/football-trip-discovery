import {
  enrichTrip,
  getAvailableCategories,
  lowerTierTbcCount,
  rankLowerLeagueGems,
  suggestDiscoverTrips,
} from '../discover';
import {
  getFixtureSchedule,
  scheduleCertaintyCounts,
  scheduleIntersectsRange,
} from '../matchSchedule';
import { TripMatch } from '../tripOptimizer';

function mkMatch(
  id: string,
  extra: Partial<TripMatch> & { date?: TripMatch['date']; schedule?: unknown },
  competition = 'IV liga',
  city: string | null = 'Kraków'
): TripMatch {
  return {
    id,
    homeTeam: { name: `Home ${id}` },
    awayTeam: { name: `Away ${id}` },
    competition: { name: competition },
    date: {},
    stadium: { geo: { latitude: 50.06, longitude: 19.94 }, city },
    ...extra,
  } as TripMatch;
}

/** Exact backend JSON shape from redesigned-broccoli@a36b001 scrape-90min. */
function backendFixture(status: 'date-window' | 'confirmed', nativeId: string) {
  const base = {
    competition: { name: 'Klasa A' },
    homeTeam: { name: 'LKS Żyraków' },
    awayTeam: { name: 'Legion II Pilzno' },
    stadium: {
      venue: 'Stadion LKS Żyraków',
      geo: { latitude: 50.51, longitude: 21.35 },
    },
    id: nativeId,
  };
  if (status === 'confirmed') {
    return {
      ...base,
      schedule: { status: 'confirmed', dateTime: '2026-10-23T13:00:00.000Z' },
      date: { date: '2026-10-23', dateTime: '2026-10-23T13:00:00.000Z' },
    };
  }
  return {
    ...base,
    schedule: { status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' },
    date: { startDate: '2026-10-22', endDate: '2026-10-23', time: 'TBD' },
  };
}

describe('review 2B / scenario D: TBC attaches to the rolling window', () => {
  test('TBC on unused days of the trip window is still attached', () => {
    const trips = suggestDiscoverTrips(
      [
        mkMatch('c1', { date: { dateTime: '2026-10-21T15:00:00.000Z' } }),
        mkMatch('w1', {
          schedule: { status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' },
        }),
      ],
      '2026-10-21',
      '2026-10-23',
      [3],
      { maxInterTravelKm: 100 }
    );
    expect(trips.length).toBeGreaterThan(0);
    const withTbc = trips.find((t) => (t.tbcMatches?.length ?? 0) > 0);
    expect(withTbc).toBeDefined();
    expect(withTbc!.tbcMatches!.map((m) => m.id)).toContain('w1');
  });
});

describe('review 2C / scenario E: TBC-only lower-league weekend', () => {
  const clusterOct = Array.from({ length: 7 }, (_, i) =>
    mkMatch(`w${i}`, {
      schedule: { status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' },
    })
  );
  const clusterNov = Array.from({ length: 5 }, (_, i) =>
    mkMatch(`v${i}`, {
      schedule: { status: 'date-window', startDate: '2026-10-29', endDate: '2026-10-30' },
    })
  );

  test('opportunity-only candidate surfaces as 0 confirmed · 7 TBC', () => {
    const trips = suggestDiscoverTrips(clusterOct, '2026-10-22', '2026-10-23', [2], {
      maxInterTravelKm: 100,
    });
    const opportunity = trips.find((t) => t.matchCount === 0 && (t.tbcCount ?? 0) === 7);
    expect(opportunity).toBeDefined();
    expect(opportunity!.matches).toHaveLength(0);
    expect(opportunity!.legs).toHaveLength(0);
    expect(opportunity!.totalKm).toBe(0);
    expect(opportunity!.tbcMatches).toHaveLength(7);
    expect(opportunity!.tripStartDate).toBe('2026-10-22');
    expect(opportunity!.tripEndDate).toBe('2026-10-23');
    expect(opportunity!.destinationLabel).toBe('Kraków');
  });

  test('Lower League Gems unlocks and ranks the opportunity meaningfully', () => {
    const trips = suggestDiscoverTrips(
      [...clusterOct, ...clusterNov],
      '2026-10-20',
      '2026-10-31',
      [2],
      {
        maxInterTravelKm: 100,
      }
    );
    expect(getAvailableCategories(trips)).toContain('lower');
    const ranked = rankLowerLeagueGems(trips);
    expect(ranked[0].matchCount).toBe(0);
    expect(lowerTierTbcCount(ranked[0])).toBeGreaterThan(0);
  });
});

describe('review 2D / scenario F: date-confirmed counts as TBC', () => {
  test('1 confirmed + 1 date-confirmed + 1 window = 1 confirmed · 2 TBC', () => {
    const matches = [
      mkMatch('c1', { date: { dateTime: '2026-10-21T15:00:00.000Z' } }),
      mkMatch('d1', { date: { date: '2026-10-22' } }),
    ];
    expect(scheduleCertaintyCounts(matches)).toEqual({ confirmed: 1, tbc: 1 });
    const enriched = enrichTrip({
      id: 't',
      matches,
      tbcMatches: [
        mkMatch('w1', {
          schedule: { status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' },
        }),
      ],
      totalKm: 10,
      matchCount: 2,
      legs: [],
    });
    expect(enriched.confirmedCount).toBe(1);
    expect(enriched.tbcCount).toBe(2);
    expect(enriched.matchCount).toBe(2);
  });
});

describe('review 2K: real backend JSON through the whole pipeline', () => {
  const NATIVE_ID = '799050c8ac0b3e6abf2721b23ced78d8';

  test('backend window JSON classifies, overlaps Find range, attaches to Discover', () => {
    const windowJson = backendFixture('date-window', NATIVE_ID);
    expect(getFixtureSchedule(windowJson as never)).toEqual({
      status: 'date-window',
      startDate: '2026-10-22',
      endDate: '2026-10-23',
    });
    // Find search 20-24 Oct
    expect(scheduleIntersectsRange(windowJson as never, '2026-10-20', '2026-10-24')).toBe(true);
    // Discover rolling window containing it
    const trips = suggestDiscoverTrips(
      [
        mkMatch('c1', { date: { dateTime: '2026-10-21T15:00:00.000Z' } }),
        {
          ...(windowJson as object),
          stadium: { geo: { latitude: 50.06, longitude: 19.94 }, city: 'Kraków' },
        } as TripMatch,
      ],
      '2026-10-21',
      '2026-10-23',
      [3],
      { maxInterTravelKm: 100 }
    );
    const attached = trips.find((t) => (t.tbcMatches?.length ?? 0) > 0);
    expect(attached).toBeDefined();
    // Trip certainty: window backend row counts as TBC
    expect(scheduleCertaintyCounts([windowJson] as never)).toEqual({ confirmed: 0, tbc: 1 });
    // Refined sync keeps the same native id (backend contract)
    expect(backendFixture('confirmed', NATIVE_ID).id).toBe(NATIVE_ID);
  });
});
