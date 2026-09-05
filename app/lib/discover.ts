import {
  getCompetitionPriority,
  getCompetitionTier,
  isUefaCompetition,
} from './competitionPriority';
import {
  getFixtureSchedule,
  hasValidVenueGeo,
  scheduleCertaintyCounts,
  scheduleIntersectsRange,
} from './matchSchedule';
import { haversineKm, isWindowOnlyMatch, suggestTrips, Trip, TripMatch } from './tripOptimizer';

export type DiscoverCategory = 'top' | 'uefa' | 'lower' | 'most' | 'easy';
export type DiscoverDestinationMode = 'anywhere' | 'around-city';

export type DiscoverSearchCriteria = {
  startDate: Date | null;
  endDate: Date | null;
  tripLengthsDays: number[];
  leagues: string[];
  maxInterTravelKm: number;
  destination:
    | { type: 'anywhere' }
    | {
        type: 'around-city';
        location: { label: string; lat: number; lon: number };
        radiusKm: number;
      };
};

export type DiscoverTripMeta = {
  tripStartDate: string | null; // YYYY-MM-DD
  tripEndDate: string | null; // YYYY-MM-DD
  tripLengthDays: number;
  uefaMatchCount: number;
  maxLegKm: number;
  destinationLabel: string;
  /** Attached date-window opportunities (never guaranteed slots). */
  tbcCount?: number;
  /** Schedule-confirmed fixtures inside the itinerary (excludes date-confirmed). */
  confirmedCount?: number;
};

export type DiscoverTrip = Trip & DiscoverTripMeta;

export const DISCOVER_MIN_TRIP_DAYS = 2;
export const DISCOVER_MAX_TRIP_DAYS = 5;
export const DISCOVER_DEFAULT_TRIP_LENGTHS = [3, 4];

// ---------- date-only helpers (calendar-day semantics, UTC) ----------

export function toDateOnlyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateOnlyUTC(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function addDaysDateOnly(s: string, days: number): string {
  const d = parseDateOnlyUTC(s);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateOnlyUTC(d);
}

/** Inclusive calendar-day length: Sep16–Sep19 => 4. */
export function calendarDaysInclusive(startDateOnly: string, endDateOnly: string): number {
  const ms = parseDateOnlyUTC(endDateOnly).getTime() - parseDateOnlyUTC(startDateOnly).getTime();
  return Math.round(ms / (24 * 3600 * 1000)) + 1;
}

export function matchDateOnlyUTC(m: TripMatch): string | null {
  const schedule = getFixtureSchedule(m as never);
  if (schedule?.status === 'confirmed') {
    const d = new Date(schedule.dateTime);
    if (Number.isNaN(d.getTime())) {
      return null;
    }
    return toDateOnlyUTC(d);
  }
  if (schedule?.status === 'date-confirmed') {
    return schedule.date;
  }
  if (schedule?.status === 'date-window') {
    return schedule.startDate;
  }
  const iso = m.date?.dateTime || m.date?.date || null;
  if (!iso) {
    return null;
  }
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00.000Z` : iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return toDateOnlyUTC(d);
}

export type RollingWindow = { windowStart: string; windowEnd: string; tripLengthDays: number };

/** Generate rolling inclusive windows for one duration inside [availabilityStart, availabilityEnd]. */
export function rollingWindowsForDuration(
  availabilityStart: string,
  availabilityEnd: string,
  tripLengthDays: number
): RollingWindow[] {
  const totalDays = calendarDaysInclusive(availabilityStart, availabilityEnd);
  if (tripLengthDays < 1 || tripLengthDays > totalDays) {
    return [];
  }
  const count = totalDays - tripLengthDays + 1;
  const out: RollingWindow[] = [];
  for (let i = 0; i < count; i++) {
    const ws = addDaysDateOnly(availabilityStart, i);
    const we = addDaysDateOnly(ws, tripLengthDays - 1);
    out.push({ windowStart: ws, windowEnd: we, tripLengthDays });
  }
  return out;
}

export function rollingWindows(
  availabilityStart: string,
  availabilityEnd: string,
  durations: number[]
): RollingWindow[] {
  const out: RollingWindow[] = [];
  for (const d of durations) {
    out.push(...rollingWindowsForDuration(availabilityStart, availabilityEnd, d));
  }
  return out;
}

export function validateTripLengthsDays(
  value: unknown
): { ok: true; value: number[] } | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: 'tripLengthsDays must be a non-empty array' };
  }
  const nums: number[] = [];
  for (const v of value) {
    if (typeof v !== 'number' || !Number.isInteger(v)) {
      return { ok: false, error: 'tripLengthsDays must contain integers' };
    }
    if (v < DISCOVER_MIN_TRIP_DAYS || v > DISCOVER_MAX_TRIP_DAYS) {
      return {
        ok: false,
        error: `tripLengthsDays values must be ${DISCOVER_MIN_TRIP_DAYS}-${DISCOVER_MAX_TRIP_DAYS}`,
      };
    }
    if (!nums.includes(v)) {
      nums.push(v);
    }
  }
  nums.sort((a, b) => a - b);
  return { ok: true, value: nums };
}

// ---------- trip metadata ----------

export function isUefaMatch(m: TripMatch): boolean {
  const comp = m.competition ?? (m as unknown as { league?: string }).league ?? '';
  return isUefaCompetition(comp);
}

export function uefaCount(trip: Pick<Trip, 'matches'>): number {
  return trip.matches.filter(isUefaMatch).length;
}

export function maxLegKm(trip: Pick<Trip, 'legs'>): number {
  if (!trip.legs || trip.legs.length === 0) {
    return 0;
  }
  return Math.max(...trip.legs.map((l) => l.km));
}

export function tripDates(trip: Pick<Trip, 'matches'>): {
  start: string | null;
  end: string | null;
  lengthDays: number;
} {
  const dates = trip.matches
    .map(matchDateOnlyUTC)
    .filter((d): d is string => d !== null)
    .sort();
  if (dates.length === 0) {
    return { start: null, end: null, lengthDays: 0 };
  }
  const start = dates[0];
  const end = dates[dates.length - 1];
  return { start, end, lengthDays: calendarDaysInclusive(start, end) };
}

type StadiumLike = {
  city?: string | null;
  venue?: string | null;
  name?: string | null;
  address?: string | null;
  geo?: { latitude?: number; longitude?: number; name?: string | null } | null;
};

/** Frequency-based destination label from stadium.city. Never parses team names. */
export function getTripDestinationLabel(trip: {
  matches: Array<{ stadium?: StadiumLike }>;
}): string {
  const counts = new Map<string, number>();
  for (const m of trip.matches) {
    const city = (m.stadium?.city ?? '').trim();
    if (!city) {
      continue;
    }
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  if (counts.size === 0) {
    // Last-resort: reliable venue locality is unavailable -> generic label
    return 'Football trip';
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const total = trip.matches.length;
  const [topCity, topCount] = sorted[0];
  if (sorted.length === 1 || topCount / Math.max(total, 1) >= 0.6) {
    return topCity;
  }
  // Two meaningful cities
  const second = sorted[1][0];
  return `${topCity} & ${second}`;
}

export function enrichTrip(trip: Trip & Partial<DiscoverTripMeta>): DiscoverTrip {
  const { start, end, lengthDays } = tripDates(trip);
  const certainty = scheduleCertaintyCounts(trip.matches as never);
  // Opportunity-only candidates carry their rolling window explicitly;
  // tripDates of an empty itinerary yields null and must not erase it.
  const labelSource = trip.matches.length > 0 ? trip.matches : (trip.tbcMatches ?? trip.matches);
  return {
    ...trip,
    tripStartDate: start ?? trip.tripStartDate ?? null,
    tripEndDate: end ?? trip.tripEndDate ?? null,
    tripLengthDays: lengthDays > 0 ? lengthDays : (trip.tripLengthDays ?? 0),
    uefaMatchCount: uefaCount(trip),
    maxLegKm: maxLegKm(trip),
    tbcCount: certainty.tbc + (trip.tbcMatches?.length ?? 0),
    confirmedCount: certainty.confirmed,
    destinationLabel: getTripDestinationLabel({
      matches: labelSource as Array<{ stadium?: StadiumLike }>,
    }),
  };
}

// ---------- candidate generation ----------

export type DiscoverGenOpts = {
  maxInterTravelKm: number;
  bufferMinutes?: number;
  startLocation?: { lat: number; lon: number } | null;
  perWindowLimit?: number;
  maxCandidates?: number;
};

function matchesInWindow(matches: TripMatch[], ws: string, we: string): TripMatch[] {
  return matches.filter((m) => {
    // Overlap semantics: a date-window fixture belongs to every search
    // window it intersects. Rows without a schedule keep the legacy
    // point-in-window check.
    if (getFixtureSchedule(m as never)) {
      return scheduleIntersectsRange(m as never, ws, we);
    }
    const iso = m.date?.dateTime || (m.date?.date ? `${m.date.date}T00:00:00.000Z` : null);
    if (!iso) {
      return false;
    }
    const t = Date.parse(iso);
    if (Number.isNaN(t)) {
      return false;
    }
    const startMs = parseDateOnlyUTC(ws).getTime();
    const endMs = parseDateOnlyUTC(we).getTime() + 24 * 3600 * 1000 - 1;
    return t >= startMs && t <= endMs;
  });
}

export function candidateKey(trip: Pick<Trip, 'matches' | 'tbcMatches'>): string {
  const confirmed = trip.matches.map((m) => String((m as { id?: string }).id ?? '')).join('|');
  if (confirmed) {
    return confirmed;
  }
  // Opportunity-only candidates dedupe by their TBC set instead.
  const tbc = (trip.tbcMatches ?? [])
    .map((m) => String((m as { id?: string }).id ?? ''))
    .sort()
    .join('|');
  return tbc ? `tbc:${tbc}` : '';
}

/** Dedupe candidates with identical ordered fixture sets; keep lower totalKm. */
export function dedupeTrips<T extends Pick<Trip, 'matches' | 'totalKm'>>(trips: T[]): T[] {
  const best = new Map<string, T>();
  for (const t of trips) {
    const key = candidateKey(t);
    if (!key) {
      continue;
    }
    const prev = best.get(key);
    if (!prev || t.totalKm < prev.totalKm) {
      best.set(key, t);
    }
  }
  return Array.from(best.values());
}

/**
 * Geographic relevance for mixed trips (issue #9 geo coherence).
 * A TBC opportunity attaches to an itinerary only when its venue is within
 * maxInterTravelKm of AT LEAST ONE itinerary venue — never centroid-only,
 * so a fixture near Bergamo stays valid on a Milan+Bergamo trip.
 * No chronological feasibility is claimed; this is relevance only.
 */
export function isTbcRelevantToItinerary(
  tbc: TripMatch,
  itinerary: TripMatch[],
  maxInterTravelKm: number
): boolean {
  return itinerary.some((m) => {
    const d = haversineKm(tbc, m);
    return d !== null && d <= maxInterTravelKm;
  });
}

/**
 * Partition geocoded TBC fixtures into coherent geographic clusters.
 * Connected components over haversineKm <= maxInterTravelKm edges, so
 * chains (A-B, B-C near; A-C far) still form one trip area.
 * No heavyweight dependency; union-find over the pool.
 */
export function clusterTbcByGeo(pool: TripMatch[], maxInterTravelKm: number): TripMatch[][] {
  const n = pool.length;
  const parent = pool.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversineKm(pool[i], pool[j]);
      if (d !== null && d <= maxInterTravelKm) {
        union(i, j);
      }
    }
  }
  const groups = new Map<number, TripMatch[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const group = groups.get(root);
    if (group) {
      group.push(pool[i]);
    } else {
      groups.set(root, [pool[i]]);
    }
  }
  // Deterministic order: largest cluster first, then by first fixture id.
  return Array.from(groups.values()).sort(
    (a, b) =>
      b.length - a.length ||
      String((a[0] as { id?: string }).id ?? '').localeCompare(
        String((b[0] as { id?: string }).id ?? '')
      )
  );
}
/**
 * Selected-trip map sources (single source of truth for Discover map
 * adapters and their regression tests).
 * - markers: itinerary + geocoded TBC opportunities (TBC-only: just TBC)
 * - route: genuinely routeable confirmed fixtures only, never TBC
 * - hasItinerary: false for opportunity-only candidates (hide route metrics)
 */
export function tripMapSources(trip: Pick<Trip, 'matches' | 'tbcMatches'>): {
  markers: TripMatch[];
  route: TripMatch[];
  selectedIds: string[];
  hasItinerary: boolean;
} {
  const tbc = ((trip.tbcMatches ?? []) as TripMatch[]).filter((m) => hasValidVenueGeo(m));
  const markers = [...(trip.matches as TripMatch[]), ...tbc];
  const route = (trip.matches as TripMatch[]).filter(
    (m) => getFixtureSchedule(m as never)?.status === 'confirmed'
  );
  return {
    markers,
    route,
    selectedIds: markers.map((m) => String((m as { id?: string }).id ?? '').trim()).filter(Boolean),
    hasItinerary: trip.matches.length > 0,
  };
}

/**
 * Standalone TBC opportunity candidate for one geographic cluster.
 * No itinerary, no route, no legs, no fabricated km — the cluster IS
 * the candidate (destination, map, Customize all derive from it).
 */
export function buildTbcOpportunityCandidate(
  cluster: TripMatch[],
  w: RollingWindow,
  clusterIdx: number
): Trip & Partial<DiscoverTripMeta> {
  return {
    id: `discover_opportunity_${w.windowStart}_${w.windowEnd}_${clusterIdx}`,
    matches: [],
    tbcMatches: [...cluster],
    totalKm: 0,
    matchCount: 0,
    legs: [],
    tripStartDate: w.windowStart,
    tripEndDate: w.windowEnd,
    tripLengthDays: w.tripLengthDays,
  };
}

/** Logical TBC identity for used-set tracking (same raw-id basis as candidateKey). */
function tbcIdOf(m: TripMatch): string {
  return String((m as { id?: string }).id ?? '').trim();
}

/**
 * Higher-level Discover candidate generator.
 * Loads once (caller filters availability), then evaluates rolling windows
 * independently so alternatives MAY share fixtures.
 */
export function suggestDiscoverTrips(
  availabilityMatches: TripMatch[],
  availabilityStart: string,
  availabilityEnd: string,
  durations: number[],
  opts: DiscoverGenOpts
): DiscoverTrip[] {
  const windows = rollingWindows(availabilityStart, availabilityEnd, durations);
  const perWindowLimit = opts.perWindowLimit ?? 2;
  const collected: Trip[] = [];
  for (const w of windows) {
    const inWindow = matchesInWindow(availabilityMatches, w.windowStart, w.windowEnd);
    if (inWindow.length === 0) {
      continue;
    }
    const schedulable = inWindow.filter((m) => !isWindowOnlyMatch(m));
    // TBC opportunities REQUIRE usable venue geo: without coordinates a
    // window fixture cannot prove radius membership, map placement, or
    // destination relevance. Never fall back to 0,0.
    const tbcPool = inWindow.filter((m) => isWindowOnlyMatch(m) && hasValidVenueGeo(m));
    const maxHop = opts.maxInterTravelKm;

    // Phase 1: normal itinerary candidates with geographically relevant
    // TBC attached (rolling window for days, itinerary venues for place).
    const usedTbcIds = new Set<string>();
    if (schedulable.length > 0) {
      const found = suggestTrips(schedulable, {
        maxInterTravelKm: opts.maxInterTravelKm,
        bufferMinutes: opts.bufferMinutes ?? 30,
        startLocation: opts.startLocation ?? null,
        limit: perWindowLimit,
      });
      // Guard: never emit a trip longer (calendar days) than the window duration
      for (const t of found) {
        const { lengthDays } = tripDates(t);
        if (lengthDays > w.tripLengthDays) {
          continue;
        }
        const tripIds = new Set(t.matches.map((m) => tbcIdOf(m)));
        t.tbcMatches = tbcPool.filter(
          (m) =>
            !tripIds.has(tbcIdOf(m)) &&
            scheduleIntersectsRange(m as never, w.windowStart, w.windowEnd) &&
            isTbcRelevantToItinerary(m, t.matches, maxHop)
        );
        for (const m of t.tbcMatches) {
          usedTbcIds.add(tbcIdOf(m));
        }
        collected.push(t);
      }
    }

    // Phase 2: leftover TBC inventory survives as standalone
    // geographically coherent clusters — never dropped merely because an
    // unrelated city has a confirmed fixture in the same window, and
    // never duplicated when already attached to a mixed candidate.
    const leftoverTbc = tbcPool.filter((m) => !usedTbcIds.has(tbcIdOf(m)));
    clusterTbcByGeo(leftoverTbc, maxHop).forEach((cluster, clusterIdx) => {
      collected.push(buildTbcOpportunityCandidate(cluster, w, clusterIdx));
    });
  }
  // Re-id deterministically after merge, then dedupe
  const reId = collected.map((t, i) => ({ ...t, id: `discover_${i}` }));
  const deduped = dedupeTrips(reId);
  const enriched = deduped.map(enrichTrip);
  const max = opts.maxCandidates ?? 20;
  return rankTopPicks(enriched).slice(0, max);
}

// ---------- ranking (client + server safe) ----------

function avgLegKm(t: Pick<Trip, 'totalKm' | 'legs'>): number {
  if (!t.legs || t.legs.length === 0) {
    return t.totalKm;
  }
  return t.totalKm / t.legs.length;
}

export function rankMostMatches<T extends Trip & Partial<DiscoverTripMeta>>(trips: T[]): T[] {
  // Itinerary size first, then schedule certainty: an exact-kickoff trip
  // outranks a same-size TBC-heavy one. Window opportunities never inflate
  // matchCount, so they cannot masquerade as guaranteed matches.
  const confirmedOf = (t: T) => t.confirmedCount ?? t.matchCount;
  return [...trips].sort(
    (a, b) =>
      b.matchCount - a.matchCount || confirmedOf(b) - confirmedOf(a) || a.totalKm - b.totalKm
  );
}

export function rankEuropeanNights<T extends Trip & Partial<DiscoverTripMeta>>(trips: T[]): T[] {
  const uefa = (t: T) => t.uefaMatchCount ?? uefaCount(t);
  return [...trips].sort(
    (a, b) =>
      uefa(b) - uefa(a) ||
      maxCompetitionPriority(b) - maxCompetitionPriority(a) ||
      b.matchCount - a.matchCount ||
      a.totalKm - b.totalKm
  );
}

/** Highest central competition priority present in the trip (0 when empty). */
export function maxCompetitionPriority(trip: Pick<Trip, 'matches'>): number {
  let best = 0;
  for (const m of trip.matches) {
    const p = getCompetitionPriority(m.competition);
    if (p > best) {
      best = p;
    }
  }
  return best;
}

/** Lower-tier TBC opportunities attached to the trip (uncertainty is the norm there). */
export function lowerTierTbcCount(trip: Pick<Trip, 'tbcMatches'>): number {
  // Only geocoded opportunities may boost geographic ranking.
  return (trip.tbcMatches ?? []).filter(
    (m) => hasValidVenueGeo(m) && getCompetitionTier(m.competition) === 4
  ).length;
}

/** Matches played in lower-tier competitions (central tier metadata). */
export function lowerTierMatchCount(trip: Pick<Trip, 'matches'>): number {
  return trip.matches.filter((m) => getCompetitionTier(m.competition) === 4).length;
}

export function lowerTierRatio(trip: Pick<Trip, 'matches'>): number {
  if (trip.matches.length === 0) {
    return 0;
  }
  return lowerTierMatchCount(trip) / trip.matches.length;
}

export function rankLowerLeagueGems<T extends Trip & Partial<DiscoverTripMeta>>(trips: T[]): T[] {
  // TBC lower-league opportunities contribute strongly: schedule uncertainty
  // is most common exactly in this category.
  const score = (t: T) => lowerTierMatchCount(t) * 2 + lowerTierTbcCount(t);
  const ratio = (t: T) => {
    const denom = t.matches.length + (t.tbcMatches?.length ?? 0);
    if (denom === 0) {
      return 0;
    }
    return (lowerTierMatchCount(t) + lowerTierTbcCount(t)) / denom;
  };
  return [...trips].sort(
    (a, b) =>
      score(b) - score(a) ||
      ratio(b) - ratio(a) ||
      b.matchCount - a.matchCount ||
      a.totalKm - b.totalKm
  );
}

export function rankEasyTrips<T extends Trip & Partial<DiscoverTripMeta>>(trips: T[]): T[] {
  const eligible = trips.filter((t) => t.matchCount >= 2);
  const rest = trips.filter((t) => t.matchCount < 2);
  eligible.sort((a, b) => avgLegKm(a) - avgLegKm(b) || b.matchCount - a.matchCount);
  return [...eligible, ...rest];
}

export function topPickScore(t: Trip & Partial<DiscoverTripMeta>): number {
  const uefa = t.uefaMatchCount ?? uefaCount(t);
  const len =
    t.tripLengthDays && t.tripLengthDays > 0 ? t.tripLengthDays : tripDates(t).lengthDays || 1;
  const density = t.matchCount / len;
  const maxLeg = t.maxLegKm ?? maxLegKm(t);
  // TBC opportunities add modest value, never full confirmed value.
  // Only geocoded opportunities count toward geographic ranking.
  const eligibleTbc = (t.tbcMatches ?? []).filter((m) => hasValidVenueGeo(m)).length;
  const tbcBonus = Math.min(t.tbcMatches ? eligibleTbc : (t.tbcCount ?? 0), 5) * 0.5;
  return t.matchCount * 4 + uefa * 3 + density * 2 + tbcBonus - t.totalKm / 150 - maxLeg / 200;
}

export function rankTopPicks<T extends Trip & Partial<DiscoverTripMeta>>(trips: T[]): T[] {
  return [...trips].sort((a, b) => topPickScore(b) - topPickScore(a) || a.totalKm - b.totalKm);
}

export function rankByCategory<T extends Trip & Partial<DiscoverTripMeta>>(
  trips: T[],
  category: DiscoverCategory
): T[] {
  switch (category) {
    case 'uefa':
      return rankEuropeanNights(trips);
    case 'lower':
      return rankLowerLeagueGems(trips);
    case 'most':
      return rankMostMatches(trips);
    case 'easy':
      return rankEasyTrips(trips);
    case 'top':
    default:
      return rankTopPicks(trips);
  }
}

// ---------- category definitions (core + contextual) ----------

/** Contextual categories need at least this many qualifying trips to be meaningful. */
export const MIN_CONTEXTUAL_TRIPS = 2;

function uefaTripCount<T extends Trip & Partial<DiscoverTripMeta>>(trips: T[]): number {
  return trips.filter((t) => (t.uefaMatchCount ?? uefaCount(t)) > 0).length;
}

function lowerTripCount<T extends Trip & Partial<DiscoverTripMeta>>(trips: T[]): number {
  // TBC-only opportunity candidates have no itinerary matches, but their
  // lower-league opportunities must still unlock the category.
  return trips.filter((t) => lowerTierMatchCount(t) + lowerTierTbcCount(t) > 0).length;
}

export type DiscoverCategoryDef = {
  id: DiscoverCategory;
  /** i18n key in the Discover namespace. */
  labelKey: string;
  /** Core categories always exist; contextual ones depend on the candidate pool. */
  core: boolean;
  isAvailable: <T extends Trip & Partial<DiscoverTripMeta>>(trips: T[]) => boolean;
  rank: <T extends Trip & Partial<DiscoverTripMeta>>(trips: T[]) => T[];
};

/** Display order: Top picks first, contextual next, generic rankings last. */
export const DISCOVER_CATEGORY_DEFS: DiscoverCategoryDef[] = [
  { id: 'top', labelKey: 'catTop', core: true, isAvailable: () => true, rank: rankTopPicks },
  {
    id: 'uefa',
    labelKey: 'catUefa',
    core: false,
    isAvailable: (trips) => uefaTripCount(trips) >= MIN_CONTEXTUAL_TRIPS,
    rank: rankEuropeanNights,
  },
  {
    id: 'lower',
    labelKey: 'catLower',
    core: false,
    isAvailable: (trips) => lowerTripCount(trips) >= MIN_CONTEXTUAL_TRIPS,
    rank: rankLowerLeagueGems,
  },
  { id: 'most', labelKey: 'catMost', core: true, isAvailable: () => true, rank: rankMostMatches },
  { id: 'easy', labelKey: 'catEasy', core: true, isAvailable: () => true, rank: rankEasyTrips },
];

/** Categories supported by the actual candidate pool (max 5, stable order). */
export function getAvailableCategories<T extends Trip & Partial<DiscoverTripMeta>>(
  trips: T[]
): DiscoverCategory[] {
  return DISCOVER_CATEGORY_DEFS.filter((d) => d.core || d.isAvailable(trips)).map((d) => d.id);
}

/** Fall back to Top picks when the selected category no longer exists. */
export function resolveCategory<T extends Trip & Partial<DiscoverTripMeta>>(
  trips: T[],
  selected: DiscoverCategory
): DiscoverCategory {
  return getAvailableCategories(trips).includes(selected) ? selected : 'top';
}

export { haversineKm };
