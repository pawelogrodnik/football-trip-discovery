import type { DiscoverTrip } from './discover';
import {
  FIND_DEFAULT_RADIUS_KM,
  FIND_RADIUS_MAX_KM,
  FIND_RADIUS_MIN_KM,
  snapRadiusUp,
} from './distance';

export type FindLocation = {
  label: string;
  lat: number;
  lon: number;
};

export type FindSearchCriteria = {
  location: FindLocation | null;
  startDate: Date | null;
  endDate: Date | null;
  radiusKm: number;
};

export { FIND_DEFAULT_RADIUS_KM } from './distance';

export function toDateOnlyLocal(d: Date): string {
  const date = d instanceof Date ? d : new Date(d as unknown as string);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateOnlyLocal(s: string | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return null;
  }
  const d = new Date(`${s}T12:00:00.000`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clampRadius(v: number): number {
  if (!Number.isFinite(v)) {
    return FIND_DEFAULT_RADIUS_KM;
  }
  return Math.min(FIND_RADIUS_MAX_KM, Math.max(FIND_RADIUS_MIN_KM, Math.round(v)));
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function matchIdOfLoose(m: { _id?: unknown; id?: unknown }): string {
  return String((m as { _id?: unknown })._id ?? (m as { id?: unknown }).id ?? '');
}

function venueOf(m: {
  stadium?: { geo?: { latitude?: unknown; longitude?: unknown } };
}): { lat: number; lon: number } | null {
  const lat = m.stadium?.geo?.latitude;
  const lon = m.stadium?.geo?.longitude;
  return typeof lat === 'number' && typeof lon === 'number' ? { lat, lon } : null;
}

function isGenericDestinationLabel(label: string | undefined | null): boolean {
  if (!label) {
    return true;
  }
  const t = label.trim().toLowerCase();
  return t === '' || t === 'football trip';
}

/**
 * Deterministic search area for Discover -> Customize.
 * Centroid of trip venues + max distance + margin, snapped UP to a
 * supported shared distance option so no selected venue is excluded.
 * NOTE: this radius is NOT maxInterTravelKm — different metric.
 */
export function deriveFindContextFromTrip(trip: DiscoverTrip): {
  location: FindLocation;
  radiusKm: number;
  startDate: Date | null;
  endDate: Date | null;
  ids: string[];
} {
  const venues = trip.matches
    .map(venueOf)
    .filter((v): v is { lat: number; lon: number } => v !== null);
  const ids = Array.from(new Set(trip.matches.map(matchIdOfLoose).filter(Boolean)));

  const startDate = trip.tripStartDate ? parseDateOnlyLocal(trip.tripStartDate) : null;
  const endDate = trip.tripEndDate ? parseDateOnlyLocal(trip.tripEndDate) : null;

  const fallbackLocation: FindLocation = {
    label: isGenericDestinationLabel(trip.destinationLabel) ? 'Trip area' : trip.destinationLabel,
    lat: venues.length > 0 ? venues[0].lat : 0,
    lon: venues.length > 0 ? venues[0].lon : 0,
  };

  if (venues.length === 0) {
    return {
      location: fallbackLocation,
      radiusKm: FIND_DEFAULT_RADIUS_KM,
      startDate,
      endDate,
      ids,
    };
  }

  const lat = venues.reduce((s, v) => s + v.lat, 0) / venues.length;
  const lon = venues.reduce((s, v) => s + v.lon, 0) / venues.length;
  const maxDist = Math.max(0, ...venues.map((v) => haversineKm(lat, lon, v.lat, v.lon)));
  // Required radius from venue geography, snapped UP to a supported option
  // so no selected venue is ever excluded.
  const radiusKm = snapRadiusUp(Math.ceil((maxDist + 15) / 10) * 10);
  const label = isGenericDestinationLabel(trip.destinationLabel)
    ? 'Trip area'
    : trip.destinationLabel;

  return { location: { label, lat, lon }, radiusKm, startDate, endDate, ids };
}

export type FindUrlOptions = {
  mode?: 'customize';
};

/** Canonical final/shareable trip route. Legacy `/matches` redirects here. */
export const TRIP_PATH = '/trip';
/** Legacy trip route — kept working via redirect, never generated for new trips. */
export const LEGACY_MATCHES_PATH = '/matches';

export function buildFindUrl(
  criteria: Pick<FindSearchCriteria, 'location' | 'startDate' | 'endDate' | 'radiusKm'>,
  selectedIds: string[] = [],
  options: FindUrlOptions = {}
): string {
  const params = new URLSearchParams();
  if (options.mode) {
    params.set('mode', options.mode);
  }
  if (criteria.location) {
    params.set('lat', String(criteria.location.lat));
    params.set('lon', String(criteria.location.lon));
    if (criteria.location.label) {
      params.set('label', criteria.location.label);
    }
  }
  params.set('radius', String(clampRadius(criteria.radiusKm)));
  if (criteria.startDate) {
    params.set('startDate', toDateOnlyLocal(criteria.startDate));
  }
  if (criteria.endDate) {
    params.set('endDate', toDateOnlyLocal(criteria.endDate));
  }
  const uniqueIds = Array.from(new Set(selectedIds.map(String).filter(Boolean)));
  if (uniqueIds.length > 0) {
    params.set('ids', uniqueIds.join(','));
  }
  const qs = params.toString();
  return qs ? `/find?${qs}` : '/find';
}

export function buildTripUrl(
  criteria: Pick<FindSearchCriteria, 'location' | 'startDate' | 'endDate' | 'radiusKm'>,
  selectedIds: string[]
): string {
  const params = new URLSearchParams();
  const uniqueIds = Array.from(new Set(selectedIds.map(String).filter(Boolean)));
  params.set('ids', uniqueIds.join(','));
  if (criteria.location) {
    params.set('lat', String(criteria.location.lat));
    params.set('lon', String(criteria.location.lon));
    if (criteria.location.label) {
      params.set('label', criteria.location.label);
    }
  }
  params.set('radius', String(clampRadius(criteria.radiusKm)));
  if (criteria.startDate) {
    params.set('startDate', toDateOnlyLocal(criteria.startDate));
  }
  if (criteria.endDate) {
    params.set('endDate', toDateOnlyLocal(criteria.endDate));
  }
  return `${TRIP_PATH}?${params.toString()}`;
}

export type ParsedFindParams = {
  mode: string | null;
  location: FindLocation | null;
  radiusKm: number;
  startDate: Date | null;
  endDate: Date | null;
  ids: string[];
};

export function parseFindSearchParams(searchParams: URLSearchParams): ParsedFindParams {
  const mode = searchParams.get('mode');
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const label = searchParams.get('label') ?? '';
  const latNum = lat !== null ? Number(lat) : NaN;
  const lonNum = lon !== null ? Number(lon) : NaN;
  const location =
    Number.isFinite(latNum) && Number.isFinite(lonNum)
      ? { label: label || 'Trip area', lat: latNum, lon: lonNum }
      : null;
  const radiusRaw = searchParams.get('radius');
  const radiusKm =
    radiusRaw !== null && Number.isFinite(Number(radiusRaw))
      ? clampRadius(Number(radiusRaw))
      : FIND_DEFAULT_RADIUS_KM;
  const ids = Array.from(
    new Set(
      [...searchParams.getAll('ids'), ...searchParams.getAll('id')]
        .flatMap((e) => e.split(','))
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
  return {
    mode,
    location,
    radiusKm,
    startDate: parseDateOnlyLocal(searchParams.get('startDate')),
    endDate: parseDateOnlyLocal(searchParams.get('endDate')),
    ids,
  };
}

export function isCompleteFindCriteria(
  c: Pick<FindSearchCriteria, 'location' | 'startDate' | 'endDate'>
): boolean {
  return (
    c.location !== null &&
    typeof c.location.lat === 'number' &&
    typeof c.location.lon === 'number' &&
    c.startDate !== null &&
    c.endDate !== null
  );
}

/**
 * Fallback edit context for old /matches links (ids only):
 * derive dates from matches, centroid + radius from venues.
 */
export function deriveFindContextFromMatches(matches: Array<Record<string, unknown>>): {
  location: FindLocation | null;
  radiusKm: number;
  startDate: Date | null;
  endDate: Date | null;
} {
  const venues = (
    matches as Array<{ stadium?: { geo?: { latitude?: unknown; longitude?: unknown } } }>
  )
    .map(venueOf)
    .filter((v): v is { lat: number; lon: number } => v !== null);
  const times = (
    matches as Array<{ date?: { dateTime?: string; date?: string }; utcDate?: string }>
  )
    .map((m) => {
      const iso = m.date?.dateTime ?? m.utcDate ?? m.date?.date;
      if (!iso) {
        return null;
      }
      const d = new Date(iso.length === 10 ? `${iso}T12:00:00.000Z` : iso);
      return Number.isNaN(d.getTime()) ? null : d;
    })
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const startDate = times.length > 0 ? times[0] : null;
  const endDate = times.length > 0 ? times[times.length - 1] : null;

  if (venues.length === 0) {
    return { location: null, radiusKm: FIND_DEFAULT_RADIUS_KM, startDate, endDate };
  }
  const lat = venues.reduce((s, v) => s + v.lat, 0) / venues.length;
  const lon = venues.reduce((s, v) => s + v.lon, 0) / venues.length;
  const maxDist = Math.max(0, ...venues.map((v) => haversineKm(lat, lon, v.lat, v.lon)));
  return {
    location: { label: 'Trip area', lat, lon },
    radiusKm: snapRadiusUp(Math.ceil((maxDist + 15) / 10) * 10),
    startDate,
    endDate,
  };
}
