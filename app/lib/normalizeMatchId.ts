import { makeMatchId } from 'lib/makeMatchId';

type MatchContext = {
  country?: string;
  league?: string;
};

type MatchRecord = Record<string, any> & {
  id?: string;
  _id?: string | number;
  _nativeId?: string | null;
};

/**
 * Canonical scope for UEFA fixtures. They are loaded through different paths
 * (Discover `EUROPE` loaders, `/api/matches` EUROPE group, `app/fixtures/EU/`
 * files) — all of them must normalize to this single scope or the same
 * physical fixture gets different app-level IDs per flow.
 */
export const EUROPE_MATCH_SCOPE = 'EUROPE';

/** Canonical scope for Polish regional fixtures (`POLAND-XX` vs `POLAND`). */
export const POLAND_MATCH_SCOPE = 'POLAND';

function stringify(value: unknown) {
  return typeof value === 'string'
    ? value
    : value !== undefined && value !== null
      ? String(value)
      : '';
}

/**
 * Collapse loading-path-dependent scopes to one canonical scope so a physical
 * fixture always hashes to the same normalized id:
 * - EU / EUROPE / UEFA -> EUROPE
 * - POLAND / POLAND-<region> -> POLAND
 * - everything else passes through untouched
 */
export function normalizeMatchScope(country?: string | null): string {
  const raw = (country ?? '').trim();
  if (!raw) {
    return '';
  }
  const upper = raw.toUpperCase();
  if (upper === 'EU' || upper === 'EUROPE' || upper === 'UEFA') {
    return EUROPE_MATCH_SCOPE;
  }
  if (upper === POLAND_MATCH_SCOPE || upper.startsWith(`${POLAND_MATCH_SCOPE}-`)) {
    return POLAND_MATCH_SCOPE;
  }
  return raw;
}

export function buildNormalizedMatchId(
  match: MatchRecord,
  context: MatchContext = {},
  options: { normalizeScope?: boolean } = {}
): string {
  const nativeId = stringify(match?._nativeId ?? match?._id ?? match?.id);
  const country =
    options.normalizeScope === false
      ? (context.country ?? '')
      : normalizeMatchScope(context.country);
  const derivedId = makeMatchId(match, country, context.league);

  if (derivedId && nativeId) {
    return derivedId === nativeId ? derivedId : `${derivedId}__${nativeId}`;
  }
  if (derivedId) {
    return derivedId;
  }
  return nativeId;
}

/**
 * Raw-scope variant of the normalized id (no scope collapsing). Registered as
 * an alias by /api/matches/by-ids so share URLs built before the scope
 * unification (e.g. `EU`-scoped or `POLAND-XX`-scoped ids) keep resolving.
 */
export function buildRawScopeMatchId(match: MatchRecord, context: MatchContext = {}): string {
  return buildNormalizedMatchId(match, context, { normalizeScope: false });
}

export function ensureMatchHasNormalizedId<T extends MatchRecord>(
  match: T,
  context: MatchContext = {}
): T {
  if (!match || typeof match !== 'object') {
    return match;
  }

  const normalizedId = buildNormalizedMatchId(match, context);
  if (normalizedId) {
    if (typeof match._nativeId === 'undefined') {
      match._nativeId = stringify(match?._id ?? match?.id) || null;
    }
    match.id = normalizedId;
  }

  return match;
}

export type MatchIdentity = {
  id?: unknown;
  _id?: unknown;
  _nativeId?: unknown;
};

/**
 * Single source of truth for app-level fixture identity. The normalized `id`
 * wins over provider/native `_id` — every server flow normalizes before
 * responding, so `id` is the canonical identity across Discover / Find /
 * Trip / map / URLs.
 */
export function getCanonicalMatchId(match: MatchIdentity | null | undefined): string {
  if (!match || typeof match !== 'object') {
    return '';
  }
  return String(match.id ?? match._id ?? '');
}

/**
 * All known id forms of a fixture that must resolve to its canonical id:
 * native `_id` / `_nativeId` plus the tail segment of `derived__native` ids.
 */
export function getMatchAliases(match: MatchIdentity | null | undefined): string[] {
  if (!match || typeof match !== 'object') {
    return [];
  }
  const canonical = getCanonicalMatchId(match);
  const candidates = [match._id, match._nativeId];
  const idStr = String(match.id ?? '');
  if (idStr.includes('__')) {
    candidates.push(idStr.split('__').pop());
  }
  const aliases: string[] = [];
  for (const candidate of candidates) {
    const s = String(candidate ?? '').trim();
    if (s && s !== canonical && !aliases.includes(s)) {
      aliases.push(s);
    }
  }
  return aliases;
}
