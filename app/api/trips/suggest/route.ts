import { NextResponse } from 'next/server';
import { BASE_FIXTURES, POLAND_FIXTURES_BY_REGION } from 'lib/fixturesManifest';
import { getAvailableLeagues } from 'lib/availableLeagues';
import { suggestTrips, TripMatch } from 'lib/tripOptimizer';
import { getCountriesInRadius } from 'lib/geo';
import { filterFixturesInRadius } from 'lib/geoTurf';
import { uniqById } from 'lib/uniqById';
import { ensureMatchHasNormalizedId } from 'lib/normalizeMatchId';
import { TtlCache } from 'lib/ttlCache';

const REGION_TTL = 10 * 60 * 1000;
const polandCache = new TtlCache<string, Record<string, any[]>>(REGION_TTL);

async function getPolandSnapshot() {
  return polandCache.get('regions', () => POLAND_FIXTURES_BY_REGION());
}

function parseDateRange(startStr?: string | null, endStr?: string | null) {
  const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const start = startStr ? new Date(isDateOnly(startStr) ? `${startStr}T00:00:00.000Z` : startStr) : new Date('1970-01-01T00:00:00.000Z');
  const end = endStr ? new Date(isDateOnly(endStr) ? `${endStr}T23:59:59.999Z` : endStr) : new Date('9999-12-31T23:59:59.999Z');
  return { start, end };
}

export async function GET() {
  const leagues = await getAvailableLeagues();
  return NextResponse.json({ leagues });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    leagues: selectedLeagues = [],
    countries: selectedCountries = [],
    uefa = [],
    startDate: startStr,
    endDate: endStr,
    maxInterTravelKm = 300,
    startLocation = null,
    searchLocation = null,
    searchRadiusKm = null,
    bufferMinutes = 30,
    limit = 3,
  } = body ?? {};

  const allSelectedLeagues: string[] = [...selectedLeagues];
  // Expand uefa shorthand
  const uefaMap: Record<string, string> = { UCL: 'Champions League', UEL: 'Europa League', UECL: 'Conference League', 'Champions League': 'Champions League', 'Europa League': 'Europa League', 'Conference League': 'Conference League' };
  for (const u of uefa) {
    const mapped = uefaMap[u] ?? u;
    if (!allSelectedLeagues.includes(mapped)) allSelectedLeagues.push(mapped);
  }

  // Validation
  if (!Array.isArray(allSelectedLeagues) || allSelectedLeagues.length === 0) {
    // Also check countries expansion will be done below, so allow if countries provided
    if (!Array.isArray(selectedCountries) || selectedCountries.length === 0) {
      return NextResponse.json({ error: 'Select at least one league' }, { status: 400 });
    }
  }

  const { start, end } = parseDateRange(startStr, endStr);
  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0 || diffDays > 30) {
    return NextResponse.json({ error: 'Date range must be 0-30 days' }, { status: 400 });
  }
  if (typeof maxInterTravelKm !== 'number' || maxInterTravelKm < 20 || maxInterTravelKm > 300) {
    return NextResponse.json({ error: 'maxInterTravelKm must be 20-300' }, { status: 400 });
  }
  const hasSearchLocation = searchLocation && typeof searchLocation.lat === 'number' && typeof searchLocation.lon === 'number';
  const parsedSearchRadius = hasSearchLocation ? Number(searchRadiusKm) : null;
  if (hasSearchLocation) {
    if (typeof parsedSearchRadius !== 'number' || Number.isNaN(parsedSearchRadius) || parsedSearchRadius < 5 || parsedSearchRadius > 500) {
      return NextResponse.json({ error: 'searchRadiusKm must be 5-500 when searchLocation provided' }, { status: 400 });
    }
  }

  // Expand countries to leagues via availableLeagues
  const available = await getAvailableLeagues();
  const expandedLeagues = new Set<string>(allSelectedLeagues);
  for (const c of selectedCountries) {
    const g = available.find((x) => x.country === c);
    if (g) {
      for (const l of g.leagues) expandedLeagues.add(l.name);
    }
  }
  // If UEFA country selected, ensure its 3 leagues are included (already via uefa, but also via country)
  const selectedSet = expandedLeagues;
  const selectedLeagueSet = new Set(selectedSet);

  // Collect matches: reuse logic from /api/matches but without geo radius unless startLocation
  // For suggest, we want all matches in date range for selected leagues, then DP will handle geo hop.
  // To limit scope, if startLocation is provided, we can pre-filter to matches within maxInterTravelKm * trips? Instead, keep all and let DP filter.
  // But to avoid huge n (e.g., 800 for T6 30 days), we can pre-filter by startLocation radius 300 if provided.

  const t0 = Date.now();
  const allMatches: TripMatch[] = [];
  const loadedLeagues = new Set<string>();

  // Helper to load leagues for a country
  async function collectForCountry(country: string, loaders: any[]) {
    for (const { name, load } of loaders) {
      if (loadedLeagues.has(name)) continue;
      if (selectedLeagueSet.size > 0 && !selectedLeagueSet.has(name)) continue;
      loadedLeagues.add(name);
      try {
        const file = (await load()).default;
        const matches = Array.isArray(file) ? file : file.matches ?? [];
        for (const m of matches) {
          const d = new Date(m?.date?.date || m?.date?.dateTime || m?.utcDate || '1970-01-01');
          if (Number.isNaN(d.getTime())) continue;
          if (d < start || d > end) continue;
          // Ensure normalized id and geo
          ensureMatchHasNormalizedId(m, { country, league: m.competition?.name ?? name });
          // Filter out without geo (needed for travel)
          const lat = m.stadium?.geo?.latitude;
          const lon = m.stadium?.geo?.longitude;
          if (typeof lat !== 'number' || typeof lon !== 'number') continue;
          // If startLocation, optionally pre-filter to within 300km of start (first hop) to reduce n
          // Keep all, DP will handle, but we can keep to avoid huge n
          allMatches.push({ ...m, country, league: name });
        }
      } catch {}
    }
  }

  // EUROPE always maybe? Only if selected includes UEFA
  const hasUefa = selectedSet.has('Champions League') || selectedSet.has('Europa League') || selectedSet.has('Conference League');
  if (hasUefa) {
    const europeLoaders = (BASE_FIXTURES as any).EUROPE ?? [];
    await collectForCountry('EUROPE', europeLoaders);
  }

  for (const [country, loaders] of Object.entries(BASE_FIXTURES)) {
    if (country === 'EUROPE') continue;
    // Only collect if at least one league of this country is selected
    const hasAny = loaders.some((l: any) => selectedLeagueSet.has(l.name));
    // Also if country selected via countries array, hasAny will be true via expansion
    if (!hasAny && selectedLeagueSet.size > 0) {
      // Check if any selected league belongs to this country via available mapping
      const countryLeagues = available.find((g) => g.country === country)?.leagues.map((x) => x.name) ?? [];
      const overlap = countryLeagues.some((n) => selectedLeagueSet.has(n));
      if (!overlap) continue;
    }
    await collectForCountry(country, loaders);
  }

  // Poland regional
  const polandSelected = Array.from(selectedLeagueSet).some((n) => {
    // Check if any regional league name matches
    return n.includes('Klasa') || n.includes('IV liga') || n.includes('V liga') || n.includes('Okręgowa');
  });
  if (polandSelected || selectedSet.has('Ekstraklasa') || selectedSet.has('Polish')) {
    try {
      const snapshot = await getPolandSnapshot();
      for (const [code, loaders] of Object.entries(snapshot)) {
        await collectForCountry(`POLAND-${code}`, loaders as any);
      }
    } catch {}
  }

  // Also need to handle POLAND base leagues (Ekstraklasa etc.) already via BASE_FIXTURES POLAND

  // Deduplicate
  let uniq = uniqById(allMatches as any) as unknown as TripMatch[];

  // Optional radius filter around searchLocation (like homepage)
  if (hasSearchLocation && parsedSearchRadius !== null) {
    const lat = Number(searchLocation.lat);
    const lon = Number(searchLocation.lon);
    const before = uniq.length;
    uniq = uniq.filter((m) => filterFixturesInRadius(m as any, lat, lon, Number(parsedSearchRadius)));
    // If filter removes all, early return for clarity
    if (uniq.length === 0) {
      return NextResponse.json({ trips: [], meta: { filteredCount: 0, tookMs: Date.now() - t0, searchFiltered: before } });
    }
  }

  // If no matches
  if (uniq.length === 0) {
    return NextResponse.json({ trips: [], meta: { filteredCount: 0, tookMs: Date.now() - t0 } });
  }

  // Suggest trips
  const trips = suggestTrips(uniq, {
    maxInterTravelKm: Number(maxInterTravelKm),
    bufferMinutes: Number(bufferMinutes),
    startLocation: startLocation && typeof startLocation.lat === 'number' ? startLocation : null,
    limit: Number(limit),
  });

  return NextResponse.json({
    trips,
    meta: {
      filteredCount: uniq.length,
      tookMs: Date.now() - t0,
    },
  });
}
