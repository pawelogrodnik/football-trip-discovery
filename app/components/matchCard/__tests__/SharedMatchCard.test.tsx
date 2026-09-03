import { fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { MantineProvider } from '@mantine/core';
import SharedMatchCard from '../SharedMatchCard';

const messages = {
  FindMatches: {
    versus: 'vs',
    selectMatch: 'Select {{home}} vs {{away}}',
    approxTime: 'Approximate kickoff',
    outsideRadius: 'Outside current search radius',
  },
  TripPage: {
    openInMaps: 'Open in maps',
  },
};

function mkMatch(extra: Record<string, unknown> = {}) {
  return {
    _id: 'm1',
    homeTeam: { name: 'Hutnik II Kraków', crest: 'https://example.com/h.png' },
    awayTeam: { name: 'Bocheński KS', crest: 'https://example.com/a.png' },
    competition: { name: 'PKO Ekstraklasa' },
    date: { dateTime: '2026-09-07T15:30:00.000Z' },
    stadium: { venue: 'Stadion Suche Stawy', geo: { latitude: 50, longitude: 19 } },
    _distanceKm: 4.97,
    ...extra,
  };
}

function renderCard(variant: 'selectable' | 'trip', extra?: Record<string, unknown>) {
  const handlers = {
    onToggle: jest.fn(),
    onFocus: jest.fn(),
    onHover: jest.fn(),
  };
  const match = mkMatch(extra?.match as Record<string, unknown>);
  render(
    <MantineProvider>
      <LocaleProvider locale="en" messages={messages}>
        <SharedMatchCard
          match={match as never}
          variant={variant}
          selected={(extra?.selected as boolean) ?? false}
          hovered={false}
          testIdPrefix="card"
          selectTestIdPrefix="card-select"
          navigationHref={variant === 'trip' ? 'https://maps.example.com/' : null}
          onToggle={handlers.onToggle}
          onFocus={handlers.onFocus}
          onHover={handlers.onHover}
        />
      </LocaleProvider>
    </MantineProvider>
  );
  return handlers;
}

describe('SharedMatchCard', () => {
  test('shared family: crests, competition logo+name, venue, lowercase km', () => {
    for (const variant of ['selectable', 'trip'] as const) {
      const { unmount } = render(
        <MantineProvider>
          <LocaleProvider locale="en" messages={messages}>
            <SharedMatchCard
              match={mkMatch() as never}
              variant={variant}
              testIdPrefix="card"
              selectTestIdPrefix="card-select"
              navigationHref={variant === 'trip' ? 'https://maps.example.com/' : null}
              onToggle={jest.fn()}
              onFocus={jest.fn()}
              onHover={jest.fn()}
            />
          </LocaleProvider>
        </MantineProvider>
      );
      expect(screen.getByText('Hutnik II Kraków')).toBeInTheDocument();
      expect(screen.getByText('Bocheński KS')).toBeInTheDocument();
      expect(screen.getByAltText('Hutnik II Kraków crest')).toBeInTheDocument();
      expect(screen.getByAltText('Bocheński KS crest')).toBeInTheDocument();
      expect(screen.getByAltText('PKO Ekstraklasa logo')).toBeInTheDocument();
      expect(screen.getByText('PKO Ekstraklasa')).toBeInTheDocument();
      expect(screen.getByText('Stadion Suche Stawy')).toBeInTheDocument();
      unmount();
    }
  });

  test('selectable variant keeps checkbox + rounded distance; trip has neither', () => {
    const { unmount } = render(
      <MantineProvider>
        <LocaleProvider locale="en" messages={messages}>
          <SharedMatchCard
            match={mkMatch() as never}
            variant="selectable"
            testIdPrefix="card"
            selectTestIdPrefix="card-select"
            onToggle={jest.fn()}
            onFocus={jest.fn()}
            onHover={jest.fn()}
          />
        </LocaleProvider>
      </MantineProvider>
    );
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText('5 km')).toBeInTheDocument();
    expect(screen.queryByText('5 KM')).toBeNull();
    unmount();

    const handlers = renderCard('trip');
    expect(screen.queryByRole('checkbox')).toBeNull();
    // trip distance (search-center metric) is not presented as trip content
    expect(screen.queryByText('5 km')).toBeNull();
    expect(screen.getByText('Open in maps')).toBeInTheDocument();
    expect(handlers.onToggle).not.toHaveBeenCalled();
  });

  test('trip card click focuses map; maps link does not bubble to card', () => {
    const handlers = renderCard('trip');
    fireEvent.click(screen.getByTestId('card-m1'));
    expect(handlers.onFocus).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Open in maps'));
    expect(handlers.onFocus).toHaveBeenCalledTimes(1);
  });

  test('missing crests fall back to initials; missing logo keeps name', () => {
    renderCard('trip', {
      match: {
        homeTeam: { name: 'Hutnik II Kraków', crest: null },
        awayTeam: { name: 'Bocheński KS', crest: undefined },
        competition: { name: 'Klasa B (Nowy Sącz)' },
      },
    });
    expect(screen.queryByAltText('Hutnik II Kraków crest')).not.toBeInTheDocument();
    expect(screen.getByText('Klasa B (Nowy Sącz)')).toBeInTheDocument();
    expect(screen.queryByAltText(/logo/)).not.toBeInTheDocument();
  });

  test('kickoff is localized time-only, never a raw datetime', () => {
    renderCard('selectable');
    const card = screen.getByTestId('card-m1');
    expect(card.textContent).toMatch(/\d{1,2}:\d{2}/);
    expect(card.textContent).not.toContain('2026');
  });
});
