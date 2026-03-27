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

function stringify(value: unknown) {
  return typeof value === 'string' ? value : value !== undefined && value !== null ? String(value) : '';
}

export function buildNormalizedMatchId(match: MatchRecord, context: MatchContext = {}): string {
  const nativeId = stringify(match?._nativeId ?? match?._id ?? match?.id);
  const derivedId = makeMatchId(match, context.country, context.league);

  if (derivedId && nativeId) {
    return derivedId === nativeId ? derivedId : `${derivedId}__${nativeId}`;
  }
  if (derivedId) {
    return derivedId;
  }
  return nativeId;
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
