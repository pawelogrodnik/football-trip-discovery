import { render, screen } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { filterFixturesInRadius } from 'lib/geoTurf';
import { deriveFindContextFromTrip } from 'lib/tripUrls';
import { MantineProvider } from '@mantine/core';
import DiscoverTripCard from '../../discover/components/DiscoverTripCard';
import { suggestDiscoverTrips, tripMapSources } from '../discover';
import type { DiscoverTrip } from '../discover';
import { hasValidVenueGeo, scheduleCertaintyCounts } from '../matchSchedule';
import { isWindowOnlyMatch, TripMatch } from '../tripOptimizer';

const KRAKOW = { latitude: 50.06, longitude: 19.94 };

function windowMatch(id: string, geo: unknown = KRAKOW, city: string | null = 'Kraków'): TripMatch {
  return {
    id,
    homeTeam: { name: `Home ${id}` },
    awayTeam: { name: `Away ${id}` },
    competition: { name: 'IV liga' },
    schedule: { status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' },
    date: { startDate: '2026-10-22', endDate: '2026-10-23', time: 'TBD' },
    stadium: { geo: geo as { latitude: number; longitude: number }, city },
  } as unknown as TripMatch;
}

describe('A. geo eligibility', () => {
  test('valid geo is eligible; missing/null/NaN/string/out-of-range are not', () => {
    expect(hasValidVenueGeo(windowMatch('ok'))).toBe(true);
    expect(hasValidVenueGeo({ stadium: {} } as never)).toBe(false);
    expect(hasValidVenueGeo({} as never)).toBe(false);
    expect(hasValidVenueGeo(null)).toBe(false);
    expect(hasValidVenueGeo(windowMatch('null-geo', null))).toBe(false);
    expect(hasValidVenueGeo(windowMatch('nan-geo', { latitude: NaN, longitude: 19.94 }))).toBe(
      false
    );
    expect(
      hasValidVenueGeo(windowMatch('str-geo', { latitude: '50.06', longitude: '19.94' }))
    ).toBe(false);
    expect(hasValidVenueGeo(windowMatch('lat-hi', { latitude: 91, longitude: 0 }))).toBe(false);
    expect(hasValidVenueGeo(windowMatch('lon-hi', { latitude: 0, longitude: 181 }))).toBe(false);
    expect(hasValidVenueGeo(windowMatch('edge', { latitude: -90, longitude: -180 }))).toBe(true);
  });
});

describe('B. opportunity count gates on geo', () => {
  test('7 window (5 geocoded + 2 no geo) => 0 confirmed · 5 TBC', () => {
    const pool = [
      ...Array.from({ length: 5 }, (_, i) => windowMatch(`g${i}`)),
      windowMatch('u1', null),
      { ...windowMatch('u2', null), stadium: {} } as unknown as TripMatch,
    ];
    const trips = suggestDiscoverTrips(pool, '2026-10-22', '2026-10-23', [2], {
      maxInterTravelKm: 100,
    });
    const opportunity = trips.find((t) => t.matchCount === 0);
    expect(opportunity).toBeDefined();
    expect(opportunity!.tbcCount).toBe(5);
    expect(opportunity!.tbcMatches).toHaveLength(5);
    expect(opportunity!.tbcMatches!.every((m) => hasValidVenueGeo(m))).toBe(true);
  });
});

describe('C. opportunity-only Customize', () => {
  test('center/radius/ids/dates derive from geocoded tbcMatches, never 0,0', () => {
    const trip = {
      id: 'discover_opportunity_2026-10-22_2026-10-23',
      matches: [],
      tbcMatches: [windowMatch('a'), windowMatch('b', { latitude: 50.1, longitude: 20.0 })],
      totalKm: 0,
      matchCount: 0,
      legs: [],
      tripStartDate: '2026-10-22',
      tripEndDate: '2026-10-23',
      tripLengthDays: 2,
      uefaMatchCount: 0,
      maxLegKm: 0,
      tbcCount: 2,
      destinationLabel: 'Kraków',
    } as unknown as DiscoverTrip;
    const ctx = deriveFindContextFromTrip(trip);
    expect(ctx.location).not.toBeNull();
    expect(ctx.location!.lat).not.toBe(0);
    expect(ctx.location!.lon).not.toBe(0);
    expect(ctx.location!.lat).toBeCloseTo(50.08, 1);
    expect(ctx.ids).toEqual(expect.arrayContaining(['a', 'b']));
    expect(ctx.radiusKm).toBeGreaterThan(0);
    expect(ctx.startDate?.toISOString().slice(0, 10)).toBe('2026-10-22');
    expect(ctx.endDate?.toISOString().slice(0, 10)).toBe('2026-10-23');
  });
});

describe('D/E. opportunity-only map sources', () => {
  test('TBC markers shown, fit to TBC, route empty, no polyline numbering', () => {
    const sources = tripMapSources({
      matches: [],
      tbcMatches: [windowMatch('a'), windowMatch('b')],
    });
    expect(sources.markers.map((m) => m.id)).toEqual(['a', 'b']);
    expect(sources.route).toHaveLength(0);
    expect(sources.selectedIds).toEqual(['a', 'b']);
    expect(sources.hasItinerary).toBe(false);
  });

  test('window fixture without geo produces no marker and no fit influence', () => {
    const sources = tripMapSources({ matches: [], tbcMatches: [windowMatch('u', null)] });
    expect(sources.markers).toHaveLength(0);
    expect(sources.selectedIds).toHaveLength(0);
  });

  test('mixed trip: markers include TBC, route is confirmed-only', () => {
    const confirmed = {
      ...windowMatch('c'),
      schedule: { status: 'confirmed', dateTime: '2026-10-21T15:00:00.000Z' },
      date: { dateTime: '2026-10-21T15:00:00.000Z' },
    } as unknown as TripMatch;
    const sources = tripMapSources({ matches: [confirmed], tbcMatches: [windowMatch('w')] });
    expect(sources.markers.map((m) => m.id)).toEqual(['c', 'w']);
    expect(sources.route.map((m) => m.id)).toEqual(['c']);
    expect(sources.hasItinerary).toBe(true);
  });
});

describe('F. no fake route metrics on TBC-only cards', () => {
  test('card hides km total for opportunity-only candidates', () => {
    const trip = {
      id: 'discover_opportunity_2026-10-22_2026-10-23',
      matches: [],
      tbcMatches: [windowMatch('a')],
      totalKm: 0,
      matchCount: 0,
      legs: [],
      tripStartDate: '2026-10-22',
      tripEndDate: '2026-10-23',
      tripLengthDays: 2,
      uefaMatchCount: 0,
      maxLegKm: 0,
      tbcCount: 1,
      destinationLabel: 'Kraków',
    } as unknown as DiscoverTrip;
    render(
      <MantineProvider>
        <LocaleProvider
          locale="en"
          messages={{
            Discover: {
              daysOption: '{{count}} days',
              matchCount: '{{count}} matches',
              uefaCount: '{{count}} UEFA',
              totalKm: '{{count}} km total',
              moreMatches: '+{{count}} more',
              moreTeams: '+{{count}} teams',
              viewTrip: 'View trip',
              topPick: 'Top pick',
              possibleMatches: 'Possible matches',
              tbcOpportunities: '+{{count}} awaiting kickoff',
              confirmedTbc: '{{confirmed}} confirmed · {{tbc}} TBC',
            },
          }}
        >
          <DiscoverTripCard
            trip={trip}
            selected={false}
            isTopPick={false}
            onSelect={() => {}}
            onView={() => {}}
          />
        </LocaleProvider>
      </MantineProvider>
    );
    expect(screen.queryByText(/km total/)).not.toBeInTheDocument();
    expect(screen.getByTestId('discover-trip-metrics')).toHaveTextContent('0 confirmed · 1 TBC');
  });
});

describe('G. date-confirmed stays in itinerary and counts as TBC', () => {
  const dayOnly = {
    id: 'd1',
    homeTeam: { name: 'A' },
    awayTeam: { name: 'B' },
    competition: { name: 'IV liga' },
    date: { date: '2026-10-22' },
    stadium: { geo: KRAKOW },
  } as unknown as TripMatch;

  test('not a window opportunity; counts as TBC', () => {
    expect(isWindowOnlyMatch(dayOnly)).toBe(false);
    expect(scheduleCertaintyCounts([dayOnly])).toEqual({ confirmed: 0, tbc: 1 });
  });
});

describe('H. mixed Customize preserves itinerary + TBC ids', () => {
  test('2 itinerary + 3 TBC all survive into Find context', () => {
    const trip = {
      id: 'discover_0',
      matches: [
        {
          ...windowMatch('c1'),
          schedule: { status: 'confirmed', dateTime: '2026-10-21T15:00:00.000Z' },
          date: { dateTime: '2026-10-21T15:00:00.000Z' },
        },
        {
          ...windowMatch('c2'),
          schedule: { status: 'confirmed', dateTime: '2026-10-21T18:00:00.000Z' },
          date: { dateTime: '2026-10-21T18:00:00.000Z' },
        },
      ],
      tbcMatches: [windowMatch('w1'), windowMatch('w2'), windowMatch('w3')],
      totalKm: 12,
      matchCount: 2,
      legs: [],
      tripStartDate: '2026-10-21',
      tripEndDate: '2026-10-23',
      tripLengthDays: 3,
      uefaMatchCount: 0,
      maxLegKm: 12,
      tbcCount: 3,
      destinationLabel: 'Kraków',
    } as unknown as DiscoverTrip;
    const ctx = deriveFindContextFromTrip(trip);
    expect(ctx.ids).toEqual(expect.arrayContaining(['c1', 'c2', 'w1', 'w2', 'w3']));
    expect(ctx.ids).toHaveLength(5);
  });
});

describe('Find geo rule', () => {
  test('no-geo window fixture cannot prove radius membership; geocoded can', () => {
    expect(filterFixturesInRadius(windowMatch('u', null) as never, 50.06, 19.94, 50)).toBe(false);
    expect(filterFixturesInRadius(windowMatch('g') as never, 50.06, 19.94, 50)).toBe(true);
    expect((windowMatch('u', null) as { _distanceKm?: number })._distanceKm).toBeUndefined();
  });
});
