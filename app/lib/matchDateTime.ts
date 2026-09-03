/**
 * Kickoff normalization.
 *
 * Grassroots sources often publish only a matchday ("kolejka 4, 12-13 wrzesnia")
 * without an exact hour. Dropping those matches silently kills lower-league
 * visibility, while fabricating a precise hour would be dishonest.
 *
 * Middle ground: matches with a usable calendar day but no exact time enter
 * the pool with a neutral midday kickoff and `approximate: true`, so the UI
 * can mark them with "~" instead of presenting a guess as fact.
 */

export type MatchDateInput = {
  date?: string | null;
  dateTime?: string | null;
  time?: string | null;
  approximate?: boolean | null;
};

/** Neutral kickoff for date-only matches (UTC, midday). */
export const APPROXIMATE_KICKOFF_TIME = 'T12:00:00.000Z';

function parseMs(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export function normalizeMatchDateTime(
  date: MatchDateInput | null | undefined
): { dateTime: string; approximate: boolean } | null {
  if (!date) {
    return null;
  }
  const exact = date.dateTime || date.time || null;
  if (exact && parseMs(exact) !== null) {
    return { dateTime: exact, approximate: date.approximate ?? false };
  }
  const day = (date.date ?? '').trim();
  // Strict calendar day only. Lenient parsing (e.g. new Date("kolejka 4"))
  // hallucinates real dates out of round labels, so round-only info without
  // a resolved day stays out of the pool — that resolution belongs upstream.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return null;
  }
  return { dateTime: `${day}${APPROXIMATE_KICKOFF_TIME}`, approximate: true };
}
