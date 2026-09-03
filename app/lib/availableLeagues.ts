import { BASE_FIXTURES } from './fixturesManifest';
import { promises as fs } from 'fs';
import path from 'path';

export type LeagueOption = {
  name: string;
  country: string;
  tier?: string;
  region?: string; // e.g. PL-MA for Poland regional
};

export type CountryGroup = {
  country: string;
  leagues: LeagueOption[];
};

function polishPriority(name: string): number {
  const n = name.toLowerCase();
  if (n.includes('ekstraklasa')) return 1;
  if (n.includes('polish i league') || n.includes('i liga') && !n.includes('ii') && !n.includes('iii') && !n.includes('iv') && !n.includes('v')) return 2;
  if (n.includes('polish ii league') || n.includes('ii liga') && !n.includes('iii')) return 3;
  if (n.includes('iii liga') || n.includes('polish iii')) return 4;
  if (n.includes('polish cup') || n.includes('puchar')) return 5;
  if (n.includes('iv liga')) return 6;
  if (n.includes('v liga')) return 7;
  if (n.includes('okręgowa') || n.includes('okregowa')) return 8;
  if (n.includes('klasa a')) return 9;
  if (n.includes('klasa b')) return 10;
  if (n.includes('klasa c')) return 11;
  return 99;
}

const UEFA_LEAGUES: LeagueOption[] = [
  { name: 'Champions League', country: 'UEFA' },
  { name: 'Europa League', country: 'UEFA' },
  { name: 'Conference League', country: 'UEFA' },
];

// Cache for available leagues
let cached: CountryGroup[] | null = null;
let cacheExpires = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function getAvailableLeagues(): Promise<CountryGroup[]> {
  const now = Date.now();
  if (cached && cacheExpires > now) return cached;

  const groups: CountryGroup[] = [];

  // UEFA separate
  groups.push({ country: 'UEFA', leagues: UEFA_LEAGUES });

  // Countries from BASE_FIXTURES
  for (const [country, loaders] of Object.entries(BASE_FIXTURES)) {
    if (country === 'EUROPE') continue; // already in UEFA
    let leagues = loaders.map((l) => ({ name: l.name, country }));
    // For POLAND, add regional dynamic leagues
    if (country === 'POLAND') {
      const regional = await getPolandRegionalLeagueNames();
      for (const r of regional) {
        if (!leagues.some((x) => x.name === r.name)) {
          leagues.push(r);
        }
      }
      // Sort Poland by priority: Ekstraklasa > I > II > III > IV > V > Okręgowa > A > B > C, then per voivodeship
      leagues.sort((a, b) => {
        const pa = polishPriority(a.name);
        const pb = polishPriority(b.name);
        if (pa !== pb) return pa - pb;
        // For same priority and from IV down, sort per voivodeship (region)
        if (pa >= 6) {
          const ra = (a as any).region || '';
          const rb = (b as any).region || '';
          if (ra !== rb) return ra.localeCompare(rb);
        }
        return a.name.localeCompare(b.name);
      });
    }
    groups.push({ country, leagues });
  }

  // Sort countries, UEFA first
  groups.sort((a, b) => {
    if (a.country === 'UEFA') return -1;
    if (b.country === 'UEFA') return 1;
    return a.country.localeCompare(b.country);
  });

  cached = groups;
  cacheExpires = now + CACHE_TTL;
  return groups;
}

async function getPolandRegionalLeagueNames(): Promise<LeagueOption[]> {
  const out: LeagueOption[] = [];
  const base = path.join(process.cwd(), 'app', 'fixtures', 'LOCAL', 'POLAND');
  try {
    const entries = await fs.readdir(base, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const region = e.name; // PL-MA etc.
      const regionDir = path.join(base, region);
      try {
        const files = await fs.readdir(regionDir, { withFileTypes: true });
        for (const f of files) {
          if (!f.isFile() || !f.name.endsWith('.json')) continue;
          const full = path.join(regionDir, f.name);
          try {
            const raw = await fs.readFile(full, 'utf8');
            const json = JSON.parse(raw);
            const name = json.competitionName || f.name.replace(/^fixtures_/, '').replace(/\.json$/, '').replace(/_/g, ' ');
            if (name && !out.some((x) => x.name === name)) {
              out.push({ name, country: 'POLAND', region });
            }
          } catch {}
        }
      } catch {}
    }
  } catch {}
  const fallback = [
    'Polish III League (grupa I)',
    'Polish III League (grupa II)',
    'Polish III League (grupa III)',
    'Polish III League (grupa IV)',
  ];
  for (const n of fallback) {
    if (!out.some((x) => x.name === n)) out.push({ name: n, country: 'POLAND', region: 'PL-??' });
  }
  return out;
}

export function expandSelection(selectedLeagues: string[], selectedCountries: string[], allGroups: CountryGroup[]): string[] {
  const set = new Set<string>(selectedLeagues);
  for (const c of selectedCountries) {
    const g = allGroups.find((x) => x.country === c);
    if (g) {
      for (const l of g.leagues) set.add(l.name);
    }
  }
  // UEFA special: if UEFA country selected, add its 3
  if (selectedCountries.includes('UEFA')) {
    for (const l of UEFA_LEAGUES) set.add(l.name);
  }
  return Array.from(set);
}
