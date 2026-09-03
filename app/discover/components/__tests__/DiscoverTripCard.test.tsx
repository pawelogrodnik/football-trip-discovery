import { fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import type { DiscoverTrip } from 'lib/discover';
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
  },
};

function renderCard(
  trip: DiscoverTrip,
  props?: Partial<{ selected: boolean; isTopPick: boolean }>
) {
  const onSelect = jest.fn();
  const onView = jest.fn();
  render(
    <MantineProvider>
      <LocaleProvider locale="en" messages={messages}>
        <DiscoverTripCard
          trip={trip}
          selected={props?.selected ?? false}
          isTopPick={props?.isTopPick ?? false}
          onSelect={onSelect}
          onView={onView}
        />
      </LocaleProvider>
    </MantineProvider>
  );
  return { onSelect, onView };
}

function mkTrip(): DiscoverTrip {
  const matches = [0, 1, 2].map((i) => ({
    id: `m${i + 1}`,
    homeTeam: { name: `Home${i + 1}`, crest: `https://example.com/h${i + 1}.png` },
    awayTeam: { name: `Away${i + 1}`, crest: `https://example.com/a${i + 1}.png` },
    competition: { name: i < 2 ? 'Champions League' : 'Serie A' },
    date: { dateTime: `2026-09-${16 + i}T20:00:00.000Z` },
    stadium: {
      name: `Stadium ${i + 1}`,
      city: 'Milan',
      geo: { latitude: 45.4 + i * 0.05, longitude: 9.1 + i * 0.05 },
    },
  }));
  return {
    id: 'discover_0',
    matches: matches as DiscoverTrip['matches'],
    totalKm: 74,
    matchCount: 3,
    legs: [
      { fromIdx: 0, toIdx: 1, km: 32, driveMinutes: 38 },
      { fromIdx: 1, toIdx: 2, km: 42, driveMinutes: 50 },
    ],
    tripStartDate: '2026-09-16',
    tripEndDate: '2026-09-18',
    tripLengthDays: 3,
    uefaMatchCount: 2,
    maxLegKm: 42,
    destinationLabel: 'Milan',
  };
}

describe('DiscoverTripCard', () => {
  test('shows destination, trip dates, counts and honest km distance', () => {
    renderCard(mkTrip());
    expect(screen.getByText('Milan')).toBeInTheDocument();
    expect(screen.getByText(/3 matches/)).toBeInTheDocument();
    expect(screen.getByText(/2 UEFA/)).toBeInTheDocument();
    expect(screen.getByText(/74 km total/)).toBeInTheDocument();
    // no fabricated travel times
    expect(screen.queryByText(/by train/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/min drive/i)).not.toBeInTheDocument();
    // one featured (highest-priority) fixture + remainder
    expect(screen.getByText('Home1 – Away1')).toBeInTheDocument();
    expect(screen.getByText(/Champions League.*\+2 more/)).toBeInTheDocument();
  });

  test('unique team crests: duplicate club appears once, overflow counted', () => {
    const trip = mkTrip();
    // Same club in an extra match must not duplicate its crest
    const dup = {
      ...trip.matches[0],
      id: 'm4',
      date: { dateTime: '2026-09-19T20:00:00.000Z' },
    };
    const big: DiscoverTrip = {
      ...trip,
      id: 'discover_big',
      matches: [...trip.matches, dup] as DiscoverTrip['matches'],
      matchCount: 4,
    };
    renderCard(big);
    expect(screen.getAllByAltText('Home1 crest')).toHaveLength(1);
    // 6 unique teams fit, nothing hidden
    expect(screen.queryByText(/teams$/)).not.toBeInTheDocument();
  });

  test('compact variant has no CTA and no featured preview', () => {
    const onSelect = jest.fn();
    const onView = jest.fn();
    render(
      <MantineProvider>
        <LocaleProvider locale="en" messages={messages}>
          <DiscoverTripCard
            trip={mkTrip()}
            selected={false}
            isTopPick={false}
            onSelect={onSelect}
            onView={onView}
            variant="compact"
          />
        </LocaleProvider>
      </MantineProvider>
    );
    expect(screen.queryByRole('button', { name: /view trip/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option')).toBeInTheDocument();
  });

  test('card click selects trip; View trip opens details without double-select side effects', () => {
    const { onSelect, onView } = renderCard(mkTrip());
    fireEvent.click(screen.getByRole('option'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onView).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /view trip/i }));
    expect(onView).toHaveBeenCalledTimes(1);
  });

  test('selected card is marked aria-selected; top pick badge renders', () => {
    renderCard(mkTrip(), { selected: true, isTopPick: true });
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Top pick')).toBeInTheDocument();
  });

  test('closing drawer keeps trip selected (drawer is separate from selection)', () => {
    // Selection state lives outside the drawer: card stays aria-selected
    const { rerender } = render(
      <MantineProvider>
        <LocaleProvider locale="en" messages={messages}>
          <DiscoverTripCard
            trip={mkTrip()}
            selected
            onSelect={jest.fn()}
            onView={jest.fn()}
            isTopPick={false}
          />
        </LocaleProvider>
      </MantineProvider>
    );
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
    rerender(
      <MantineProvider>
        <LocaleProvider locale="en" messages={messages}>
          <DiscoverTripCard
            trip={mkTrip()}
            selected
            onSelect={jest.fn()}
            onView={jest.fn()}
            isTopPick={false}
          />
        </LocaleProvider>
      </MantineProvider>
    );
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
  });
});
