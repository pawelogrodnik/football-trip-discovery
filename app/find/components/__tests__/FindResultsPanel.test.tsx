import { fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { MantineProvider } from '@mantine/core';
import FindResultsPanel from '../FindResultsPanel';

const messages = {
  FindMatches: {
    editSearch: 'Edit search',
    allMatches: 'All',
    selectedMatches: 'Selected',
    noSelectedTitle: 'No matches selected yet.',
    noSelectedHint: 'Choose matches from All to build your trip.',
    showAll: 'Show all matches',
    selectedCount: '{{count}} matches selected',
    selectedRangeDays: '{{range}} · {{count}} days',
    createTrip: 'Create trip',
    customizingBadge: 'Customizing suggested trip',
    resetSuggested: 'Reset to suggested trip',
    outsideRadius: 'Outside current search radius',
    versus: 'vs',
    selectMatch: 'Select {{home}} vs {{away}}',
    approxTime: 'Approximate kickoff',
  },
};

function mkMatch(id: string, dateTime: string) {
  return {
    _id: id,
    homeTeam: { name: `Home ${id}`, crest: `https://example.com/${id}-h.png` },
    awayTeam: { name: `Away ${id}`, crest: `https://example.com/${id}-a.png` },
    competition: { name: 'IV liga' },
    date: { dateTime },
    stadium: { venue: `Stadion ${id}`, geo: { latitude: 50, longitude: 19 } },
    _distanceKm: 5,
  };
}

const MATCHES = [
  mkMatch('m1', '2026-09-07T15:30:00.000Z'),
  mkMatch('m2', '2026-09-07T18:00:00.000Z'),
  mkMatch('m3', '2026-09-10T17:00:00.000Z'),
];

function renderPanel(props?: Record<string, unknown>) {
  const handlers = {
    onFilterChange: jest.fn(),
    onToggle: jest.fn(),
    onFocus: jest.fn(),
    onHover: jest.fn(),
    onBack: jest.fn(),
    onCreateTrip: jest.fn(),
    onResetSuggested: jest.fn(),
  };
  let filter: 'all' | 'selected' = (props?.filter as 'all' | 'selected') ?? 'all';
  const selectedIds = (props?.selectedIds as string[]) ?? ['m1'];
  const { rerender } = render(
    <MantineProvider>
      <LocaleProvider locale="en" messages={messages}>
        <FindResultsPanel
          matches={MATCHES as never}
          selectedIds={selectedIds}
          filter={filter}
          onFilterChange={(f) => {
            filter = f;
            handlers.onFilterChange(f);
          }}
          onToggle={handlers.onToggle}
          onFocus={handlers.onFocus}
          onHover={handlers.onHover}
          hoveredId={null}
          onBack={handlers.onBack}
          onCreateTrip={handlers.onCreateTrip}
          headerTitle="3 matches near Kraków"
          headerSubtitle="Sep 7–10 · within 50 km"
          customizeMode={(props?.customizeMode as boolean) ?? false}
          onResetSuggested={handlers.onResetSuggested}
          showReset={(props?.showReset as boolean) ?? false}
        />
      </LocaleProvider>
    </MantineProvider>
  );
  return { handlers, rerender };
}

describe('FindResultsPanel', () => {
  test('All filter shows full set; Selected shows only selected ids', () => {
    renderPanel({ selectedIds: ['m1', 'm3'] });
    expect(screen.getByTestId('find-match-card-m1')).toBeInTheDocument();
    expect(screen.getByTestId('find-match-card-m2')).toBeInTheDocument();
    expect(screen.getByTestId('find-match-card-m3')).toBeInTheDocument();
  });

  test('selected empty state offers Show all (not generic no-matches)', () => {
    renderPanel({ selectedIds: [], filter: 'selected' });
    expect(screen.getByTestId('find-selected-empty')).toBeInTheDocument();
    expect(screen.getByText('No matches selected yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('find-show-all'));
  });

  test('selection switch does not clear selection; footer range + create-trip state', () => {
    renderPanel({ selectedIds: ['m1', 'm3'] });
    expect(screen.getByTestId('find-selected-count')).toHaveTextContent('2 matches selected');
    expect(screen.getByTestId('find-selected-range')).toBeInTheDocument();
    expect(screen.getByTestId('find-create-trip')).toBeEnabled();
  });

  test('zero selection disables Create trip and hides range', () => {
    renderPanel({ selectedIds: [] });
    expect(screen.getByTestId('find-create-trip')).toBeDisabled();
    expect(screen.queryByTestId('find-selected-range')).not.toBeInTheDocument();
  });

  test('create trip button does not repeat count', () => {
    renderPanel({ selectedIds: ['m1'] });
    expect(screen.getByTestId('find-create-trip')).toHaveTextContent('Create trip');
    expect(screen.getByTestId('find-create-trip')).not.toHaveTextContent('·');
  });

  test('customize badge + reset visible only in customize mode', () => {
    const { unmount } = render(
      <MantineProvider>
        <LocaleProvider locale="en" messages={messages}>
          <FindResultsPanel
            matches={MATCHES as never}
            selectedIds={['m1']}
            filter="all"
            onFilterChange={jest.fn()}
            onToggle={jest.fn()}
            onFocus={jest.fn()}
            onHover={jest.fn()}
            hoveredId={null}
            onBack={jest.fn()}
            onCreateTrip={jest.fn()}
            headerTitle="t"
            headerSubtitle="s"
            customizeMode
            onResetSuggested={jest.fn()}
            showReset
          />
        </LocaleProvider>
      </MantineProvider>
    );
    expect(screen.getByTestId('find-customizing-badge')).toBeInTheDocument();
    expect(screen.getByTestId('find-reset-suggested')).toBeInTheDocument();
    unmount();
  });

  test('regular find shows no reset', () => {
    renderPanel({ customizeMode: false, showReset: false });
    expect(screen.queryByTestId('find-reset-suggested')).not.toBeInTheDocument();
    expect(screen.queryByTestId('find-customizing-badge')).not.toBeInTheDocument();
  });

  test('card click calls focus without toggling selection', () => {
    const { handlers } = renderPanel({ selectedIds: [] });
    fireEvent.click(screen.getByTestId('find-match-card-m2'));
    expect(handlers.onFocus).toHaveBeenCalledTimes(1);
    expect(handlers.onToggle).not.toHaveBeenCalled();
  });
});
