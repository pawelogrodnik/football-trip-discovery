import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { MantineProvider } from '@mantine/core';
import FindMatchesClient from '../FindMatchesClient';

const push = jest.fn();
let currentParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => currentParams,
}));

type MapProps = Record<string, unknown>;
let lastMapProps: MapProps | null = null;
jest.mock('../../../components/map/MapWrapper', () => ({
  __esModule: true,
  default: (props: MapProps) => {
    lastMapProps = props;
    return <div data-testid="find-map-mock" />;
  },
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

function mkTbcWindowMatch(id: string) {
  return {
    _id: id,
    id,
    homeTeam: { name: `Home ${id}`, crest: `https://example.com/${id}-h.png` },
    awayTeam: { name: `Away ${id}`, crest: `https://example.com/${id}-a.png` },
    competition: { name: 'Serie A' },
    date: { startDate: '2026-09-12', endDate: '2026-09-14' },
    stadium: { venue: `Stadion ${id}`, geo: { latitude: 45.46, longitude: 9.19 } },
    _distanceKm: 8,
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
  lastMapProps = null;
});

describe('Find mobile composition (list-first)', () => {
  beforeEach(() => {
    mockMatchMedia(true);
    currentParams = new URLSearchParams(CUSTOMIZE_QS);
    mockApi([mkMatch('m1', '2026-09-07T15:30:00.000Z'), mkMatch('m2', '2026-09-10T18:00:00.000Z')]);
  });

  it('defaults to Matches list with no map spacer in layout', async () => {
    renderFind();
    await waitFor(() => expect(screen.getByTestId('find-results-panel')).toBeInTheDocument());
    const view = screen.getByTestId('find-view');
    expect(view).toHaveAttribute('data-mobile-view', 'list');
    // THE MAP MUST NOT OCCUPY LAYOUT HEIGHT in list mode
    expect(screen.queryByTestId('find-map')).toBeNull();
    expect(screen.getByTestId('find-results-panel')).toBeInTheDocument();
    // semantic toggle labels, not generic List/Map view
    expect(screen.getByTestId('find-mobile-toggle')).toHaveTextContent('Matches');
    expect(screen.getByTestId('find-mobile-toggle')).toHaveTextContent('Map');
    // results participate in flow, not a floating panel over a map
    expect(screen.getByTestId('find-match-card-m1')).toBeInTheDocument();
    expect(screen.getByTestId('find-match-card-m2')).toBeInTheDocument();
  });

  it('switching Matches -> Map -> Matches preserves selection and tabs', async () => {
    renderFind();
    await waitFor(() => expect(screen.getByTestId('find-match-card-m1')).toBeInTheDocument());
    // preselected m1 from URL stays selected
    expect(screen.getByTestId('find-selected-count')).toHaveTextContent('1 matches selected');

    // select a second fixture
    const card = screen.getByTestId('find-match-card-m2');
    fireEvent.click(within(card).getByRole('checkbox'));
    await waitFor(() =>
      expect(screen.getByTestId('find-selected-count')).toHaveTextContent('2 matches selected')
    );

    // -> Map: full map, no results panel sheet
    fireEvent.click(screen.getByText('Map'));
    await waitFor(() => expect(screen.getByTestId('find-map')).toBeInTheDocument());
    expect(screen.queryByTestId('find-results-panel')).toBeNull();
    expect(screen.getByTestId('find-map-status')).toHaveTextContent('2 matches selected');
    // radius + markers preserved in map mode
    await waitFor(() => expect(lastMapProps).not.toBeNull());
    expect(lastMapProps?.showSelectedLocationRadius).toBe(true);
    expect((lastMapProps?.fixtures as unknown[]).length).toBe(2);

    // -> Matches: selection + panel restored, user choice never reset
    fireEvent.click(screen.getByText('Matches'));
    await waitFor(() => expect(screen.getByTestId('find-results-panel')).toBeInTheDocument());
    expect(screen.queryByTestId('find-map')).toBeNull();
    expect(screen.getByTestId('find-selected-count')).toHaveTextContent('2 matches selected');
    expect((screen.getByTestId('find-match-select-m1') as HTMLInputElement).checked).toBe(true);
  });

  it('All/Selected filter stays correct across view switch', async () => {
    renderFind();
    await waitFor(() => expect(screen.getByTestId('find-match-card-m1')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Map'));
    await waitFor(() => expect(screen.getByTestId('find-map')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Matches'));
    await waitFor(() => expect(screen.getByTestId('find-results-panel')).toBeInTheDocument());
    // Selected tab shows only the preselected fixture
    fireEvent.click(screen.getByText(/Selected/));
    await waitFor(() => expect(screen.getByTestId('find-match-card-m1')).toBeInTheDocument());
    expect(screen.queryByTestId('find-match-card-m2')).toBeNull();
  });

  it('mobile map insets are compact overlays (no 62vh sheet reservation)', async () => {
    renderFind();
    await waitFor(() => expect(screen.getByTestId('find-match-card-m1')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Map'));
    await waitFor(() => expect(lastMapProps).not.toBeNull());
    const insets = lastMapProps?.viewportInsets as { top: number; bottom: number };
    expect(insets.top).toBeLessThan(200);
    expect(insets.bottom).toBeLessThan(200);
  });

  it('date-window TBC fixtures render as opportunities with #9 semantics intact', async () => {
    mockApi([mkMatch('m1', '2026-09-07T15:30:00.000Z'), mkTbcWindowMatch('m-tbc')]);
    renderFind();
    await waitFor(() => expect(screen.getByTestId('find-match-card-m-tbc')).toBeInTheDocument());
    expect(screen.getByTestId('find-match-card-m-tbc')).toHaveTextContent('Schedule TBC');
    // no fake chronological kickoff on the window card
    expect(screen.getByTestId('find-selected-count')).toHaveTextContent('1 matches selected');
  });
});

describe('Find desktop composition unchanged', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    currentParams = new URLSearchParams(CUSTOMIZE_QS);
    mockApi([mkMatch('m1', '2026-09-07T15:30:00.000Z'), mkMatch('m2', '2026-09-10T18:00:00.000Z')]);
  });

  it('keeps map-first map + floating panel, no mobile toggle', async () => {
    renderFind();
    await waitFor(() => expect(screen.getByTestId('find-results-panel')).toBeInTheDocument());
    expect(screen.getByTestId('find-view')).not.toHaveAttribute('data-mobile-view');
    expect(screen.getByTestId('find-map')).toBeInTheDocument();
    expect(screen.queryByTestId('find-mobile-toggle')).toBeNull();
    expect(screen.queryByTestId('find-map-status')).toBeNull();
  });
});
