'use client';

import { getCanonicalMatchId, getMatchAliases } from '../../lib/normalizeMatchId';

export type LooseMatch = {
  _id?: unknown;
  id?: unknown;
  homeTeam?: { name?: string; crest?: string | null };
  awayTeam?: { name?: string; crest?: string | null };
  competition?: { name?: string };
  date?: { dateTime?: string | null; date?: string | null; approximate?: boolean | null };
  utcDate?: string | null;
  stadium?: {
    venue?: string | null;
    name?: string | null;
    address?: string | null;
    geo?: { latitude?: unknown; longitude?: unknown };
  };
  _distanceKm?: unknown;
  [key: string]: unknown;
};

export function matchIdOf(m: LooseMatch): string {
  return getCanonicalMatchId(m);
}

export function matchDateTimeOf(m: LooseMatch): string {
  const dt = m?.date?.dateTime ?? m?.utcDate ?? m?.date?.date ?? '';
  if (typeof dt !== 'string') {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) {
    return `${dt}T12:00:00.000Z`;
  }
  return dt;
}

export function isApproximateKickoff(m: LooseMatch): boolean {
  return m?.date?.approximate === true;
}

export function dayKeyOf(iso: string): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function sortMatchesChronologically<T extends LooseMatch>(matches: T[]): T[] {
  return [...matches].sort((a, b) => {
    const isoA = matchDateTimeOf(a);
    const isoB = matchDateTimeOf(b);
    const tA = isoA ? new Date(isoA).getTime() : 0;
    const tB = isoB ? new Date(isoB).getTime() : 0;
    if (tA !== tB) {
      return tA - tB;
    }
    const aKey = `${a?.homeTeam?.name ?? ''} vs ${a?.awayTeam?.name ?? ''}`;
    const bKey = `${b?.homeTeam?.name ?? ''} vs ${b?.awayTeam?.name ?? ''}`;
    return aKey.localeCompare(bKey);
  });
}

export type DayGroup<T extends LooseMatch = LooseMatch> = {
  dayKey: string;
  dateTime: string;
  matches: T[];
};
export function groupMatchesByDay<T extends LooseMatch>(matches: T[]): Array<DayGroup<T>> {
  const sorted = sortMatchesChronologically(matches);
  const groups = new Map<string, DayGroup<T>>();
  for (const m of sorted) {
    const iso = matchDateTimeOf(m);
    const key = dayKeyOf(iso);
    if (!key) {
      continue;
    }
    const existing = groups.get(key);
    if (existing) {
      existing.matches.push(m);
    } else {
      groups.set(key, { dayKey: key, dateTime: iso, matches: [m] });
    }
  }
  return Array.from(groups.values());
}

/**
 * Fixture identity for display dedupe: same teams + kickoff + competition +
 * venue is the same event even when data rows carry different ids
 * (e.g. normalized vs native id forms, or duplicated sync rows).
 */
export function fixtureSignatureOf(m: LooseMatch): string {
  const iso = matchDateTimeOf(m);
  const ts = iso ? new Date(iso).getTime() : NaN;
  const when = Number.isFinite(ts) ? String(ts) : iso || '?';
  const rawVenue =
    (m?.stadium?.venue as string | null) ||
    (m?.stadium?.name as string | null) ||
    m?.stadium?.address ||
    '?';
  const venue = rawVenue.trim().toLowerCase();
  const norm = (s: string | undefined | null) => (s ?? '?').trim().toLowerCase();
  return [
    norm(m?.homeTeam?.name),
    norm(m?.awayTeam?.name),
    when,
    norm(m?.competition?.name),
    venue,
  ].join(' | ');
}

/**
 * Reconcile a raw selected-id list against loaded matches. Every id that
 * matches a fixture (by canonical id or any alias, e.g. a Discover-issued or
 * native id form) resolves to the canonical id; unknown ids pass through
 * untouched so genuinely missing fixtures stay fetchable. Output is deduped,
 * so "Selected N" and the effective selected fixtures always agree.
 */
export function reconcileSelectedIds<T extends LooseMatch>(
  selectedIds: Array<string | number>,
  matches: T[]
): string[] {
  const aliasToCanonical = new Map<string, string>();
  for (const m of matches) {
    const canonical = matchIdOf(m);
    if (!canonical) {
      continue;
    }
    if (!aliasToCanonical.has(canonical)) {
      aliasToCanonical.set(canonical, canonical);
    }
    for (const alias of getMatchAliases(m)) {
      if (!aliasToCanonical.has(alias)) {
        aliasToCanonical.set(alias, canonical);
      }
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of selectedIds) {
    const key = String(raw);
    const canonical = aliasToCanonical.get(key) ?? key;
    if (!seen.has(canonical)) {
      seen.add(canonical);
      out.push(canonical);
    }
  }
  return out;
}

/**
 * Drop duplicate rows of the same fixture. First occurrence wins, order kept.
 * Matches by canonical id first, then by fixture signature (safety net for
 * same event under different id forms).
 */
export function dedupeMatches<T extends LooseMatch>(matches: T[]): T[] {
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  return matches.filter((m) => {
    const id = matchIdOf(m);
    if (id) {
      if (seenIds.has(id)) {
        return false;
      }
      seenIds.add(id);
    }
    const sig = fixtureSignatureOf(m);
    if (seenSignatures.has(sig)) {
      return false;
    }
    seenSignatures.add(sig);
    return true;
  });
}

/** Geographic distance for presentation only (never travel time). */
export function formatDistanceKmDisplay(raw: unknown): string | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    return null;
  }
  if (raw < 10 && raw % 1 !== 0 && raw < 1) {
    return `${Math.round(raw * 10) / 10} km`;
  }
  return `${Math.round(raw)} km`;
}

export type SelectedRange = {
  count: number;
  startISO: string | null;
  endISO: string | null;
  dayCount: number;
};

/** Derive preview range from SELECTED fixtures only (inclusive calendar days). */
export function selectedTripRange<T extends LooseMatch>(matches: T[]): SelectedRange {
  const times = matches
    .map((m) => {
      const iso = matchDateTimeOf(m);
      if (!iso) {
        return null;
      }
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? null : d;
    })
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  if (times.length === 0) {
    return { count: matches.length, startISO: null, endISO: null, dayCount: 0 };
  }
  const start = new Date(times[0]);
  start.setHours(0, 0, 0, 0);
  const end = new Date(times[times.length - 1]);
  end.setHours(0, 0, 0, 0);
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return {
    count: matches.length,
    startISO: times[0].toISOString(),
    endISO: times[times.length - 1].toISOString(),
    dayCount,
  };
}

/** Localized "MON, SEP 7" style group heading. Never hardcoded English. */
export function formatDayHeader(dateTime: string, locale: string): string {
  if (!dateTime) {
    return '';
  }
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return d
    .toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase();
}

/** Kickoff only (date lives in the group header). "~" prefix when approximate. */
export function formatKickoffTime(dateTime: string, locale: string, approximate: boolean): string {
  if (!dateTime) {
    return '';
  }
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return approximate ? `~${time}` : time;
}

/** Compact "Sep 7–10" range for header/footer summaries. */
export function formatShortDayRange(
  startISO: string | null,
  endISO: string | null,
  locale: string
): string {
  if (!startISO || !endISO) {
    return '';
  }
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return '';
  }
  const sameDay = dayKeyOf(startISO) === dayKeyOf(endISO);
  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  if (sameDay) {
    return fmt(s);
  }
  return `${fmt(s)}–${fmt(e)}`;
}
