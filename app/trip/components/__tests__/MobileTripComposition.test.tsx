import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { MantineProvider } from '@mantine/core';
import TripClient from '../TripClient';

const push = jest.fn();
let currentParams = new URLSearchParams(
  'ids=m1,m2&lat=50.06&lon=19.94&label=Kraków, Polska&radius=50&startDate=2026-09-07&endDate=2026-09-20'
);

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
    return <div data-testid="trip-map-mock" />;
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
    versus: 'vs',
    selectMatch: 'Select {{home}} vs {{away}}',
    approxTime: 'Approximate kickoff',
    outsideRadius: 'Outside current search radius',
    scheduleTbc: 'Schedule TBC',
    kickoffTbc: 'Kickoff TBC',
  },
  TripPage: {
    title: 'Football trip',
    matchCount: '{{count}} matches',
    copyLink: 'Copy link',
    linkCopied: 'Link copied',
    editTrip: 'Edit trip',
    openInMaps: 'Open in maps',
    oneDay: '1 day',
    days: '{{count}} days',
    loading: 'Loading trip...',
    emptyNoIds: 'Provide match ids',
    emptyNotFound: 'No matches found',
    missingWarning: 'Missing: {{ids}}',
    confirmedMatches: 'confirmed matches',
    awaitingSchedule: 'awaiting schedule',
    confirmedSection: 'CONFIRMED',
    tbcSection: 'SCHEDULE TBC',
    viewItinerary: 'Itinerary',
    viewMap: 'Map',
  },
};

function mkApiMatch(id: string, dateTime: string) {
  return {
    _id: id,
    id,
    homeTeam: { name: `Home ${id}`, crest: `https://example.com/${id}-h.png` },
    awayTeam: { name: `Away ${id}`, crest: `https://example.com/${id}-a.png` },
    competition: { name: 'Ekstraklasa' },
    date: { dateTime },
    stadium: { venue: `Stadion ${id}`, geo: { latitude: 50.06, longitude: 19.94 } },
    _distanceKm: 5,
  };
}

function mockFetch(matches: ReturnType<typeof mkApiMatch>[]) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ matches, totalCount: matches.length, missingIds: [] }),
  }) as unknown as typeof fetch;
}

function renderTrip() {
  return render(
    <MantineProvider>
      <LocaleProvider locale="en" messages={messages}>
        <TripClient />
      </LocaleProvider>
    </MantineProvider>
  );
}

beforeEach(() => {
  push.mockClear();
  lastMapProps = null;
  currentParams = new URLSearchParams(
    'ids=m1,m2&lat=50.06&lon=19.94&label=Kraków, Polska&radius=50&startDate=2026-09-07&endDate=2026-09-20'
  );
});

describe('Trip mobile composition (itinerary-first)', () => {
  beforeEach(() => {
    mockMatchMedia(true);
    mockFetch([
      mkApiMatch('m1', '2026-09-07T15:30:00.000Z'),
      mkApiMatch('m2', '2026-09-07T18:00:00.000Z'),
    ]);
  });

  it('defaults to Itinerary with no map spacer in layout', async () => {
    renderTrip();
    await waitFor(() => expect(screen.getByTestId('trip-match-card-m1')).toBeInTheDocument());
    expect(screen.getByTestId('trip-view')).toHaveAttribute('data-mobile-view', 'list');
    // THE MAP MUST NOT OCCUPY LAYOUT HEIGHT in itinerary mode
    expect(screen.queryByTestId('trip-map')).toBeNull();
    expect(screen.getByTestId('trip-panel')).toBeInTheDocument();
    // semantic toggle labels
    expect(screen.getByTestId('trip-mobile-toggle')).toHaveTextContent('Itinerary');
    expect(screen.getByTestId('trip-mobile-toggle')).toHaveTextContent('Map');
    // summary + actions in flow
    expect(screen.getByTestId('trip-meta')).toBeInTheDocument();
    expect(screen.getByTestId('trip-copy-link')).toBeInTheDocument();
    expect(screen.getByTestId('trip-edit')).toBeInTheDocument();
  });

  it('Itinerary -> Map -> Itinerary preserves trip state', async () => {
    renderTrip();
    await waitFor(() => expect(screen.getByTestId('trip-match-card-m1')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Map'));
    await waitFor(() => expect(screen.getByTestId('trip-map')).toBeInTheDocument());
    expect(screen.queryByTestId('trip-panel')).toBeNull();
    expect(screen.getByTestId('trip-map-status')).toBeInTheDocument();
    // trip map semantics preserved: markers + chronological route, no radius circle
    await waitFor(() => expect(lastMapProps).not.toBeNull());
    expect((lastMapProps?.fitFixtures as unknown[]).length).toBe(2);
    expect((lastMapProps?.routeFixtures as Array<{ _id: string }>).map((m) => m._id)).toEqual([
      'm1',
      'm2',
    ]);
    expect(lastMapProps?.showSelectedLocationRadius).toBe(false);

    fireEvent.click(within(screen.getByTestId('trip-mobile-toggle')).getByText('Itinerary'));
    await waitFor(() => expect(screen.getByTestId('trip-panel')).toBeInTheDocument());
    expect(screen.queryByTestId('trip-map')).toBeNull();
    // content intact
    expect(screen.getByTestId('trip-match-card-m1')).toBeInTheDocument();
    expect(screen.getByTestId('trip-match-card-m2')).toBeInTheDocument();
    expect(screen.getByTestId('trip-meta')).toHaveTextContent('2 matches');
  });

  it('mobile map insets are compact overlays (no 62vh sheet reservation)', async () => {
    renderTrip();
    await waitFor(() => expect(screen.getByTestId('trip-match-card-m1')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Map'));
    await waitFor(() => expect(lastMapProps).not.toBeNull());
    const insets = lastMapProps?.viewportInsets as { top: number; bottom: number };
    expect(insets.top).toBeLessThan(200);
    expect(insets.bottom).toBeLessThan(200);
  });
});

describe('Trip desktop composition unchanged', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    mockFetch([mkApiMatch('m1', '2026-09-07T15:30:00.000Z')]);
  });

  it('keeps map + floating itinerary panel, no mobile toggle', async () => {
    renderTrip();
    await waitFor(() => expect(screen.getByTestId('trip-match-card-m1')).toBeInTheDocument());
    expect(screen.getByTestId('trip-view')).not.toHaveAttribute('data-mobile-view');
    expect(screen.getByTestId('trip-map')).toBeInTheDocument();
    expect(screen.getByTestId('trip-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('trip-mobile-toggle')).toBeNull();
    expect(screen.queryByTestId('trip-map-status')).toBeNull();
  });
});
