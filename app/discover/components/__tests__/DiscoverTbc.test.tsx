import { render, screen } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import {
  enrichTrip,
  lowerTierTbcCount,
  rankLowerLeagueGems,
  topPickScore,
  type DiscoverTrip,
} from 'lib/discover';
import { MantineProvider } from '@mantine/core';
import DiscoverTripCard from '../DiscoverTripCard';

const messages = {
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
};

function baseTrip(extra?: Partial<DiscoverTrip>): DiscoverTrip {
  return {
    id: 'discover_0',
    matches: [
      {
        id: 'c1',
        homeTeam: { name: 'Como 1907' },
        awayTeam: { name: 'Inter' },
        competition: { name: 'Serie A' },
        date: { dateTime: '2026-10-22T18:00:00.000Z' },
        stadium: { city: 'Como', geo: { latitude: 45.8, longitude: 9.07 } },
      },
    ] as DiscoverTrip['matches'],
    totalKm: 40,
    matchCount: 1,
    legs: [],
    tripStartDate: '2026-10-22',
    tripEndDate: '2026-10-23',
    tripLengthDays: 2,
    uefaMatchCount: 0,
    maxLegKm: 0,
    destinationLabel: 'Como',
    ...extra,
  };
}

describe('Discover confirmed-vs-TBC (issue #9)', () => {
  test('enrichTrip exposes tbcCount without inflating matchCount', () => {
    const enriched = enrichTrip({
      id: 't',
      matches: baseTrip().matches,
      tbcMatches: [
        {
          id: 'w1',
          homeTeam: { name: 'Hutnik' },
          awayTeam: { name: 'Dalin' },
          competition: { name: 'IV liga' },
          date: { startDate: '2026-10-22', endDate: '2026-10-23' },
          stadium: {},
        },
      ] as never,
      totalKm: 40,
      matchCount: 1,
      legs: [],
    });
    expect(enriched.matchCount).toBe(1);
    expect(enriched.tbcCount).toBe(1);
  });

  test('lower-league TBC opportunities lift lower-gems ranking', () => {
    const plain = baseTrip({ id: 'plain' });
    const withTbc = baseTrip({
      id: 'gems',
      tbcMatches: [
        {
          id: 'w1',
          homeTeam: { name: 'Hutnik' },
          awayTeam: { name: 'Dalin' },
          competition: { name: 'Serie C Group A' },
          date: { startDate: '2026-10-22', endDate: '2026-10-23' },
          stadium: {},
        },
      ] as never,
    });
    expect(lowerTierTbcCount(withTbc)).toBe(1);
    expect(rankLowerLeagueGems([plain, withTbc])[0].id).toBe('gems');
  });

  test('TBC bonus is modest: confirmed count still dominates top picks', () => {
    const single: any = baseTrip({ id: 'single' });
    const triple: any = {
      ...baseTrip({ id: 'triple' }),
      matches: [
        ...baseTrip().matches,
        ...baseTrip().matches.map((m: any) => ({ ...m, id: `${m.id}-2` })),
        ...baseTrip().matches.map((m: any) => ({ ...m, id: `${m.id}-3` })),
      ],
      matchCount: 3,
    };
    single.tbcMatches = Array.from({ length: 5 }, (_, i) => ({ id: `w${i}` }));
    expect(topPickScore(triple)).toBeGreaterThan(topPickScore(single));
    // but TBC beats an otherwise identical trip without opportunities
    expect(topPickScore(single)).toBeGreaterThan(topPickScore(baseTrip({ id: 'bare' }) as any));
  });

  test('card communicates N confirmed + M TBC, never as guaranteed matches', () => {
    const trip = baseTrip({
      tbcMatches: [
        {
          id: 'w1',
          homeTeam: { name: 'Hutnik' },
          awayTeam: { name: 'Dalin' },
          competition: { name: 'IV liga' },
          date: { startDate: '2026-10-22', endDate: '2026-10-23' },
          stadium: {},
        },
      ] as never,
      tbcCount: 1,
    });
    render(
      <MantineProvider>
        <LocaleProvider locale="en" messages={messages}>
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
    expect(screen.getByTestId('discover-trip-tbc')).toHaveTextContent('+1 awaiting kickoff');
    expect(screen.getByTestId('discover-trip-metrics')).toHaveTextContent('1 confirmed · 1 TBC');
  });
});
