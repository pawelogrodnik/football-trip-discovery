import { buildNormalizedMatchId, ensureMatchHasNormalizedId } from 'lib/normalizeMatchId';

const baseMatch: any = {
  competition: { code: 'EKSTRA' },
  homeTeam: { name: 'Radomiak' },
  awayTeam: { name: 'Widzew' },
  date: { dateTime: '2026-04-06T12:45:00.000Z' },
};

describe('normalizeMatchId', () => {
  it('combines derived hash with native id when both exist', () => {
    const match: any = { ...baseMatch, id: 'legacy-123' };
    const normalized = ensureMatchHasNormalizedId(match, { country: 'POLAND', league: 'Ekstraklasa' });

    expect(normalized._nativeId).toBe('legacy-123');
    expect(normalized.id).toContain('__legacy-123');
    expect(normalized.id.startsWith('legacy-123')).toBe(false);
  });

  it('derives deterministic id when only contextual data exists', () => {
    const match: any = { ...baseMatch };
    const normalized = ensureMatchHasNormalizedId(match, { country: 'POLAND', league: 'Ekstraklasa' });
    const second = ensureMatchHasNormalizedId({ ...baseMatch } as any, {
      country: 'POLAND',
      league: 'Ekstraklasa',
    });

    expect(normalized.id).toEqual(second.id);
    expect(normalized._nativeId).toBeFalsy();
    expect(normalized.id).toHaveLength(32); // md5 hash
  });

  it('buildNormalizedMatchId reuses cached hash when _nativeId is provided', () => {
    const match: any = { ...baseMatch, _id: 'provider-555' };
    const derived = buildNormalizedMatchId(match, { country: 'POLAND', league: 'Ekstraklasa' });

    expect(derived).toContain('provider-555');
  });
});
