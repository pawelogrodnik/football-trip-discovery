import { BASE_FIXTURES, POLAND_FIXTURES_BY_REGION } from 'lib/fixturesManifest';
import { getCountriesInRadius } from 'lib/geo';
import { filterFixturesInRadius } from 'lib/geoTurf';
import { isAnyCountryInEurope } from 'lib/isAnyCountryInEurope';
import { uniqById } from 'lib/uniqById';
import { ensureMatchHasNormalizedId } from 'lib/normalizeMatchId';
import { TtlCache } from 'lib/ttlCache';

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

const REGION_FIXTURE_TTL_MS = 10 * 60 * 1000;
const polandFixturesCache = new TtlCache<string, Record<string, any[]>>(REGION_FIXTURE_TTL_MS);

async function getPolandRegionSnapshot() {
  return polandFixturesCache.get('regions', () => POLAND_FIXTURES_BY_REGION());
}

const getPolishRegionFixtures = async (countriesData: any) => {
  const PL_REGIONS = countriesData.find(
    (country: any) => country.name.toUpperCase() === 'POLAND'
  )?.regions;
  let fixtures: any[] = [];
  if (PL_REGIONS && PL_REGIONS.length > 0) {
    const snapshot = await getPolandRegionSnapshot();
    for (const region of PL_REGIONS) {
      const currentRegionData = snapshot?.[region.code!];
      if (currentRegionData) {
        fixtures = [...fixtures, ...currentRegionData];
      }
    }
  }
  return fixtures;
};
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const radiusKm = searchParams.get('radius');
  const errors = [];

  const { start, end } = parseUtcRange(searchParams.get('startDate'), searchParams.get('endDate'));
  const startDate = start;
  const endDate = end;

  const countriesData = getCountriesInRadius(Number(lat), Number(lon), Number(radiusKm));

  const countryNames = countriesData.map(({ name }) => name);
  const fixtures = [];

  let loaders = null;
  const loadedLeagues: string[] = [];

  if (isAnyCountryInEurope(countriesData)) {
    loaders = BASE_FIXTURES.EUROPE;
  }
  for (const country of countryNames) {
    loaders = [...(loaders ? loaders : []), ...(BASE_FIXTURES[country] ?? [])];
    if (country === 'POLAND') {
      try {
        const polishRegionsLoaders = await getPolishRegionFixtures(countriesData);
        loaders = [...loaders, ...polishRegionsLoaders];
      } catch (err) {
        errors.push({ message: 'Error loading regional fixtures' });
      }
    }
    if (!loaders) {
      continue;
    }

    const leagues = await Promise.all(
      loaders
        .filter(({ name }) => {
          if (loadedLeagues.includes(name)) {
            return false;
          }
          loadedLeagues.push(name);
          return true;
        })
        .map(async ({ load, name }) => {
          const loadedFile = (await load()).default;
          const matches = Array.isArray(loadedFile) ? loadedFile : loadedFile.matches;
          return { name, matches };
        })
    );

    const leaguesUpdated = leagues
      .filter(({ matches }) => matches.length > 0)
      .map(({ name, matches }) => {
        const filteredMatches = uniqById(
          matches
            .filter((match: any) => {
              const date = new Date(match?.date?.date || match.utcDate);
              return date >= startDate && date <= endDate;
            })
            .filter((match: any) =>
              filterFixturesInRadius(match, Number(lat), Number(lon), Number(radiusKm))
            )
        );

        const normalizedMatches = filteredMatches.map((match: any) =>
          ensureMatchHasNormalizedId(match, { country, league: name })
        );

        return {
          name,
          matches: normalizedMatches,
        };
      })
      .filter(({ matches }) => matches.length > 0);

    fixtures.push({
      country,
      leagues: leaguesUpdated,
    });
  }
  const totalCount = calculateTotalCount(fixtures);

  return Response.json({ fixtures, totalCount, errors });
}
