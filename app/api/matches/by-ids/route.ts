import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { filterFixturesInRadius } from 'lib/geoTurf';
import { ensureMatchHasNormalizedId } from 'lib/normalizeMatchId';

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

function shouldReplaceMatch(existing: any | undefined, candidate: any): boolean {
  if (!existing) {
    return true;
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
    for (const item of items) {
      const leagueHint = item?.competition?.name ?? item?.competition?.code ?? '';
      ensureMatchHasNormalizedId(item, { country: deriveCountryHint(file), league: leagueHint });

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
  const radiusParam = Number(searchParams.get('radius'));
  const hasCenter = Number.isFinite(latParam) && Number.isFinite(lonParam);
  const radiusForDistance = Number.isFinite(radiusParam) ? radiusParam : Number.POSITIVE_INFINITY;

  if (requestedIds.length === 0) {
    return NextResponse.json(
      { matches: [], totalCount: 0, error: 'Provide at least one match id via ?ids=' },
      { status: 400 }
    );
  }

  const uniqueRequestedIds = Array.from(new Set(requestedIds));
  const missingIds = new Set(uniqueRequestedIds);
  const matches: any[] = [];

  const fixturesIndex = await getFixturesIndex();

  for (const requestId of uniqueRequestedIds) {
    const normalizedId = fixturesIndex.aliases.get(requestId) ?? requestId;
    const indexed = fixturesIndex.matches.get(normalizedId);
    if (!indexed) {
      continue;
    }

    const match = cloneMatch(indexed.match);

    if (hasCenter) {
      filterFixturesInRadius(match, latParam, lonParam, radiusForDistance);
      if (typeof match._distanceKm !== 'number') {
        match._distanceKm = 0;
      }
    } else if (typeof match._distanceKm !== 'number') {
      match._distanceKm = 0;
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
