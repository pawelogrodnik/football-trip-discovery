import { fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { getAvailableCategories, type DiscoverCategory, type DiscoverTrip } from 'lib/discover';
import { MantineProvider } from '@mantine/core';
import DiscoverResultsDock from '../DiscoverResultsDock';

const messages = {
  Discover: {
    catTop: 'Top picks',
    catUefa: 'European nights',
    catLower: 'Lower league gems',
    catMost: 'Most matches',
    catEasy: 'Easy trips',
    daysOption: '{{count}} days',
    matchCount: '{{count}} matches',
    uefaCount: '{{count}} UEFA',
    totalKm: '{{count}} km total',
    moreMatches: '+{{count}} more',
    moreTeams: '+{{count}} teams',
    viewTrip: 'View trip',
    topPick: 'Top pick',
    searching: 'Discovering trips…',
    emptyTitle: 'No trips found',
    emptyHint1: 'hint1',
    emptyHint2: 'hint2',
    emptyHint3: 'hint3',
    emptyHint4: 'hint4',
    editSearch: 'Edit search',
    tripOptions: '{{count}} trip options',
    collapseResults: 'Collapse results',
    expandResults: 'Expand results',
    previousTrips: 'Previous trips',
    nextTrips: 'Next trips',
  },
};

function mkTrip(id: string, comp: string, uefa: number): DiscoverTrip {
  const matches = [
    {
      id: `${id}-m1`,
      homeTeam: { name: `Home ${id}`, crest: `https://example.com/${id}h.png` },
      awayTeam: { name: `Away ${id}`, crest: `https://example.com/${id}a.png` },
      competition: { name: comp },
      date: { dateTime: '2026-09-16T20:00:00.000Z' },
      stadium: { city: 'Milan', geo: { latitude: 45.4, longitude: 9.1 } },
    },
  ];
  return {
    id,
    matches: matches as DiscoverTrip['matches'],
    totalKm: 74,
    matchCount: 1,
    legs: [],
    tripStartDate: '2026-09-16',
    tripEndDate: '2026-09-16',
    tripLengthDays: 1,
    uefaMatchCount: uefa,
    maxLegKm: 0,
    destinationLabel: 'Milan',
  };
}

function renderDock(
  trips: DiscoverTrip[],
  props?: Partial<{
    category: DiscoverCategory;
    detailsOpen: boolean;
    collapsed: boolean;
  }>
) {
  const onCategoryChange = jest.fn();
  const available = getAvailableCategories(trips);
  render(
    <MantineProvider>
      <LocaleProvider locale="en" messages={messages}>
        <DiscoverResultsDock
          loading={false}
          trips={trips}
          category={props?.category ?? 'top'}
          availableCategories={available}
          onCategoryChange={onCategoryChange}
          selectedTripId={null}
          onSelectTrip={jest.fn()}
          onViewTrip={jest.fn()}
          topPickId={null}
          error={null}
          onEditSearch={jest.fn()}
          detailsOpen={props?.detailsOpen ?? false}
          collapsed={props?.collapsed ?? false}
          onToggleCollapsed={jest.fn()}
        />
      </LocaleProvider>
    </MantineProvider>
  );
  return { onCategoryChange, available };
}

describe('DiscoverResultsDock categories', () => {
  test('9. renders all available categories; uefa pool shows European nights', () => {
    const trips = [mkTrip('a', 'Champions League', 1), mkTrip('b', 'Europa League', 1)];
    const { available } = renderDock(trips);
    expect(available).toContain('uefa');
    expect(screen.getByRole('radio', { name: 'Top picks' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'European nights' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Most matches' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Easy trips' })).toBeInTheDocument();
  });

  test('clicking a category notifies parent without refetching', () => {
    const trips = [mkTrip('a', 'Champions League', 1), mkTrip('b', 'Europa League', 1)];
    const { onCategoryChange } = renderDock(trips);
    fireEvent.click(screen.getByRole('radio', { name: 'European nights' }));
    expect(onCategoryChange).toHaveBeenCalledWith('uefa');
  });

  test('serie-only pool hides contextual categories; lower pool shows gems', () => {
    const serie = [mkTrip('a', 'Serie A', 0), mkTrip('b', 'Serie A', 0)];
    const { unmount } = render(
      <MantineProvider>
        <LocaleProvider locale="en" messages={messages}>
          <DiscoverResultsDock
            loading={false}
            trips={serie}
            category="top"
            availableCategories={getAvailableCategories(serie)}
            onCategoryChange={jest.fn()}
            selectedTripId={null}
            onSelectTrip={jest.fn()}
            onViewTrip={jest.fn()}
            topPickId={null}
            error={null}
            onEditSearch={jest.fn()}
            detailsOpen={false}
            collapsed={false}
            onToggleCollapsed={jest.fn()}
          />
        </LocaleProvider>
      </MantineProvider>
    );
    expect(screen.queryByRole('radio', { name: 'European nights' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Lower league gems' })).not.toBeInTheDocument();
    unmount();

    const lower = [mkTrip('l1', 'Serie C Group A', 0), mkTrip('l2', 'Serie C Group A', 0)];
    renderDock(lower);
    expect(screen.getByRole('radio', { name: 'Lower league gems' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'European nights' })).not.toBeInTheDocument();
  });

  test('10. category control lives in a horizontal overflow container', () => {
    const trips = [mkTrip('a', 'Serie A', 0)];
    renderDock(trips);
    const scroller = document.querySelector('.categoryScroll');
    expect(scroller).not.toBeNull();
    expect(scroller?.querySelector('[role="radiogroup"]')).not.toBeNull();
  });

  test('compact mode keeps icon-only categories with accessible names', () => {
    const trips = [mkTrip('a', 'Champions League', 1), mkTrip('b', 'Europa League', 1)];
    renderDock(trips, { detailsOpen: true });
    expect(screen.getByRole('radio', { name: 'European nights' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Top picks' })).toBeInTheDocument();
  });
});
