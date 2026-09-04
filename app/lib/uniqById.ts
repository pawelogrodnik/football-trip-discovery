import { getCanonicalMatchId } from 'lib/normalizeMatchId';

export function uniqById(matches: any[]) {
  const seen = new Set<string>();
  return matches.filter((m) => {
    const id = getCanonicalMatchId(m);
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}
