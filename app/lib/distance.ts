/**
 * Shared venue-to-venue distance metric for Discover trips.
 *
 * Values are straight-line geographic distances between venues —
 * NOT walking/driving/public-transport route distances.
 */
export const MIN_INTER_TRAVEL_KM = 5;
export const MAX_INTER_TRAVEL_KM = 300;
export const DEFAULT_INTER_TRAVEL_KM = 100;

export type DistanceOption = {
  value: number;
  /** i18n key in the Discover namespace describing compactness. */
  hintKey: string;
};

/**
 * Shared selectable distance scale (km) for BOTH product flows.
 * Semantics differ per flow — the scale is shared, the meaning is not:
 * - Discover `maxInterTravelKm`: maximum venue-to-venue distance in a trip.
 * - Find Matches `radiusKm`: radius around the destination/base location.
 */
export const FOOTBALL_DISTANCE_OPTIONS_KM = [5, 10, 25, 50, 100, 150, 250] as const;

const DISTANCE_HINT_KEYS: Record<number, string> = {
  5: 'distHint5',
  10: 'distHint10',
  25: 'distHint25',
  50: 'distHint50',
  100: 'distHint100',
  150: 'distHint150',
  250: 'distHint250',
};

export const DISTANCE_OPTIONS: DistanceOption[] = FOOTBALL_DISTANCE_OPTIONS_KM.map((value) => ({
  value,
  hintKey: DISTANCE_HINT_KEYS[value],
}));

/**
 * Validate a raw maxInterTravelKm value (e.g. from API body).
 * Returns the validated number or throws a RangeError/TypeError.
 */
export function parseMaxInterTravelKm(value: unknown): number {
  const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof num !== 'number' || Number.isNaN(num) || !Number.isFinite(num)) {
    throw new TypeError(`maxInterTravelKm must be ${MIN_INTER_TRAVEL_KM}-${MAX_INTER_TRAVEL_KM}`);
  }
  if (num < MIN_INTER_TRAVEL_KM || num > MAX_INTER_TRAVEL_KM) {
    throw new RangeError(`maxInterTravelKm must be ${MIN_INTER_TRAVEL_KM}-${MAX_INTER_TRAVEL_KM}`);
  }
  return num;
}

// ---------- Find Matches radius (shared scale, radius semantics) ----------

export const FIND_RADIUS_MIN_KM = 5;
export const FIND_RADIUS_MAX_KM = 1000;
export const FIND_DEFAULT_RADIUS_KM = 50;

/**
 * Validate a raw Find Matches radiusKm value.
 * Same 5 km minimum as the shared scale; custom larger values allowed
 * (e.g. a derived Customize radius above the largest chip).
 */
export function parseFindRadiusKm(value: unknown): number {
  const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof num !== 'number' || Number.isNaN(num) || !Number.isFinite(num)) {
    throw new TypeError(`radiusKm must be ${FIND_RADIUS_MIN_KM}-${FIND_RADIUS_MAX_KM}`);
  }
  if (num < FIND_RADIUS_MIN_KM || num > FIND_RADIUS_MAX_KM) {
    throw new RangeError(`radiusKm must be ${FIND_RADIUS_MIN_KM}-${FIND_RADIUS_MAX_KM}`);
  }
  return num;
}

/**
 * Snap a required radius UP to the nearest supported shared option so no
 * venue is ever excluded. Values above the largest option fall back to a
 * rounded custom value instead of dropping venues.
 */
export function snapRadiusUp(
  requiredKm: number,
  options: readonly number[] = FOOTBALL_DISTANCE_OPTIONS_KM
): number {
  if (!Number.isFinite(requiredKm)) {
    return FIND_DEFAULT_RADIUS_KM;
  }
  for (const opt of options) {
    if (opt >= requiredKm) {
      return opt;
    }
  }
  return Math.min(FIND_RADIUS_MAX_KM, Math.ceil(requiredKm / 10) * 10);
}
