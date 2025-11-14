import path from 'node:path';
import { promises as fs } from 'node:fs';
import { NextResponse } from 'next/server';
import { filterFixturesInRadius } from 'lib/geoTurf';

const FIXTURES_DIR = path.join(process.cwd(), 'app', 'fixtures');

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
  const remaining = new Set(uniqueRequestedIds);
  const matches: any[] = [];

  const files = await collectFixtureFiles(FIXTURES_DIR);

  for (const file of files) {
    if (remaining.size === 0) {
      break;
    }

    let parsed: unknown;
    try {
      const fileContents = await fs.readFile(file, 'utf8');
      parsed = JSON.parse(fileContents);
    } catch (error) {
      console.warn(`[matches/by-ids] Failed to read ${file}:`, error);
      continue;
    }

    const items = parseFixtureFile(parsed);
    for (const item of items) {
      const matchId = String(item?.id ?? item?._id ?? '').trim();
      if (!matchId) {
        continue;
      }
      if (remaining.has(matchId)) {
        if (hasCenter) {
          filterFixturesInRadius(item, latParam, lonParam, radiusForDistance);
          if (typeof item._distanceKm !== 'number') {
            item._distanceKm = 0;
          }
        } else if (typeof item._distanceKm !== 'number') {
          item._distanceKm = 0;
        }
        matches.push(item);
        remaining.delete(matchId);
        if (remaining.size === 0) {
          break;
        }
      }
    }
  }

  return NextResponse.json({
    matches,
    totalCount: matches.length,
    missingIds: Array.from(remaining),
  });
}
