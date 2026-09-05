import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { venueDistanceKm } from 'lib/geoTurf';
import { getFixtureSchedule } from 'lib/matchSchedule';
import {
  buildRawScopeMatchId,
  ensureMatchHasNormalizedId,
  getLegacyScheduleIdAliases,
} from 'lib/normalizeMatchId';

const FIXTURES_DIR = path.join(process.cwd(), 'app', 'fixtures');
const FIXTURES_INDEX_TTL_MS = 5 * 60 * 1000;

type IndexedMatch = {
  match: any;
  serialized: string;
  source: string;
};

type FixturesIndex = {
  matches: Map<string, IndexedMatch>;
  aliases: Map<string, string>;
};

let fixturesIndexCache: { expiresAt: number; data: FixturesIndex } | null = null;

async function collectFixtureFiles(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map(async (dirent) => {
      const resolved = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        return collectFixtureFiles(resolved);
      }
      if (dirent.isFile() && resolved.endsWith('.json')) {
        return [resolved];
      }
      return [];
    })
  );
  return files.flat();
}

function parseFixtureFile(raw: unknown): any[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw && typeof raw === 'object' && Array.isArray((raw as any).matches)) {
    return (raw as any).matches;
  }
  return [];
}

function deriveCountryHint(filePath: string): string {
  const segments = filePath.split(path.sep);
  const fixturesIndex = segments.findIndex((segment) => segment.toLowerCase() === 'fixtures');
  if (fixturesIndex === -1) {
    return '';
  }
  const scope = segments[fixturesIndex + 1];
  if (!scope) {
    return '';
  }
  if (scope.toLowerCase() === 'local') {
    return segments[fixturesIndex + 2] ?? '';
  }
  if (scope.toLowerCase() === 'eu') {
    return 'EUROPE';
  }
  return scope;
}

function cloneMatch<T>(match: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(match);
  }
  return JSON.parse(JSON.stringify(match));
}

function extractMatchTimestamp(match: any): number {
  const iso =
    match?.date?.dateTime ??
    match?.utcDate ??
    (match?.date?.date ? `${match.date.date}T00:00:00.000Z` : null);

  if (!iso) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = Date.parse(iso);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function schedulePrecision(match: any): number {
  const status = getFixtureSchedule(match)?.status;
  if (status === 'confirmed') {
    return 3;
  }
  if (status === 'date-confirmed') {
    return 2;
  }
  if (status === 'date-window') {
    return 1;
  }
  return 0;
}

function shouldReplaceMatch(existing: any | undefined, candidate: any): boolean {
  if (!existing) {
    return true;
  }

  // Prefer the most precise schedule (confirmed > date-confirmed > window),
  // so a refined kickoff replaces a TBC row instead of duplicating it.
  const precisionDelta = schedulePrecision(candidate) - schedulePrecision(existing);
  if (precisionDelta !== 0) {
    return precisionDelta > 0;
  }

  const existingTs = extractMatchTimestamp(existing);
  const candidateTs = extractMatchTimestamp(candidate);
  if (candidateTs !== existingTs) {
    // prefer the most up-to-date (latest) kickoff timestamp
    return candidateTs > existingTs;
  }

  const candidateHasTickets = Boolean(candidate?.ticketOffers);
  const existingHasTickets = Boolean(existing?.ticketOffers);
  if (candidateHasTickets && !existingHasTickets) {
    return true;
  }
  if (!candidateHasTickets && existingHasTickets) {
    return false;
  }

  // as a final tiebreaker keep the candidate for determinism
  return true;
}

async function getFixturesIndex(): Promise<FixturesIndex> {
  const now = Date.now();
  if (fixturesIndexCache && fixturesIndexCache.expiresAt > now) {
    return fixturesIndexCache.data;
  }

  const data = await buildFixturesIndex();
  fixturesIndexCache = { data, expiresAt: now + FIXTURES_INDEX_TTL_MS };
  return data;
}

async function buildFixturesIndex(): Promise<FixturesIndex> {
  const files = await collectFixtureFiles(FIXTURES_DIR);
  const matches = new Map<string, IndexedMatch>();
  const aliases = new Map<string, string>();
  const loggedDuplicates = new Set<string>();

  for (const file of files) {
    let parsed: unknown;
    try {
      const fileContents = await fs.readFile(file, 'utf8');
      parsed = JSON.parse(fileContents);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[matches/by-ids] Failed to read ${file}:`, error);
      continue;
    }

    const items = parseFixtureFile(parsed);
    const rawScope = deriveCountryHint(file);
    for (const item of items) {
      const leagueHint = item?.competition?.name ?? item?.competition?.code ?? '';
      ensureMatchHasNormalizedId(item, { country: rawScope, league: leagueHint });

      const normalizedId = String(item?.id ?? '').trim();
      if (!normalizedId) {
        continue;
      }
      const nativeId = String(item?._nativeId ?? item?._id ?? '').trim();

      const current = matches.get(normalizedId);
      if (current && !loggedDuplicates.has(normalizedId)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[matches/by-ids] Duplicate match id ${normalizedId} detected (e.g. ${file}). Choosing the best candidate based on kickoff time.`
        );
        loggedDuplicates.add(normalizedId);
      }

      if (!current || shouldReplaceMatch(current.match, item)) {
        matches.set(normalizedId, {
          match: item,
          serialized: JSON.stringify(item),
          source: file,
        });
      }

      aliases.set(normalizedId, normalizedId);
      if (nativeId && !aliases.has(nativeId)) {
        aliases.set(nativeId, normalizedId);
      }
      // Share URLs built before scope unification carry raw-scope ids
      // (e.g. `EU`- or `POLAND-XX`-scoped). Keep them resolving.
      const rawScopeId = buildRawScopeMatchId(item, { country: rawScope, league: leagueHint });
      if (rawScopeId && rawScopeId !== normalizedId && !aliases.has(rawScopeId)) {
        aliases.set(rawScopeId, normalizedId);
      }
      // Pre-#9 schedule-based ids (kickoff hashed into the id). A fixture
      // refined from date-window to confirmed keeps its canonical id;
      // old ids still resolve instead of producing duplicates.
      for (const legacyId of getLegacyScheduleIdAliases(item, {
        country: rawScope,
        league: leagueHint,
      })) {
        if (legacyId && legacyId !== normalizedId && !aliases.has(legacyId)) {
          aliases.set(legacyId, normalizedId);
        }
      }
    }
  }

  return { matches, aliases };
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const rawIds = [...searchParams.getAll('ids'), ...searchParams.getAll('id')];
  const requestedIds = rawIds
    .flatMap((entry) => entry.split(','))
    .map((id) => id.trim())
    .filter(Boolean);

  const latParam = Number(searchParams.get('lat'));
  const lonParam = Number(searchParams.get('lon'));
  const hasCenter = Number.isFinite(latParam) && Number.isFinite(lonParam);

  if (requestedIds.length === 0) {
    return NextResponse.json(
      { matches: [], totalCount: 0, error: 'Provide at least one match id via ?ids=' },
      { status: 400 }
    );
  }

  const uniqueRequestedIds = Array.from(new Set(requestedIds));
  const missingIds = new Set(uniqueRequestedIds);
  const matches: any[] = [];
  // Two requested id forms (normalized + native alias) can resolve to the
  // same fixture — guard against returning it twice.
  const resolvedNormalizedIds = new Set<string>();

  const fixturesIndex = await getFixturesIndex();

  for (const requestId of uniqueRequestedIds) {
    let normalizedId = fixturesIndex.aliases.get(requestId);
    if (!normalizedId && requestId.includes('__')) {
      const nativePart = requestId.split('__').pop()!.trim();
      normalizedId = fixturesIndex.aliases.get(nativePart) ?? nativePart;
    }
    if (!normalizedId) {
      normalizedId = requestId;
    }
    if (resolvedNormalizedIds.has(normalizedId)) {
      missingIds.delete(requestId);
      continue;
    }
    const indexed = fixturesIndex.matches.get(normalizedId);
    if (!indexed) {
      continue;
    }
    resolvedNormalizedIds.add(normalizedId);

    const match = cloneMatch(indexed.match);

    if (hasCenter) {
      // Always report the real geographic distance. Radius membership is a
      // separate concern — never fake out-of-radius fixtures as 0 km.
      const realDistanceKm = venueDistanceKm(match, latParam, lonParam);
      if (realDistanceKm !== null) {
        match._distanceKm = realDistanceKm;
      } else {
        delete match._distanceKm;
      }
    } else if (typeof match._distanceKm !== 'number') {
      delete match._distanceKm;
    }

    matches.push(match);
    missingIds.delete(requestId);
  }

  return NextResponse.json({
    matches,
    totalCount: matches.length,
    missingIds: Array.from(missingIds),
  });
}
