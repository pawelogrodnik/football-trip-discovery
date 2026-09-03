import {
  getFeaturedTripMatch,
  getUniqueTripTeams,
  getVisibleTripCompetitions,
  getVisibleTripTeams,
  stableTeamKey,
} from '../../discover/components/tripCardData';
import {
  getCompetitionPriority,
  getCompetitionTier,
  isUefaCompetition,
  normalizeCompetitionName,
} from '../competitionPriority';
import type { TripMatch } from '../tripOptimizer';

describe('competitionPriority', () => {
  test('uefa variants normalize; UCL > UEL > UECL > domestic', () => {
    expect(normalizeCompetitionName('UEFA Europa League')).toBe('europa league');
    const ucl = getCompetitionPriority('Champions League');
    const uel = getCompetitionPriority('Europa League');
    const uecl = getCompetitionPriority('Conference League');
    const sa = getCompetitionPriority('Serie A');
    expect(ucl).toBeGreaterThan(uel);
    expect(uel).toBeGreaterThan(uecl);
    expect(uecl).toBeGreaterThan(sa);
    expect(isUefaCompetition('UEFA Champions League')).toBe(true);
    expect(isUefaCompetition({ name: 'Serie A', code: 'SA' })).toBe(false);
  });

  test('tier order: top domestic > cups/second tier > lower levels', () => {
    expect(getCompetitionTier('Serie A')).toBe(2);
    expect(getCompetitionTier('Coppa Italia')).toBe(3);
    expect(getCompetitionTier('Serie B')).toBe(3);
    expect(getCompetitionTier('Serie C Group A')).toBe(4);
    expect(getCompetitionTier('')).toBe(0);
    expect(getCompetitionPriority('Serie A')).toBeGreaterThan(
      getCompetitionPriority('Serie C Group A')
    );
  });

  test('stableTeamKey is case/diacritics-insensitive', () => {
    expect(stableTeamKey('KKS Lech Poznań')).toBe(stableTeamKey('kks lech poznan'));
  });
});

function mkMatch(
  home: string,
  away: string,
  comp: string,
  day: number,
  logo?: string | null
): TripMatch {
  return {
    id: `${home}-${away}-${day}`,
    homeTeam: { name: home, crest: `${home}-crest` },
    awayTeam: { name: away, crest: `${away}-crest` },
    competition: { name: comp, logo: logo === undefined ? null : logo } as TripMatch['competition'],
    date: { dateTime: `2026-09-${String(day).padStart(2, '0')}T20:00:00.000Z` },
    stadium: { city: 'Milan', geo: { latitude: 45.4, longitude: 9.1 } },
  } as TripMatch;
}

describe('tripCardData', () => {
  test('teams deduped; priority from highest-tier match; ucl clubs first', () => {
    const matches = [
      mkMatch('Como', 'Lecce', 'Serie C Group A', 16),
      mkMatch('AC Milan', 'Benfica', 'Champions League', 17),
      mkMatch('AC Milan', 'Lecce', 'Serie A', 18),
    ];
    const teams = getUniqueTripTeams(matches);
    const names = teams.map((tm) => tm.name);
    // Milan once, ranked by its UCL appearance
    expect(names.filter((n) => n === 'AC Milan')).toHaveLength(1);
    expect(names.slice(0, 2)).toEqual(['AC Milan', 'Benfica']);
    expect(names).toHaveLength(4);
  });

  test('tie-break: chronological, home before away', () => {
    const matches = [mkMatch('Zeta', 'Alpha', 'Serie A', 16)];
    const teams = getUniqueTripTeams(matches);
    expect(teams.map((tm) => tm.name)).toEqual(['Zeta', 'Alpha']);
  });

  test('visible teams capped at 6 with hidden count', () => {
    const matches = Array.from({ length: 6 }, (_, i) =>
      mkMatch(`Home${i}`, `Away${i}`, 'Serie A', 16 + i)
    );
    const { visible, hiddenCount } = getVisibleTripTeams(matches, 6);
    expect(visible).toHaveLength(6);
    expect(hiddenCount).toBe(6);
  });

  test('competitions deduped, logo-less omitted, priority sorted', () => {
    const matches = [
      mkMatch('A', 'B', 'Serie C Group A', 16, 'c.png'),
      mkMatch('C', 'D', 'Serie A', 17, null),
      mkMatch('E', 'F', 'Champions League', 18, 'ucl.png'),
      mkMatch('G', 'H', 'Serie A', 19, 'sa.png'),
      mkMatch('I', 'J', 'Serie A', 20, 'sa.png'),
    ];
    const comps = getVisibleTripCompetitions(matches, 5);
    expect(comps.map((c) => c.name)).toEqual(['Champions League', 'Serie A', 'Serie C Group A']);
  });

  test('featured match is highest priority, chronological tie-break', () => {
    const matches = [
      mkMatch('A', 'B', 'Serie C Group A', 16),
      mkMatch('C', 'D', 'Champions League', 18),
      mkMatch('E', 'F', 'Serie A', 17),
    ];
    expect(getFeaturedTripMatch(matches)?.homeTeam.name).toBe('C');
  });
});
