import { fixturesLoaders } from './../../lib/fixturesManifest';
import { getCountriesInRadius } from './../../lib/geo';
import { filterFixturesInRadius } from './../../lib/geoTurf';
import { makeMatchId } from './../../lib/makeMatchId';
import { uniqById } from './../../lib/uniqById';

function parseUtcRange(startStr?: string | null, endStr?: string | null) {
  const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

  const start = startStr
    ? new Date(isDateOnly(startStr) ? `${startStr}T00:00:00.000Z` : startStr)
    : new Date('1970-01-01T00:00:00.000Z');

  const end = endStr
    ? new Date(isDateOnly(endStr) ? `${endStr}T23:59:59.999Z` : endStr)
    : new Date('9999-12-31T23:59:59.999Z');

  return { start, end };
}

const calculateTotalCount = (fixtures: any[]) =>
  fixtures.reduce(
    (acc, { leagues }) =>
      leagues.reduce(
        (z: any, current: { matches: string | any[] }) => current.matches.length + z,
        acc
      ),
    0
  );

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const radiusKm = searchParams.get('radius');

  const { start, end } = parseUtcRange(searchParams.get('startDate'), searchParams.get('endDate'));
  const startDate = start;
  const endDate = end;

  const countries = getCountriesInRadius(Number(lat), Number(lon), Number(radiusKm)).map(
    ({ name }) => name.toUpperCase()
  );
  const fixtures = [];
  for (const country of [...countries, 'EUROPE']) {
    const loaders = fixturesLoaders[country];
    if (!loaders) {
      continue;
    }

    const leagues = await Promise.all(
      loaders.map(async ({ load, name }) => ({ name, matches: (await load()).default }))
    );
    fixtures.push({
      country,
      leagues: leagues.map(({ name, matches }) => ({
        name,
        matches: uniqById(
          matches
            .filter((match: any) => {
              const date = new Date(match?.date?.date || match.utcDate);
              return date >= startDate && date <= endDate;
            })
            .filter((match: any) =>
              filterFixturesInRadius(match, Number(lat), Number(lon), Number(radiusKm))
            )
            .map((match: any) => ({ ...match, id: makeMatchId(match, country, name) }))
        ),
        // .sort((a: any, b: any) => a._distanceKm - b._distanceKm),
      })),
    });
  }
  const totalCount = calculateTotalCount(fixtures);

  return Response.json({ fixtures, totalCount });
}
