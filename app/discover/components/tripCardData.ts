import { getCompetitionPriority } from 'lib/competitionPriority';
import type { TripMatch } from 'lib/tripOptimizer';

export type TripTeam = {
  key: string;
  name: string;
  crest?: string | null;
  priority: number;
  firstIndex: number;
  homeFirst: boolean;
};

export type TripCompetition = {
  key: string;
  name: string;
  logo?: string | null;
  priority: number;
  firstIndex: number;
};

/** Deterministic team key: diacritics-free, case-insensitive, collapsed spaces. */
export function stableTeamKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function matchStartMs(m: TripMatch): number {
  const iso = m.date?.dateTime || (m.date?.date ? `${m.date.date}T00:00:00.000Z` : null);
  if (!iso) {
    return 0;
  }
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

export function chronologicalMatches(matches: TripMatch[]): TripMatch[] {
  return [...matches].sort((a, b) => matchStartMs(a) - matchStartMs(b));
}

function teamDisplayName(team: { name?: string | null } | null | undefined): string {
  return (team?.name ?? '').trim();
}

/**
 * Unique teams across all matches. Priority = highest-priority match the team
 * appears in. Ties: first chronological appearance, home before away.
 */
export function getUniqueTripTeams(matches: TripMatch[]): TripTeam[] {
  const chrono = chronologicalMatches(matches);
  const byKey = new Map<string, TripTeam>();
  chrono.forEach((m, matchIndex) => {
    const priority = getCompetitionPriority(m.competition);
    const sides = [
      { team: m.homeTeam, home: true },
      { team: m.awayTeam, home: false },
    ];
    for (const { team, home } of sides) {
      const name = teamDisplayName(team);
      if (!name) {
        continue;
      }
      const key = stableTeamKey(name);
      if (!key) {
        continue;
      }
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          key,
          name,
          crest: team?.crest ?? null,
          priority,
          firstIndex: matchIndex,
          homeFirst: home,
        });
      } else {
        if (priority > existing.priority) {
          existing.priority = priority;
        }
        if (!existing.crest && team?.crest) {
          existing.crest = team.crest;
        }
      }
    }
  });
  return Array.from(byKey.values()).sort(
    (a, b) =>
      b.priority - a.priority ||
      a.firstIndex - b.firstIndex ||
      Number(b.homeFirst) - Number(a.homeFirst)
  );
}

export function getVisibleTripTeams(
  matches: TripMatch[],
  limit = 6
): {
  visible: TripTeam[];
  hiddenCount: number;
} {
  const all = getUniqueTripTeams(matches);
  return { visible: all.slice(0, limit), hiddenCount: Math.max(0, all.length - limit) };
}

function competitionLogo(m: TripMatch): string | null {
  const comp = m.competition as unknown as {
    logo?: { FULL_LOGO?: string | null; full?: string | null } | string | null;
  };
  const logo = comp?.logo;
  if (!logo) {
    return null;
  }
  if (typeof logo === 'string') {
    return logo;
  }
  return logo.FULL_LOGO ?? logo.full ?? null;
}

/**
 * Unique competitions with a real logo asset. Sorted by central priority,
 * ties by first chronological appearance.
 */
export function getVisibleTripCompetitions(matches: TripMatch[], limit = 5): TripCompetition[] {
  const chrono = chronologicalMatches(matches);
  const byKey = new Map<string, TripCompetition>();
  chrono.forEach((m, matchIndex) => {
    const name = (m.competition?.name ?? '').trim();
    if (!name) {
      return;
    }
    const logo = competitionLogo(m);
    if (!logo) {
      return;
    }
    const key = (m.competition?.code ?? '').trim().toUpperCase() || stableTeamKey(name);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        name,
        logo,
        priority: getCompetitionPriority(m.competition),
        firstIndex: matchIndex,
      });
    }
  });
  return Array.from(byKey.values())
    .sort((a, b) => b.priority - a.priority || a.firstIndex - b.firstIndex)
    .slice(0, limit);
}

/** Uniform non-UEFA country shared by all matches, title-cased. Null if mixed/unknown. */
export function getTripCountryLabel(matches: { country?: string | null }[]): string | null {
  const countries = new Set(
    matches.map((m) => (m.country ?? '').trim().toUpperCase()).filter(Boolean)
  );
  if (countries.size !== 1) {
    return null;
  }
  const [only] = Array.from(countries);
  if (only === 'EUROPE' || only === 'UEFA') {
    return null;
  }
  return only.charAt(0) + only.slice(1).toLowerCase();
}

/** Highest-priority fixture (ties: chronological). Used for the 1-match preview. */
export function getFeaturedTripMatch(matches: TripMatch[]): TripMatch | null {
  if (matches.length === 0) {
    return null;
  }
  const chrono = chronologicalMatches(matches);
  let best = chrono[0];
  let bestPriority = getCompetitionPriority(best.competition);
  for (let i = 1; i < chrono.length; i++) {
    const p = getCompetitionPriority(chrono[i].competition);
    if (p > bestPriority) {
      best = chrono[i];
      bestPriority = p;
    }
  }
  return best;
}
