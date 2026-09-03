import type { DiscoverTrip } from 'lib/discover';
import { FOOTBALL_DISTANCE_OPTIONS_KM } from 'lib/distance';
import {
  buildFindUrl,
  buildTripUrl,
  deriveFindContextFromMatches,
  deriveFindContextFromTrip,
  FIND_DEFAULT_RADIUS_KM,
  isCompleteFindCriteria,
  parseFindSearchParams,
} from 'lib/tripUrls';

function mkTrip(overrides: Partial<DiscoverTrip> = {}): DiscoverTrip {
  return {
    id: 'trip-1',
    matches: [
      {
        id: 'm1',
        homeTeam: { name: 'Inter', crest: null },
        awayTeam: { name: 'Milan', crest: null },
        competition: { name: 'Serie A' },
        date: { dateTime: '2026-09-12T20:45:00.000Z' },
        stadium: { name: 'San Siro', city: 'Milan', geo: { latitude: 45.478, longitude: 9.124 } },
      },
      {
        id: 'm2',
        homeTeam: { name: 'Atalanta', crest: null },
        awayTeam: { name: 'Juventus', crest: null },
        competition: { name: 'Serie A' },
        date: { dateTime: '2026-09-14T18:00:00.000Z' },
        stadium: {
          name: 'Gewiss Stadium',
          city: 'Bergamo',
          geo: { latitude: 45.709, longitude: 9.681 },
        },
      },
    ] as DiscoverTrip['matches'],
    totalKm: 50,
    matchCount: 2,
    legs: [],
    tripStartDate: '2026-09-12',
    tripEndDate: '2026-09-15',
    tripLengthDays: 4,
    uefaMatchCount: 0,
    maxLegKm: 50,
    destinationLabel: 'Milan',
    ...overrides,
  } as DiscoverTrip;
}

describe('deriveFindContextFromTrip', () => {
  it('derives centroid location, trip dates and selected ids', () => {
    const ctx = deriveFindContextFromTrip(mkTrip());
    expect(ctx.location.label).toBe('Milan');
    expect(ctx.location.lat).toBeCloseTo((45.478 + 45.709) / 2, 5);
    expect(ctx.location.lon).toBeCloseTo((9.124 + 9.681) / 2, 5);
    expect(ctx.startDate?.toISOString().slice(0, 10)).toBe('2026-09-12');
    expect(ctx.endDate?.toISOString().slice(0, 10)).toBe('2026-09-15');
    expect(ctx.ids).toEqual(['m1', 'm2']);
    expect(ctx.radiusKm).toBeGreaterThanOrEqual(5);
    expect(ctx.radiusKm).toBeLessThanOrEqual(200);
  });

  it('snaps the derived radius up to a supported shared option', () => {
    const ctx = deriveFindContextFromTrip(mkTrip());
    expect([...FOOTBALL_DISTANCE_OPTIONS_KM]).toContain(ctx.radiusKm);
  });
  it('uses neutral label for generic destination', () => {
    const ctx = deriveFindContextFromTrip(mkTrip({ destinationLabel: 'Football trip' }));
    expect(ctx.location.label).toBe('Trip area');
  });

  it('dedupes selected ids', () => {
    const trip = mkTrip();
    trip.matches = [...trip.matches, trip.matches[0]];
    expect(deriveFindContextFromTrip(trip).ids).toEqual(['m1', 'm2']);
  });
});

describe('buildFindUrl / parseFindSearchParams round-trip', () => {
  it('customize URL contains dates, center, radius and ids', () => {
    const ctx = deriveFindContextFromTrip(mkTrip());
    const url = buildFindUrl(
      {
        location: ctx.location,
        startDate: ctx.startDate,
        endDate: ctx.endDate,
        radiusKm: ctx.radiusKm,
      },
      ctx.ids,
      { mode: 'customize' }
    );
    expect(url.startsWith('/find?')).toBe(true);
    const parsed = parseFindSearchParams(new URLSearchParams(url.split('?')[1]));
    expect(parsed.mode).toBe('customize');
    expect(parsed.location?.label).toBe('Milan');
    expect(parsed.ids).toEqual(['m1', 'm2']);
    expect(parsed.startDate?.toISOString().slice(0, 10)).toBe('2026-09-12');
    expect(parsed.endDate?.toISOString().slice(0, 10)).toBe('2026-09-15');
    expect(
      isCompleteFindCriteria({
        location: parsed.location,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
      })
    ).toBe(true);
  });

  it('parses prefill query criteria (location, dates, radius)', () => {
    const parsed = parseFindSearchParams(
      new URLSearchParams(
        'lat=45.46&lon=9.19&label=Milan&radius=100&startDate=2026-09-12&endDate=2026-09-15'
      )
    );
    expect(parsed.location).toEqual({ label: 'Milan', lat: 45.46, lon: 9.19 });
    expect(parsed.radiusKm).toBe(100);
    expect(parsed.startDate?.toISOString().slice(0, 10)).toBe('2026-09-12');
    expect(parsed.endDate?.toISOString().slice(0, 10)).toBe('2026-09-15');
  });

  it('falls back to default radius when absent', () => {
    const parsed = parseFindSearchParams(new URLSearchParams('lat=1&lon=2'));
    expect(parsed.radiusKm).toBe(FIND_DEFAULT_RADIUS_KM);
    expect(parsed.location?.label).toBe('Trip area');
  });
});

describe('buildTripUrl', () => {
  it('contains ids, location, radius and dates', () => {
    const ctx = deriveFindContextFromTrip(mkTrip());
    const url = buildTripUrl(
      {
        location: ctx.location,
        startDate: ctx.startDate,
        endDate: ctx.endDate,
        radiusKm: ctx.radiusKm,
      },
      ctx.ids
    );
    expect(url.startsWith('/matches?')).toBe(true);
    const q = new URLSearchParams(url.split('?')[1]);
    expect(q.get('ids')).toBe('m1,m2');
    expect(q.get('label')).toBe('Milan');
    expect(q.get('lat')).toBeTruthy();
    expect(q.get('lon')).toBeTruthy();
    expect(q.get('radius')).toBeTruthy();
    expect(q.get('startDate')).toBe('2026-09-12');
    expect(q.get('endDate')).toBe('2026-09-15');
  });
});

describe('deriveFindContextFromMatches (old links)', () => {
  it('derives dates, centroid and radius from matches', () => {
    const trip = mkTrip();
    const ctx = deriveFindContextFromMatches(
      trip.matches as unknown as Array<Record<string, unknown>>
    );
    expect(ctx.location?.label).toBe('Trip area');
    expect(ctx.location?.lat).toBeCloseTo((45.478 + 45.709) / 2, 5);
    expect(ctx.startDate?.toISOString().slice(0, 10)).toBe('2026-09-12');
    expect(ctx.endDate?.toISOString().slice(0, 10)).toBe('2026-09-14');
    expect(ctx.radiusKm).toBeGreaterThanOrEqual(5);
  });

  it('returns null location when no venues', () => {
    const ctx = deriveFindContextFromMatches([{ id: 'x' }]);
    expect(ctx.location).toBeNull();
  });
});
