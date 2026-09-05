import { createHash } from 'crypto';

function cleanPart(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Canonical fixture identity (issues #8 + #9 narrow extension).
 *
 * Exact schedule precision is NOT part of the identity: a fixture moving
 * from `date-window` to `confirmed` keeps the same canonical id.
 * Stable inputs: scope, league, competition, season/stage/round, teams.
 * Provider/native ids stay aliases (see normalizeMatchId).
 */
export function makeMatchId(match: any, country?: string, league?: string) {
  const rawParts = [
    country,
    league,
    match?.competition?.code ?? match?.competition?.name,
    match?.season ?? match?.competition?.season,
    match?.stage,
    match?.matchday ?? match?.round,
    match?.homeTeam?.name,
    match?.awayTeam?.name,
  ]
    .map(cleanPart)
    .filter(Boolean);

  if (rawParts.length === 0) {
    return '';
  }

  return createHash('md5').update(rawParts.join('|')).digest('hex');
}

/**
 * Legacy schedule-based id (pre-#9 formula). Kept ONLY as a backward-compat
 * alias so share URLs / selected trips built before the identity change
 * keep resolving. Never use as canonical identity.
 */
export function buildLegacyScheduleMatchId(match: any, country?: string, league?: string) {
  const rawParts = [
    country,
    league,
    match?.competition?.code ?? match?.competition?.name,
    match?.homeTeam?.name,
    match?.awayTeam?.name,
    match?.date?.dateTime ?? match?.utcDate ?? match?.date?.date,
  ].filter(Boolean);

  if (rawParts.length === 0) {
    return '';
  }

  return createHash('md5').update(rawParts.join('|')).digest('hex');
}
