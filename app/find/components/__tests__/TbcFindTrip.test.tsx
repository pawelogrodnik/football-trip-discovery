import { render, screen } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { MantineProvider } from '@mantine/core';
import SharedMatchCard from '../../../components/matchCard/SharedMatchCard';
import FindMatchCard from '../FindMatchCard';
import {
  countConfirmedTbc,
  groupMatchesByDay,
  isTbcMatch,
  selectedTripRange,
} from '../findResultsUtils';

const messages = {
  FindMatches: {
    versus: 'vs',
    selectMatch: 'Select {{home}} vs {{away}}',
    approxTime: 'Approximate kickoff',
    outsideRadius: 'Outside current search radius',
    scheduleTbc: 'Schedule TBC',
    dateKickoffTbc: 'Date & kickoff TBC',
    kickoffTbc: 'Kickoff TBC',
    confirmedTbcCount: '{{confirmed}} confirmed · {{tbc}} TBC',
    selectedCount: '{{count}} matches selected',
  },
};

const windowMatch: any = {
  id: 'w1',
  homeTeam: { name: 'Hutnik Kraków' },
  awayTeam: { name: 'Dalin Myślenice' },
  competition: { name: 'IV liga' },
  schedule: { status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' },
  stadium: { venue: 'Stadion Suche Stawy' },
};

const confirmedMatch: any = {
  id: 'c1',
  homeTeam: { name: 'Como 1907' },
  awayTeam: { name: 'Inter' },
  competition: { name: 'Serie A' },
  date: { dateTime: '2026-10-23T18:00:00.000Z' },
  stadium: { venue: 'Stadio Sinigaglia' },
};

describe('TBC Find behavior (issue #9)', () => {
  test('window fixture is TBC and groups under its own window key', () => {
    expect(isTbcMatch(windowMatch)).toBe(true);
    expect(isTbcMatch(confirmedMatch)).toBe(false);
    const groups = groupMatchesByDay([confirmedMatch, windowMatch]);
    expect(groups.some((g) => g.window?.startDateOnly === '2026-10-22')).toBe(true);
    // window group is not merged into the confirmed day group
    const windowGroup = groups.find((g) => g.window);
    expect(windowGroup?.matches.map((m: any) => m.id)).toEqual(['w1']);
  });

  test('confirmed/TBC split counts selection', () => {
    expect(countConfirmedTbc([confirmedMatch, windowMatch])).toEqual({ confirmed: 1, tbc: 1 });
  });

  test('selection range accounts for fixture windows', () => {
    const range = selectedTripRange([windowMatch]);
    expect(range.dayCount).toBe(2);
  });

  test('window card shows TBC label and no fake kickoff', () => {
    render(
      <MantineProvider>
        <LocaleProvider locale="en" messages={messages}>
          <FindMatchCard
            match={windowMatch}
            selected={false}
            hovered={false}
            outsideRadius={false}
            onToggle={() => {}}
            onFocus={() => {}}
            onHover={() => {}}
          />
        </LocaleProvider>
      </MantineProvider>
    );
    expect(screen.getByTestId('find-match-card-tbc-w1')).toBeInTheDocument();
    expect(screen.getByText('Date & kickoff TBC')).toBeInTheDocument();
    // no invented kickoff time on the card
    expect(screen.queryByText(/~.*:/)).not.toBeInTheDocument();
    // crests + competition preserved
    expect(screen.getByText('Hutnik Kraków')).toBeInTheDocument();
    expect(screen.getByText('IV liga')).toBeInTheDocument();
  });

  test('date-confirmed card shows kickoff TBC instead of synthetic noon', () => {
    const dayOnly: any = {
      id: 'd1',
      homeTeam: { name: 'A' },
      awayTeam: { name: 'B' },
      competition: { name: 'IV liga' },
      date: { date: '2026-10-23' },
      stadium: {},
    };
    render(
      <MantineProvider>
        <LocaleProvider locale="en" messages={messages}>
          <SharedMatchCard match={dayOnly} variant="selectable" testIdPrefix="find-match-card" />
        </LocaleProvider>
      </MantineProvider>
    );
    expect(screen.getByText('Kickoff TBC')).toBeInTheDocument();
  });
});
