import * as turf from '@turf/turf';

export function venueDistanceKm(
  fixture: {
    stadium?: { geo?: { latitude?: number; longitude?: number } };
  },
  centerLat: number,
  centerLon: number
): number | null {
  const lat = fixture?.stadium?.geo?.latitude;
  const lon = fixture?.stadium?.geo?.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return null;
  }
  return turf.distance(turf.point([centerLon, centerLat]), turf.point([lon, lat]), {
    units: 'kilometers',
  });
}

export function filterFixturesInRadius<
  T extends {
    homeTeam: { name: string };
    stadium?: { geo?: { latitude?: number; longitude?: number } };
  },
>(fixture: T, centerLat: number, centerLon: number, radiusKm: number) {
  const center = turf.point([centerLon, centerLat]);

  const { stadium } = fixture;
  const lat = stadium?.geo?.latitude;
  const lon = stadium?.geo?.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return false;
  }

  const distKm = turf.distance(center, turf.point([lon, lat]), { units: 'kilometers' });
  if (distKm <= radiusKm) {
    (fixture as any)._distanceKm = distKm;
    return true;
  }
  return false;
}
