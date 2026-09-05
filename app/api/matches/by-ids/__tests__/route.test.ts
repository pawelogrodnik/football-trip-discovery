/**
 * @jest-environment node
 */

import { GET } from '../route';

// Polyfill Request for the edge-runtime import picked up by `next/server`
// — jsdom doesn't provide it, node env does.
if (typeof globalThis.Request === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Request: NodeRequest } = require('node-fetch') as { Request: typeof Request };
  (globalThis as unknown as { Request: typeof Request }).Request = NodeRequest;
}

function get(url: string) {
  return GET(new Request(url) as never);
}

describe('GET /api/matches/by-ids', () => {
  test('same fixture requested under normalized + native id forms returns once', async () => {
    const rawId = '46f7d5ae8a8d306964f90cb6b8e797dc';
    const single = await get(`http://localhost/api/matches/by-ids?ids=${rawId}`);
    const singleData = await single.json();
    expect(singleData.matches).toHaveLength(1);
    const normalizedId = String(singleData.matches[0].id);
    expect(normalizedId).toBeTruthy();

    // Ask for the same fixture twice: normalized form + native alias form.
    const dup = await get(
      `http://localhost/api/matches/by-ids?ids=${encodeURIComponent(normalizedId)},${rawId}`
    );
    const dupData = await dup.json();
    expect(dupData.matches).toHaveLength(1);
    expect(dupData.totalCount).toBe(1);
    expect(dupData.missingIds).toEqual([]);
  });

  test('legacy raw-scope id (EU) still resolves after scope unification', async () => {
    const rawId = '46f7d5ae8a8d306964f90cb6b8e797dc';
    const single = await get(`http://localhost/api/matches/by-ids?ids=${rawId}`);
    const singleData = await single.json();
    expect(singleData.matches).toHaveLength(1);
    const m = singleData.matches[0];
    // UCL fixture normalized under the canonical EUROPE scope...
    expect(String(m.id)).toBeTruthy();
    // ...and the legacy EU-scoped variant resolves to the same fixture.
    const { buildRawScopeMatchId } = await import('lib/normalizeMatchId');
    const legacyId = buildRawScopeMatchId(m, {
      country: 'EU',
      league: m.competition?.name,
    });
    expect(legacyId).toBeTruthy();
    const viaLegacy = await get(
      `http://localhost/api/matches/by-ids?ids=${encodeURIComponent(legacyId)}`
    );
    const viaLegacyData = await viaLegacy.json();
    expect(viaLegacyData.matches).toHaveLength(1);
    expect(String(viaLegacyData.matches[0].id)).toBe(String(m.id));
  });

  test('out-of-radius fixture reports real distance, never fake 0 km', async () => {
    const rawId = '46f7d5ae8a8d306964f90cb6b8e797dc';
    // 1 km radius around a point far from any stadium.
    const res = await get(`http://localhost/api/matches/by-ids?ids=${rawId}&lat=0&lon=0&radius=1`);
    const data = await res.json();
    expect(data.matches).toHaveLength(1);
    const dist = data.matches[0]._distanceKm;
    expect(typeof dist).toBe('number');
    expect(dist).toBeGreaterThan(1);
  });

  test('pre-#9 schedule-based legacy id resolves without duplicates', async () => {
    const rawId = '46f7d5ae8a8d306964f90cb6b8e797dc';
    const single = await get(`http://localhost/api/matches/by-ids?ids=${rawId}`);
    const singleData = await single.json();
    expect(singleData.matches).toHaveLength(1);
    const m = singleData.matches[0];
    const legacyIds: string[] = Array.isArray(m._legacyIds) ? m._legacyIds : [];
    expect(legacyIds.length).toBeGreaterThan(0);
    // Canonical + legacy alias in one request still returns one fixture.
    const both = await get(
      `http://localhost/api/matches/by-ids?ids=${encodeURIComponent(String(m.id))},${encodeURIComponent(legacyIds[0])}`
    );
    const bothData = await both.json();
    expect(bothData.matches).toHaveLength(1);
    expect(String(bothData.matches[0].id)).toBe(String(m.id));
    expect(bothData.missingIds).toEqual([]);
  });
});
