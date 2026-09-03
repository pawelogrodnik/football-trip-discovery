import * as turf from '@turf/turf';
import { DEFAULT_INTER_TRAVEL_KM } from './distance';

export type TripMatch = {
  id: string;
  homeTeam: { name: string; crest?: string | null };
  awayTeam: { name: string; crest?: string | null };
  competition: { name: string; code?: string };
  date: { date?: string; dateTime?: string; time?: string; approximate?: boolean };
  stadium?: {
    city?: string | null;
    venue?: string | null;
    geo?: { latitude?: number; longitude?: number; name?: string | null };
    name?: string | null;
    address?: string | null;
  };
  country?: string;
  league?: string;
  _distanceKm?: number;
};

export type Leg = {
  fromIdx: number;
  toIdx: number;
  km: number;
  driveMinutes: number;
};

export type Trip = {
  id: string;
  matches: TripMatch[];
  totalKm: number;
  matchCount: number;
  legs: Leg[];
};

const DEFAULT_MATCH_MINUTES = 105; // 90 + 15

function getStartMs(m: TripMatch): number {
  const iso = m.date?.dateTime || (m.date?.date ? `${m.date.date}T00:00:00.000Z` : null);
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function getEndMs(m: TripMatch, bufferMinutes: number): number {
  return getStartMs(m) + (DEFAULT_MATCH_MINUTES + bufferMinutes) * 60 * 1000;
}

export function haversineKm(a: TripMatch, b: TripMatch): number | null {
  const lat1 = a.stadium?.geo?.latitude;
  const lon1 = a.stadium?.geo?.longitude;
  const lat2 = b.stadium?.geo?.latitude;
  const lon2 = b.stadium?.geo?.longitude;
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number'
  )
    return null;
  return turf.distance(turf.point([lon1, lat1]), turf.point([lon2, lat2]), { units: 'kilometers' });
}

export function distanceFromStart(
  match: TripMatch,
  start: { lat: number; lon: number }
): number | null {
  const lat = match.stadium?.geo?.latitude;
  const lon = match.stadium?.geo?.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  return turf.distance(turf.point([start.lon, start.lat]), turf.point([lon, lat]), {
    units: 'kilometers',
  });
}

/**
 * Find best non-overlapping trips (max count) with hop constraint.
 * Returns up to `limit` trips (k-best by removing used matches).
 */
export function suggestTrips(
  matches: TripMatch[],
  opts: {
    maxInterTravelKm: number;
    bufferMinutes?: number;
    startLocation?: { lat: number; lon: number } | null;
    limit?: number;
  }
): Trip[] {
  const buffer = opts.bufferMinutes ?? 30;
  const limit = opts.limit ?? 3;
  const maxHop = opts.maxInterTravelKm ?? DEFAULT_INTER_TRAVEL_KM;

  // Filter out matches without geo or date
  const withGeo = matches.filter((m) => {
    const lat = m.stadium?.geo?.latitude;
    const lon = m.stadium?.geo?.longitude;
    const hasGeo = typeof lat === 'number' && typeof lon === 'number';
    const hasTime = !!getStartMs(m);
    if (!hasGeo || !hasTime) return false;
    if (opts.startLocation) {
      const d = distanceFromStart(m, opts.startLocation);
      if (d !== null && d > maxHop) {
        // For startLocation, we allow any first match within maxHop, but subsequent hops also limited.
        // Keep it, DP will handle. So don't filter here strictly.
      }
    }
    return true;
  });

  if (withGeo.length === 0) return [];

  // Sort by start time
  const sorted = [...withGeo].sort((a, b) => getStartMs(a) - getStartMs(b));

  const n = sorted.length;
  // Precompute travel and prev
  const travel: number[][] = Array.from({ length: n }, () => Array(n).fill(Infinity));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversineKm(sorted[i], sorted[j]);
      travel[i][j] = d ?? Infinity;
      travel[j][i] = d ?? Infinity;
    }
  }

  // For startLocation, first match must be within maxHop from start
  function isReachableFromStart(idx: number): boolean {
    if (!opts.startLocation) return true;
    const d = distanceFromStart(sorted[idx], opts.startLocation);
    if (d === null) return false;
    return d <= maxHop;
  }

  const trips: Trip[] = [];
  const usedGlobal = new Set<number>();

  for (let k = 0; k < limit; k++) {
    const remainingIndices = sorted.map((_, i) => i).filter((i) => !usedGlobal.has(i));
    if (remainingIndices.length === 0) break;
    const filtered = remainingIndices.map((i) => ({ idx: i, match: sorted[i] }));
    const m = filtered.length;
    // dp[i] = longest valid trip ENDING exactly at filtered[i]
    const dp = new Array(m).fill(-Infinity);
    const prevIdx = new Array(m).fill(-1);

    for (let i = 0; i < m; i++) {
      const curIdx = filtered[i].idx;
      const reachable = isReachableFromStart(curIdx);
      // Can start new chain here if reachable
      if (reachable) {
        dp[i] = 1;
        prevIdx[i] = -1;
      }
      // Try to extend any previous chain
      for (let j = 0; j < i; j++) {
        if (dp[j] === -Infinity) continue;
        const prevCurIdx = filtered[j].idx;
        const endJ = getEndMs(sorted[prevCurIdx], buffer);
        const startI = getStartMs(sorted[curIdx]);
        if (endJ > startI) continue;
        const d = travel[prevCurIdx][curIdx];
        if (d > maxHop) continue;
        if (dp[j] + 1 > dp[i]) {
          dp[i] = dp[j] + 1;
          prevIdx[i] = j;
        }
      }
    }

    // Find best end (max dp)
    let bestEnd = -1;
    let bestVal = -Infinity;
    for (let j = 0; j < m; j++)
      if (dp[j] > bestVal) {
        bestVal = dp[j];
        bestEnd = j;
      }
    if (bestEnd === -1 || bestVal === -Infinity || bestVal < 1) break;
    const tripIndices: number[] = [];
    for (let cur = bestEnd; cur !== -1; cur = prevIdx[cur]) tripIndices.push(filtered[cur].idx);
    tripIndices.reverse();
    if (tripIndices.length === 0) break;

    // Build trip
    const tripMatches = tripIndices.map((idx) => sorted[idx]);
    let totalKm = 0;
    const legs: Leg[] = [];
    for (let t = 1; t < tripMatches.length; t++) {
      const d = haversineKm(tripMatches[t - 1], tripMatches[t]);
      if (d !== null && d !== Infinity) {
        totalKm += d;
        legs.push({
          fromIdx: t - 1,
          toIdx: t,
          km: Math.round(d * 10) / 10,
          driveMinutes: Math.round((d / 50) * 60),
        });
      }
    }
    if (opts.startLocation && tripMatches.length > 0) {
      const d0 = distanceFromStart(tripMatches[0], opts.startLocation);
      if (d0 !== null) totalKm += d0;
    }

    trips.push({
      id: `trip_${k}`,
      matches: tripMatches,
      totalKm: Math.round(totalKm * 10) / 10,
      matchCount: tripMatches.length,
      legs,
    });

    for (const idx of tripIndices) usedGlobal.add(idx);
    if (usedGlobal.size >= n) break;
  }

  // Sort trips by count desc, then totalKm asc
  trips.sort((a, b) => b.matchCount - a.matchCount || a.totalKm - b.totalKm);
  return trips;
}
