import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { MantineProvider } from '@mantine/core';
import FindMatchesClient from '../FindMatchesClient';

const push = jest.fn();
let currentParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => currentParams,
}));

jest.mock('../../../components/map/MapWrapper', () => ({
  __esModule: true,
  default: () => <div data-testid="find-map-mock" />,
}));

function mockMatchMedia(mobile: boolean) {
  (window as unknown as Record<string, unknown>).matchMedia = jest
    .fn()
    .mockImplementation((query: string) => ({
      matches: mobile && query.includes('768'),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
      onchange: null,
    }));
}

const messages = {
  FindMatches: {
    title: 'Find matches near your destination',
    subtitle: 'sub',
    destination: 'Destination',
    destinationPlaceholder: 'Milan ...',
    dates: 'Dates',
    datesPlaceholder: 'Pick dates',
    radius: 'Search radius',
    findMatches: 'Find matches',
    editSearch: 'Edit search',
    cancel: 'Cancel',
    matchesNearby: '{{count}} matches nearby',
    withinRadius: 'within {{km}} km of {{label}}',
    selectedCount: '{{count}} matches selected',
    createTrip: 'Create trip',
    loading: 'Loading matches...',
    emptyTitle: 'No matches found',
    emptyHint: 'No matches near {{label}}.',
    emptyRecovery: 'Try more.',
    matchesNear: '{{count}} matches near {{label}}',
    searchRange: '{{range}} · within {{km}} km',
    allMatches: 'All',
    selectedMatches: 'Selected',
    noSelectedTitle: 'No matches selected yet.',
    noSelectedHint: 'Choose matches from All.',
    showAll: 'Show all matches',
    selectedRangeDays: '{{range}} · {{count}} days',
    customizingBadge: 'Customizing suggested trip',
    resetSuggested: 'Reset to suggested trip',
    outsideRadius: 'Outside current search radius',
    versus: 'vs',
    selectMatch: 'Select {{home}} vs {{away}}',
    approxTime: 'Approximate kickoff',
    tryAgain: 'Try again',
    errorFallback: 'Something went wrong.',
    discoverLink: 'Discover another destination',
    scheduleTbc: 'Schedule TBC',
    dateKickoffTbc: 'Date & kickoff TBC',
    kickoffTbc: 'Kickoff TBC',
    confirmedTbcCount: '{{confirmed}} confirmed · {{tbc}} TBC',
    viewMatches: 'Matches',
    viewMap: 'Map',
    viewModeLabel: 'View mode',
  },
  Form: {
    destination: 'Destination',
  },
};

function mkMatch(id: string, dateTime: string) {
  return {
    _id: id,
    id,
    homeTeam: { name: `Home ${id}`, crest: `https://example.com/${id}-h.png` },
    awayTeam: { name: `Away ${id}`, crest: `https://example.com/${id}-a.png` },
    competition: { name: 'Serie A' },
    date: { dateTime },
    stadium: { venue: `Stadion ${id}`, geo: { latitude: 45.46, longitude: 9.19 } },
    _distanceKm: 5,
  };
}

function mockApi(matches: unknown[]) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).startsWith('/api/matches/by-ids')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ matches: [] }) });
    }
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          fixtures: [{ leagues: [{ matches }] }],
          totalCount: (matches as unknown[]).length,
        }),
    });
  }) as unknown as typeof fetch;
}

const CUSTOMIZE_QS =
  'mode=customize&lat=45.46&lon=9.19&label=Milan&radius=50&startDate=2026-09-07&endDate=2026-09-20&ids=m1';

function renderFind() {
  return render(
    <MantineProvider>
      <LocaleProvider locale="en" messages={messages}>
        <FindMatchesClient />
      </LocaleProvider>
    </MantineProvider>
  );
}

beforeEach(() => {
  push.mockClear();
});

describe('mobile /find search mode (NaN regression)', () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  it('A. before search: map + form rendered, results-list composition NOT active', () => {
    currentParams = new URLSearchParams('');
    mockApi([]);
    renderFind();
    // Map background must render (never display:none at search mode).
    expect(screen.getByTestId('find-map')).toBeInTheDocument();
    expect(screen.getByTestId('find-search')).toBeInTheDocument();
    const view = screen.getByTestId('find-view');
    expect(view).not.toHaveAttribute('data-mobile-view', 'list');
    expect(view).not.toHaveAttribute('data-mobile-view', 'map');
    expect(screen.queryByTestId('find-mobile-toggle')).toBeNull();
    expect(screen.queryByTestId('find-results-panel')).toBeNull();
  });

  it('C. successful search defaults to Matches: no map, list rendered', async () => {
    currentParams = new URLSearchParams(CUSTOMIZE_QS);
    mockApi([mkMatch('m1', '2026-09-07T15:30:00.000Z')]);
    renderFind();
    await waitFor(() => expect(screen.getByTestId('find-results-panel')).toBeInTheDocument());
    expect(screen.getByTestId('find-view')).toHaveAttribute('data-mobile-view', 'list');
    expect(screen.queryByTestId('find-map')).toBeNull();
    expect(screen.getByTestId('find-match-card-m1')).toBeInTheDocument();
  });

  it('D. Matches -> Map renders map and hides panel', async () => {
    currentParams = new URLSearchParams(CUSTOMIZE_QS);
    mockApi([mkMatch('m1', '2026-09-07T15:30:00.000Z')]);
    renderFind();
    await waitFor(() => expect(screen.getByTestId('find-match-card-m1')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Map'));
    await waitFor(() => expect(screen.getByTestId('find-map')).toBeInTheDocument());
    expect(screen.getByTestId('find-view')).toHaveAttribute('data-mobile-view', 'map');
    expect(screen.queryByTestId('find-results-panel')).toBeNull();
  });

  it('B. Edit Search reopens form with map background', async () => {
    currentParams = new URLSearchParams(CUSTOMIZE_QS);
    mockApi([mkMatch('m1', '2026-09-07T15:30:00.000Z')]);
    renderFind();
    await waitFor(() => expect(screen.getByTestId('find-match-card-m1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('find-back-to-search'));
    // Search form open again: map background must return, list composition off.
    expect(screen.getByTestId('find-search')).toBeInTheDocument();
    expect(screen.getByTestId('find-map')).toBeInTheDocument();
    const view = screen.getByTestId('find-view');
    expect(view).not.toHaveAttribute('data-mobile-view', 'list');
    expect(view).not.toHaveAttribute('data-mobile-view', 'map');
  });

  it('localized view toggle exposes accessible label', async () => {
    currentParams = new URLSearchParams(CUSTOMIZE_QS);
    mockApi([mkMatch('m1', '2026-09-07T15:30:00.000Z')]);
    renderFind();
    await waitFor(() => expect(screen.getByTestId('find-results-panel')).toBeInTheDocument());
    expect(screen.getByTestId('mobile-view-toggle')).toHaveAttribute('aria-label', 'View mode');
  });
});
