import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { MantineProvider } from '@mantine/core';
import TripClient from '../TripClient';

const push = jest.fn();
let currentParams = new URLSearchParams(
  'ids=m1,m2&lat=50.06&lon=19.94&label=Kraków, województwo małopolskie, Polska&radius=50&startDate=2026-09-07&endDate=2026-09-20'
);
const setParams = (qs: string) => {
  currentParams = new URLSearchParams(qs);
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  // Stable reference like the real hook — a fresh instance per render
  // would retrigger effects and loop fetches forever.
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

const messages = {
  FindMatches: {
    versus: 'vs',
    selectMatch: 'Select {{home}} vs {{away}}',
    approxTime: 'Approximate kickoff',
    outsideRadius: 'Outside current search radius',
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
  },
};

function mkApiMatch(id: string, dateTime: string, competition = 'PKO Ekstraklasa') {
  return {
    _id: id,
    id,
    homeTeam: { name: `Home ${id}`, crest: `https://example.com/${id}-h.png` },
    awayTeam: { name: `Away ${id}`, crest: `https://example.com/${id}-a.png` },
    competition: { name: competition },
    date: { dateTime },
    stadium: {
      venue: `Stadion ${id}`,
      geo: { latitude: 50.06, longitude: 19.94 },
    },
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
  setParams(
    'ids=m1,m2&lat=50.06&lon=19.94&label=Kraków, województwo małopolskie, Polska&radius=50&startDate=2026-09-07&endDate=2026-09-20'
  );
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe('TripClient', () => {
  test('single-day trip shows actual selected dates, not the search window', async () => {
    mockFetch([
      mkApiMatch('m1', '2026-09-07T15:30:00.000Z'),
      mkApiMatch('m2', '2026-09-07T18:00:00.000Z'),
    ]);
    renderTrip();
    await waitFor(() => expect(screen.getByTestId('trip-match-card-m1')).toBeInTheDocument());
    const meta = screen.getByTestId('trip-meta').textContent ?? '';
    // compact location label, selected day, day count, match count
    expect(meta).toContain('Kraków');
    expect(meta).not.toContain('województwo');
    expect(meta).toContain('2 matches');
    expect(meta).toContain('1 day');
    // search window Sep 7–20 must NOT leak into displayed trip metadata
    expect(meta).not.toMatch(/20/);
  });

  test('multi-day trip shows inclusive day span', async () => {
    mockFetch([
      mkApiMatch('m1', '2026-09-07T15:30:00.000Z'),
      mkApiMatch('m2', '2026-09-10T18:00:00.000Z'),
    ]);
    renderTrip();
    await waitFor(() => expect(screen.getByTestId('trip-match-card-m1')).toBeInTheDocument());
    const meta = screen.getByTestId('trip-meta').textContent ?? '';
    expect(meta).toContain('4 days');
    expect(meta).toContain('2 matches');
  });

  test('single trip header, no checkboxes, trip card family', async () => {
    mockFetch([
      mkApiMatch('m1', '2026-09-07T15:30:00.000Z'),
      mkApiMatch('m2', '2026-09-07T18:00:00.000Z'),
    ]);
    renderTrip();
    await waitFor(() => expect(screen.getByTestId('trip-match-card-m1')).toBeInTheDocument());
    // ONE trip header — no duplicate page title
    expect(screen.getAllByText('Football trip')).toHaveLength(1);
    // read-only trip: no selection checkboxes
    expect(screen.queryByRole('checkbox')).toBeNull();
    // shared card language: both crests, competition logo + name, venue
    expect(screen.getByAltText('Home m1 crest')).toBeInTheDocument();
    expect(screen.getByAltText('Away m1 crest')).toBeInTheDocument();
    expect(screen.getAllByAltText('PKO Ekstraklasa logo')).toHaveLength(2);
    expect(screen.getAllByText('PKO Ekstraklasa').length).toBeGreaterThan(0);
    // compact secondary action, never a "Navigate to stadium" primary button
    expect(screen.getAllByText('Open in maps').length).toBe(2);
    expect(screen.queryByText(/Navigate to stadium/)).toBeNull();
  });

  test('duplicate fixture rows (same id or same event) render once', async () => {
    const base = mkApiMatch('m1', '2026-09-07T15:30:00.000Z');
    mockFetch([
      base,
      { ...base },
      { ...base, _id: 'm1-alias-form', id: 'm1-alias-form' },
    ]);
    renderTrip();
    await waitFor(() => expect(screen.getByTestId('trip-match-card-m1')).toBeInTheDocument());
    expect(screen.queryByTestId('trip-match-card-m1-alias-form')).toBeNull();
    expect(screen.getAllByText('Football trip')).toHaveLength(1);
    expect(screen.getByTestId('trip-meta').textContent).toContain('1 match');
  });

  test('competition name survives missing logo', async () => {
    mockFetch([mkApiMatch('m1', '2026-09-07T15:30:00.000Z', 'Klasa B (Nowy Sącz)')]);
    setParams('ids=m1');
    renderTrip();
    await waitFor(() => expect(screen.getByTestId('trip-match-card-m1')).toBeInTheDocument());
    expect(screen.getByText('Klasa B (Nowy Sącz)')).toBeInTheDocument();
  });

  test('map shows only trip fixtures, chronological route, no radius circle', async () => {
    // API returns late match first — route must still be chronological.
    mockFetch([
      mkApiMatch('m2', '2026-09-10T18:00:00.000Z'),
      mkApiMatch('m1', '2026-09-07T15:30:00.000Z'),
    ]);
    renderTrip();
    await waitFor(() => expect(lastMapProps).not.toBeNull());
    await waitFor(() => expect(screen.queryByTestId('trip-match-card-m1')).toBeInTheDocument());
    const route = (lastMapProps?.routeFixtures as Array<{ _id: string }>) ?? [];
    expect(route.map((m) => m._id)).toEqual(['m1', 'm2']);
    expect((lastMapProps?.fitFixtures as unknown[]).length).toBe(2);
    expect(lastMapProps?.showSelectedLocationRadius).toBe(false);
    expect(lastMapProps?.selectedLocation).toBeUndefined();
  });

  test('card click focuses map; card hover highlights marker', async () => {
    mockFetch([mkApiMatch('m1', '2026-09-07T15:30:00.000Z')]);
    setParams('ids=m1');
    renderTrip();
    await waitFor(() => expect(screen.getByTestId('trip-match-card-m1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('trip-match-card-m1'));
    await waitFor(() => expect(lastMapProps?.focus).toBeDefined());
    expect(lastMapProps?.focus).toMatchObject({ lat: 50.06, lon: 19.94 });
    fireEvent.mouseEnter(screen.getByTestId('trip-match-card-m1'));
    await waitFor(() => expect(lastMapProps?.hoveredMatchId).toBe('m1'));
  });

  test('copy link copies the canonical /trip URL', async () => {
    mockFetch([mkApiMatch('m1', '2026-09-07T15:30:00.000Z')]);
    setParams('ids=m1&lat=50.06&lon=19.94&label=Kraków&radius=50');
    renderTrip();
    await waitFor(() => expect(screen.getByTestId('trip-copy-link')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('trip-copy-link'));
    await waitFor(() => expect(window.navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    const copied = (window.navigator.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
    expect(copied).toContain('/trip?');
    expect(copied).not.toContain('/matches?');
    expect(copied).toContain('ids=m1');
  });

  test('edit trip returns to /find customize mode with ids + context', async () => {
    mockFetch([mkApiMatch('m1', '2026-09-07T15:30:00.000Z')]);
    setParams(
      'ids=m1&lat=50.06&lon=19.94&label=Kraków&radius=50&startDate=2026-09-07&endDate=2026-09-20'
    );
    renderTrip();
    await waitFor(() => expect(screen.getByTestId('trip-edit')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('trip-edit'));
    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(url.startsWith('/find?')).toBe(true);
    expect(url).toContain('mode=customize');
    expect(url).toContain('ids=m1');
  });
});
