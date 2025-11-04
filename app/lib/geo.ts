import * as turf from '@turf/turf';
import countriesGeoJSON from './../data/countries.geojson.json';

export function getCountriesInRadius(lat: number, lon: number, radiusKm: number) {
  const circle = turf.circle([lon, lat], radiusKm, { steps: 128, units: 'kilometers' });

  const hits = countriesGeoJSON.features.filter((f: any) => turf.booleanIntersects(f, circle));
  return hits.map((f: any) => ({
    name: f.properties?.NAME || f.properties?.ADMIN,
    iso2: f.properties?.ISO_A2,
    iso3: f.properties?.ISO_A3,
  }));
}
