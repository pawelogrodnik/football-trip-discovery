import { deriveFindContextFromTrip } from 'lib/tripUrls';
import {
  clusterTbcByGeo,
  enrichTrip,
  isTbcRelevantToItinerary,
  rankLowerLeagueGems,
  suggestDiscoverTrips,
  tripMapSources,
} from '../discover';
import { TripMatch } from '../tripOptimizer';

const GEO = {
  Milan: { latitude: 45.46, longitude: 9.19 },
  Bergamo: { latitude: 45.69, longitude: 9.67 },
  Monza: { latitude: 45.58, longitude: 9.27 },
  Brescia: { latitude: 45.54, longitude: 10.22 },
  Bologna: { latitude: 44.49, longitude: 11.34 },
  Krakow: { latitude: 50.06, longitude: 19.94 },
  Wieliczka: { latitude: 49.98, longitude: 20.06 },
  Niepolomice: { latitude: 50.03, longitude: 20.21 },
  Palermo: { latitude: 38.11, longitude: 13.35 },
};

function confirmed(
  id: string,
  city: keyof typeof GEO,
  dateTime = '2026-10-21T15:00:00.000Z',
  competition = 'Serie A'
): TripMatch {
  return {
    id,
    homeTeam: { name: `Home ${id}` },
    awayTeam: { name: `Away ${id}` },
    competition: { name: competition },
    date: { dateTime },
    stadium: { geo: GEO[city], city },
  } as unknown as TripMatch;
}

function windowOnly(
  id: string,
  geoKey: keyof typeof GEO,
  competition = 'IV liga',
  startDate = '2026-10-22',
  endDate = '2026-10-23',
  city?: string
): TripMatch {
  return {
    id,
    homeTeam: { name: `Home ${id}` },
    awayTeam: { name: `Away ${id}` },
    competition: { name: competition },
    schedule: { status: 'date-window', startDate, endDate },
    date: { startDate, endDate, time: 'TBD' },
    stadium: { geo: GEO[geoKey], city: city ?? geoKey },
  } as unknown as TripMatch;
}

describe('A. mixed trip geographic attachment', () => {
  test('Monza attaches to Milan; Kraków is excluded', () => {
    const itinerary = [confirmed('c1', 'Milan')];
    expect(isTbcRelevantToItinerary(windowOnly('monza', 'Monza'), itinerary, 100)).toBe(true);
    expect(isTbcRelevantToItinerary(windowOnly('krk', 'Krakow'), itinerary, 100)).toBe(false);

    const trips = suggestDiscoverTrips(
      [confirmed('c1', 'Milan'), windowOnly('monza', 'Monza'), windowOnly('krk', 'Krakow')],
      '2026-10-21',
      '2026-10-23',
      [3],
      { maxInterTravelKm: 100 }
    );
    const withTbc = trips.find((t) => (t.tbcMatches?.length ?? 0) > 0);
    expect(withTbc).toBeDefined();
    expect(withTbc!.tbcMatches!.map((m) => m.id)).toEqual(['monza']);
  });
});

describe('B. distance to ANY itinerary venue (never centroid-only)', () => {
  test('fixture near Bergamo attaches to a Milan+Bergamo trip', () => {
    const itinerary = [confirmed('m1', 'Milan'), confirmed('b1', 'Bergamo')];
    // ~35 km from Bergamo, ~95 km from Milan, ~60 km from their centroid.
    const nearBergamo = windowOnly('nb', 'Bergamo');
    (nearBergamo.stadium as { geo: unknown }).geo = { latitude: 45.9, longitude: 10.1 };
    expect(isTbcRelevantToItinerary(nearBergamo, itinerary, 50)).toBe(true);
  });
});

describe('C. TBC-only cluster split', () => {
  const pool = [
    windowOnly('k1', 'Krakow', 'IV liga', '2026-10-22', '2026-10-23', 'Kraków'),
    windowOnly('k2', 'Krakow', 'IV liga', '2026-10-22', '2026-10-23', 'Kraków'),
    windowOnly('k3', 'Wieliczka', 'IV liga', '2026-10-22', '2026-10-23', 'Kraków'),
    windowOnly('m1', 'Milan', 'IV liga', '2026-10-22', '2026-10-23', 'Milan'),
    windowOnly('m2', 'Monza', 'IV liga', '2026-10-22', '2026-10-23', 'Milan'),
    windowOnly('p1', 'Palermo'),
  ];

  test('Kraków / Milan / Palermo become 3 separate candidates', () => {
    const clusters = clusterTbcByGeo(pool, 50);
    expect(clusters).toHaveLength(3);
    const sizes = clusters.map((c) => c.length).sort();
    expect(sizes).toEqual([1, 2, 3]);
  });

  test('suggestDiscoverTrips emits one opportunity candidate per cluster', () => {
    const trips = suggestDiscoverTrips(pool, '2026-10-22', '2026-10-23', [2], {
      maxInterTravelKm: 50,
    });
    const opportunities = trips.filter((t) => t.matchCount === 0);
    expect(opportunities).toHaveLength(3);
    for (const o of opportunities) {
      expect(o.tbcMatches!.length).toBeGreaterThan(0);
    }
  });
});

describe('D. connected-component chaining', () => {
  test('A-B and B-C near, A-C far => still one cluster', () => {
    const a = windowOnly('a', 'Krakow');
    const b = windowOnly('b', 'Krakow');
    (b.stadium as { geo: unknown }).geo = { latitude: 50.06, longitude: 20.44 };
    const c = windowOnly('c', 'Krakow');
    (c.stadium as { geo: unknown }).geo = { latitude: 50.06, longitude: 20.94 };
    const clusters = clusterTbcByGeo([a, b, c], 50);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(3);
  });
});

describe('E. destination comes from the cluster', () => {
  test('Kraków cluster => Kraków, Milan cluster => Milan', () => {
    const trips = suggestDiscoverTrips(
      [
        windowOnly('k1', 'Krakow', 'IV liga', '2026-10-22', '2026-10-23', 'Kraków'),
        windowOnly('k2', 'Wieliczka', 'IV liga', '2026-10-22', '2026-10-23', 'Kraków'),
        windowOnly('m1', 'Milan', 'IV liga', '2026-10-22', '2026-10-23', 'Milan'),
        windowOnly('m2', 'Monza', 'IV liga', '2026-10-22', '2026-10-23', 'Milan'),
      ],
      '2026-10-22',
      '2026-10-23',
      [2],
      { maxInterTravelKm: 50 }
    );
    const labels = trips
      .filter((t) => t.matchCount === 0)
      .map((t) => t.destinationLabel)
      .sort();
    expect(labels).toEqual(['Kraków', 'Milan']);
  });
});

describe('F. Customize stays cluster-local', () => {
  test('Kraków candidate customizes to Kraków ids/center only', () => {
    const trips = suggestDiscoverTrips(
      [
        windowOnly('k1', 'Krakow', 'IV liga', '2026-10-22', '2026-10-23', 'Kraków'),
        windowOnly('k2', 'Wieliczka', 'IV liga', '2026-10-22', '2026-10-23', 'Kraków'),
        windowOnly('m1', 'Milan', 'IV liga', '2026-10-22', '2026-10-23', 'Milan'),
      ],
      '2026-10-22',
      '2026-10-23',
      [2],
      { maxInterTravelKm: 50 }
    );
    const krakow = trips.find((t) => t.destinationLabel === 'Kraków');
    expect(krakow).toBeDefined();
    const ctx = deriveFindContextFromTrip(krakow!);
    expect(ctx.ids.sort()).toEqual(['k1', 'k2']);
    expect(ctx.location!.lat).toBeGreaterThan(49.5);
    expect(ctx.location!.lat).toBeLessThan(50.5);
  });
});

describe('G. map sources stay cluster-local', () => {
  test('selected Kraków cluster: markers Kraków-only, route empty', () => {
    const sources = tripMapSources({
      matches: [],
      tbcMatches: [
        windowOnly('k1', 'Krakow', 'IV liga', '2026-10-22', '2026-10-23', 'Kraków'),
        windowOnly('k2', 'Wieliczka', 'IV liga', '2026-10-22', '2026-10-23', 'Kraków'),
      ],
    });
    expect(sources.markers.map((m) => m.id).sort()).toEqual(['k1', 'k2']);
    expect(sources.route).toHaveLength(0);
    expect(sources.hasItinerary).toBe(false);
  });
});

describe('H. ranking uses clustered opportunities', () => {
  test('larger lower-league cluster outranks smaller one', () => {
    const trips = suggestDiscoverTrips(
      [
        ...Array.from({ length: 7 }, (_, i) =>
          windowOnly(`k${i}`, 'Krakow', 'IV liga', '2026-10-22', '2026-10-23', 'Kraków')
        ),
        ...Array.from({ length: 2 }, (_, i) => windowOnly(`m${i}`, 'Milan')),
      ],
      '2026-10-22',
      '2026-10-23',
      [2],
      { maxInterTravelKm: 50 }
    );
    const ranked = rankLowerLeagueGems(trips.filter((t) => t.matchCount === 0));
    expect(ranked[0].tbcMatches).toHaveLength(7);
    expect(ranked[0].destinationLabel).toBe('Kraków');
  });
});

describe('I. no cross-country contamination', () => {
  test('Milan itinerary never attaches Kraków windows; clusters stay apart', () => {
    const trips = suggestDiscoverTrips(
      [
        confirmed('c1', 'Milan'),
        windowOnly('monza', 'Monza'),
        windowOnly('brescia', 'Brescia'),
        windowOnly('bologna', 'Bologna'),
        windowOnly('krk', 'Krakow'),
      ],
      '2026-10-21',
      '2026-10-23',
      [3],
      { maxInterTravelKm: 100 }
    );
    for (const t of trips) {
      if (t.matchCount > 0) {
        const attached = (t.tbcMatches ?? []).map((m) => m.id);
        expect(attached).not.toContain('krk');
        expect(attached).not.toContain('bologna');
      } else {
        // Opportunity-only: single coherent area, never Kraków+Milan mixed.
        const cities = new Set(
          (t.tbcMatches ?? []).map((m) => (m.stadium as { city?: string }).city)
        );
        expect(cities.has('Krakow') && cities.has('Monza')).toBe(false);
      }
    }
    // Monza + Brescia attach (within 100 km of Milan itinerary).
    const mixed = trips.find((t) => t.matchCount > 0 && (t.tbcMatches?.length ?? 0) > 0);
    expect(mixed!.tbcMatches!.map((m) => m.id).sort()).toEqual(['brescia', 'monza']);
  });
});

describe('enrichTrip stays cluster-local', () => {
  test('destination and counts derive from the cluster only', () => {
    const enriched = enrichTrip({
      id: 'opp',
      matches: [],
      tbcMatches: [
        windowOnly('k1', 'Krakow', 'IV liga', '2026-10-22', '2026-10-23', 'Kraków'),
        windowOnly('k2', 'Wieliczka', 'IV liga', '2026-10-22', '2026-10-23', 'Kraków'),
      ],
      totalKm: 0,
      matchCount: 0,
      legs: [],
      tripStartDate: '2026-10-22',
      tripEndDate: '2026-10-23',
      tripLengthDays: 2,
    });
    expect(enriched.destinationLabel).toBe('Kraków');
    expect(enriched.confirmedCount).toBe(0);
    expect(enriched.tbcCount).toBe(2);
  });
});
