import { GET } from '../route';

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
});
