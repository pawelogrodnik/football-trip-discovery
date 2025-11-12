import * as turf from '@turf/turf';
import countriesGeoJSON from 'data/countries.geojson.json';
import italyGeoJSON from 'data/italy_admin.geojson.json';
import polandGeoJSON from 'data/poland_admin.geojson.json';

function getAdmin1InCircle(circle: any, admin1GeoJSON: any) {
  const regions = admin1GeoJSON.features
    .filter((f: any) => turf.booleanIntersects(f, circle))
    .map((f: any) => {
      return {
        name: f.properties?.NAME_1 || f.properties?.NAME || f.properties?.shapeName,
        code: f.properties?.shapeISO,
      };
    });

  return regions;
}

export function getCountriesInRadius(lat: number, lon: number, radiusKm: number) {
  const circle = turf.circle([lon, lat], radiusKm, { steps: 128, units: 'kilometers' });

  const hits = countriesGeoJSON.features.filter((f: any) => turf.booleanIntersects(f, circle));
  return hits.map((f: any) => {
    const iso3 = f.properties?.ISO_A3;
    const name = f.properties?.NAME || f.properties?.ADMIN;
    let regions: { name: string; code?: string }[] | undefined;
    if (iso3 === 'POL') {
      regions = getAdmin1InCircle(circle, polandGeoJSON);
    } else if (iso3 === 'ITA') {
      regions = getAdmin1InCircle(circle, italyGeoJSON);
    }

    return {
      name: name.toUpperCase(),
      iso2: f.properties?.ISO_A2,
      iso3,
      regions,
    };
  });
}
