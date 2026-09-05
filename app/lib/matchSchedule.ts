/**
 * First-class schedule uncertainty (issue #9).
 *
 * Core app consumes normalized `MatchSchedule` metadata only.
 * Source-specific human strings (e.g. 90minut "22–23 Oct") must be parsed
 * in scraper/ingestion — never in Discover/Find/Trip runtime.
 *
 * Three certainty levels:
 * - confirmed:      exact date + kickoff
 * - date-confirmed: exact calendar day, kickoff TBC
 * - date-window:    date range / weekend, day + kickoff TBC
 */

export type MatchSchedule =
  | { status: 'confirmed'; dateTime: string }
  | { status: 'date-confirmed'; date: string }
  | { status: 'date-window'; startDate: string; endDate: string };

export type ScheduleStatus = MatchSchedule['status'];

type ScheduleLike = {
  schedule?: unknown;
  date?: {
    dateTime?: string | null;
    date?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  } | null;
  utcDate?: string | null;
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidMs(iso: string): boolean {
  return !Number.isNaN(Date.parse(iso));
}

function asTrimmed(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function parseScheduleObject(raw: unknown): MatchSchedule | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const s = raw as Record<string, unknown>;
  const status = s.status;
  if (status === 'confirmed') {
    const dateTime = asTrimmed(s.dateTime);
    return dateTime && isValidMs(dateTime) ? { status: 'confirmed', dateTime } : null;
  }
  if (status === 'date-confirmed') {
    const date = asTrimmed(s.date);
    return DATE_ONLY_RE.test(date) ? { status: 'date-confirmed', date } : null;
  }
  if (status === 'date-window') {
    const startDate = asTrimmed(s.startDate);
    const endDate = asTrimmed(s.endDate);
    if (!DATE_ONLY_RE.test(startDate) || !DATE_ONLY_RE.test(endDate)) {
      return null;
    }
    return startDate <= endDate
      ? { status: 'date-window', startDate, endDate }
      : { status: 'date-window', startDate: endDate, endDate: startDate };
  }
  return null;
}

/**
 * Normalize any fixture-ish record to a MatchSchedule.
 * Prefers explicit `schedule`, falls back to legacy `date.*` / `utcDate`.
 * Never invents precision: a window stays a window, a day stays a day.
 */
export function getFixtureSchedule(match: ScheduleLike | null | undefined): MatchSchedule | null {
  if (!match || typeof match !== 'object') {
    return null;
  }
  const explicit = parseScheduleObject((match as { schedule?: unknown }).schedule);
  if (explicit) {
    return explicit;
  }
  const date = match.date;
  const windowStart = date ? asTrimmed(date.startDate) : '';
  const windowEnd = date ? asTrimmed(date.endDate) : '';
  if (DATE_ONLY_RE.test(windowStart) && DATE_ONLY_RE.test(windowEnd)) {
    return windowStart <= windowEnd
      ? { status: 'date-window', startDate: windowStart, endDate: windowEnd }
      : { status: 'date-window', startDate: windowEnd, endDate: windowStart };
  }
  const exact = asTrimmed(date?.dateTime) || asTrimmed(match.utcDate);
  if (exact && /^\d{4}-\d{2}-\d{2}/.test(exact) && isValidMs(exact)) {
    return { status: 'confirmed', dateTime: exact };
  }
  const day = asTrimmed(date?.date);
  // Strict calendar day only. A full ISO datetime in `date.date` (legacy
  // football-data shape) is an exact kickoff, not a date-only fixture.
  if (DATE_ONLY_RE.test(day)) {
    return { status: 'date-confirmed', date: day };
  }
  if (day && /^\d{4}-\d{2}-\d{2}/.test(day) && isValidMs(day)) {
    return { status: 'confirmed', dateTime: day };
  }
  return null;
}

export type ScheduleWindow = { startMs: number; endMs: number };

const DAY_MS = 24 * 3600 * 1000;

function dayBoundsUTC(dateOnly: string): ScheduleWindow | null {
  if (!DATE_ONLY_RE.test(dateOnly)) {
    return null;
  }
  const startMs = Date.parse(`${dateOnly}T00:00:00.000Z`);
  if (Number.isNaN(startMs)) {
    return null;
  }
  return { startMs, endMs: startMs + DAY_MS - 1 };
}

/** Inclusive schedule window of a fixture in epoch ms. */
export function getFixtureScheduleWindow(
  match: ScheduleLike | null | undefined
): ScheduleWindow | null {
  const schedule = getFixtureSchedule(match);
  if (!schedule) {
    return null;
  }
  if (schedule.status === 'confirmed') {
    const t = Date.parse(schedule.dateTime);
    return Number.isNaN(t) ? null : { startMs: t, endMs: t };
  }
  if (schedule.status === 'date-confirmed') {
    return dayBoundsUTC(schedule.date);
  }
  const start = dayBoundsUTC(schedule.startDate);
  const end = dayBoundsUTC(schedule.endDate);
  if (!start || !end) {
    return null;
  }
  return { startMs: start.startMs, endMs: end.endMs };
}

/**
 * Fixture schedule window intersects a search window.
 * Search bounds are inclusive calendar days (YYYY-MM-DD).
 */
export function scheduleIntersectsRange(
  match: ScheduleLike | null | undefined,
  searchStartDateOnly: string,
  searchEndDateOnly: string
): boolean {
  const fixture = getFixtureScheduleWindow(match);
  const searchStart = dayBoundsUTC(searchStartDateOnly);
  const searchEnd = dayBoundsUTC(searchEndDateOnly);
  if (!fixture || !searchStart || !searchEnd) {
    return false;
  }
  return fixture.startMs <= searchEnd.endMs && fixture.endMs >= searchStart.startMs;
}

export function isScheduleConfirmed(match: ScheduleLike | null | undefined): boolean {
  return getFixtureSchedule(match)?.status === 'confirmed';
}

export function isScheduleTbc(match: ScheduleLike | null | undefined): boolean {
  const s = getFixtureSchedule(match)?.status;
  return s === 'date-confirmed' || s === 'date-window';
}

export function isDateWindowSchedule(match: ScheduleLike | null | undefined): boolean {
  return getFixtureSchedule(match)?.status === 'date-window';
}

export type ScheduleDisplay = {
  status: ScheduleStatus;
  /** Inclusive calendar-day bounds for display. */
  startDateOnly: string;
  endDateOnly: string;
  /** Exact kickoff ISO for confirmed fixtures. */
  dateTime?: string;
};

/** Display bounds derived from normalized schedule (no fake precision). */
export function scheduleDisplayOf(match: ScheduleLike | null | undefined): ScheduleDisplay | null {
  const schedule = getFixtureSchedule(match);
  if (!schedule) {
    return null;
  }
  if (schedule.status === 'confirmed') {
    const day = new Date(schedule.dateTime);
    if (Number.isNaN(day.getTime())) {
      return null;
    }
    const only = day.toISOString().slice(0, 10);
    return {
      status: 'confirmed',
      startDateOnly: only,
      endDateOnly: only,
      dateTime: schedule.dateTime,
    };
  }
  if (schedule.status === 'date-confirmed') {
    return { status: 'date-confirmed', startDateOnly: schedule.date, endDateOnly: schedule.date };
  }
  return {
    status: 'date-window',
    startDateOnly: schedule.startDate,
    endDateOnly: schedule.endDate,
  };
}

/**
 * Shared user-facing certainty count (issue #9 §2D).
 * confirmed: schedule.status === 'confirmed' (exact kickoff known).
 * tbc:       date-confirmed (day known, kickoff TBC) or date-window.
 * Fixtures without any schedule info count as confirmed (legacy behavior
 * for pre-schedule rows); every flow must use this helper instead of
 * `trip.matchCount` as the confirmed value.
 */
export function scheduleCertaintyCounts<T extends ScheduleLike>(
  matches: T[] | null | undefined
): { confirmed: number; tbc: number } {
  let confirmed = 0;
  let tbc = 0;
  for (const m of matches ?? []) {
    const status = getFixtureSchedule(m)?.status;
    if (status === 'date-confirmed' || status === 'date-window') {
      tbc += 1;
    } else {
      confirmed += 1;
    }
  }
  return { confirmed, tbc };
}

type GeoLike = {
  stadium?: {
    geo?: { latitude?: unknown; longitude?: unknown } | null;
  } | null;
};

/**
 * Central venue-geo eligibility (issue #9 geo clarification).
 * A fixture is a geographic opportunity only with usable stadium
 * coordinates. Never fall back to 0,0 and never invent coordinates.
 */
export function hasValidVenueGeo(match: GeoLike | null | undefined): boolean {
  const lat = match?.stadium?.geo?.latitude;
  const lon = match?.stadium?.geo?.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return false;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return false;
  }
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}
