import { fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { MantineProvider } from '@mantine/core';
import FindMatchCard from '../FindMatchCard';

const messages = {
  FindMatches: {
    versus: 'vs',
    selectMatch: 'Select {{home}} vs {{away}}',
    approxTime: 'Approximate kickoff',
    outsideRadius: 'Outside current search radius',
  },
};

function renderCard(props?: Record<string, unknown>) {
  const onToggle = jest.fn();
  const onFocus = jest.fn();
  const onHover = jest.fn();
  const match = {
    _id: 'm1',
    homeTeam: { name: 'Hutnik II Kraków', crest: 'https://example.com/h.png' },
    awayTeam: { name: 'Bocheński KS', crest: 'https://example.com/a.png' },
    competition: { name: 'IV liga' },
    date: { dateTime: '2026-09-07T15:30:00.000Z' },
    stadium: { venue: 'Stadion Suche Stawy', geo: { latitude: 50, longitude: 19 } },
    _distanceKm: 4.97,
    ...(props?.match as Record<string, unknown>),
  };
  render(
    <MantineProvider>
      <LocaleProvider locale="en" messages={messages}>
        <FindMatchCard
          match={match as never}
          selected={(props?.selected as boolean) ?? false}
          hovered={false}
          outsideRadius={(props?.outsideRadius as boolean) ?? false}
          onToggle={onToggle}
          onFocus={onFocus}
          onHover={onHover}
        />
      </LocaleProvider>
    </MantineProvider>
  );
  return { onToggle, onFocus, onHover };
}

describe('FindMatchCard', () => {
  test('shows both teams, crests, competition name, kickoff, venue, rounded distance', () => {
    renderCard();
    expect(screen.getByText('Hutnik II Kraków')).toBeInTheDocument();
    expect(screen.getByText('Bocheński KS')).toBeInTheDocument();
    expect(screen.getByAltText('Hutnik II Kraków crest')).toBeInTheDocument();
    expect(screen.getByAltText('Bocheński KS crest')).toBeInTheDocument();
    expect(screen.getByText('IV liga')).toBeInTheDocument();
    expect(screen.getByText('Stadion Suche Stawy')).toBeInTheDocument();
    expect(screen.getByText('5 km')).toBeInTheDocument();
    // no redundant full date, no fake transport times
    expect(screen.queryByText(/1h walk/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Distance:/)).not.toBeInTheDocument();
  });

  test('competition without logo still renders competition name', () => {
    renderCard({ match: { competition: { name: 'Klasa B (Nowy Sącz)' } } });
    expect(screen.getByText('Klasa B (Nowy Sącz)')).toBeInTheDocument();
    expect(screen.queryByAltText(/logo/)).not.toBeInTheDocument();
  });

  test('missing team crest falls back to initials, no broken image', () => {
    renderCard({
      match: {
        homeTeam: { name: 'Hutnik II Kraków', crest: null },
        awayTeam: { name: 'Bocheński KS', crest: undefined },
      },
    });
    expect(screen.queryByAltText('Hutnik II Kraków crest')).not.toBeInTheDocument();
    expect(screen.getAllByText(/HIK|BK/i).length).toBeGreaterThan(0);
  });

  test('checkbox toggles selection; card click focuses without toggling', () => {
    const { onToggle, onFocus } = renderCard();
    fireEvent.click(screen.getByTestId('find-match-card-m1'));
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('m1');
  });

  test('checkbox has meaningful accessible label, not aria-hidden', () => {
    renderCard();
    const box = screen.getByRole('checkbox');
    expect(box).toHaveAccessibleName(/Hutnik II Kraków vs Bocheński KS/);
    expect(box.getAttribute('aria-hidden')).not.toBe('true');
  });

  test('approximate kickoff is marked, outside-radius badge renders', () => {
    renderCard({
      match: { date: { dateTime: '2026-09-07T12:00:00.000Z', approximate: true } },
      outsideRadius: true,
    });
    expect(screen.getByText(/~.*:/)).toBeInTheDocument();
    expect(screen.getByText('Approximate kickoff')).toBeInTheDocument();
    expect(screen.getByText('Outside current search radius')).toBeInTheDocument();
  });
});
