import {
  buildNormalizedMatchId,
  buildRawScopeMatchId,
  ensureMatchHasNormalizedId,
  getCanonicalMatchId,
  getLegacyScheduleIdAliases,
  getMatchAliases,
  normalizeMatchScope,
} from 'lib/normalizeMatchId';

const baseMatch: any = {
  competition: { code: 'EKSTRA' },
  homeTeam: { name: 'Radomiak' },
  awayTeam: { name: 'Widzew' },
  date: { dateTime: '2026-04-06T12:45:00.000Z' },
};

describe('normalizeMatchId', () => {
  it('combines derived hash with native id when both exist', () => {
    const match: any = { ...baseMatch, id: 'legacy-123' };
    const normalized = ensureMatchHasNormalizedId(match, {
      country: 'POLAND',
      league: 'Ekstraklasa',
    });

    expect(normalized._nativeId).toBe('legacy-123');
    expect(normalized.id).toContain('__legacy-123');
    expect(normalized.id.startsWith('legacy-123')).toBe(false);
  });

  it('derives deterministic id when only contextual data exists', () => {
    const match: any = { ...baseMatch };
    const normalized = ensureMatchHasNormalizedId(match, {
      country: 'POLAND',
      league: 'Ekstraklasa',
    });
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

  it('unifies UEFA scope: EU, EUROPE and UEFA hash identically', () => {
    const uefa: any = {
      competition: { name: 'UEFA Champions League' },
      homeTeam: { name: 'Como 1907' },
      awayTeam: { name: 'Manchester United' },
      date: { dateTime: '2026-09-30T19:00:00.000Z' },
    };
    const viaEurope = buildNormalizedMatchId(
      { ...uefa },
      { country: 'EUROPE', league: 'UEFA Champions League' }
    );
    const viaEu = buildNormalizedMatchId(
      { ...uefa },
      { country: 'EU', league: 'UEFA Champions League' }
    );
    const viaItaly = buildNormalizedMatchId(
      { ...uefa },
      { country: 'ITALY', league: 'UEFA Champions League' }
    );
    // Discover (/EUROPE) and by-ids (EU file dir) must agree; a search-country
    // scope (ITALY) intentionally stays distinct.
    expect(viaEu).toBe(viaEurope);
    expect(viaItaly).not.toBe(viaEurope);
  });

  it('unifies Polish regional scope: POLAND-XX hashes like POLAND', () => {
    const regional: any = { ...baseMatch };
    const viaRegion = buildNormalizedMatchId(regional, {
      country: 'POLAND-PL-PK',
      league: 'Ekstraklasa',
    });
    const viaPoland = buildNormalizedMatchId(
      { ...baseMatch },
      { country: 'POLAND', league: 'Ekstraklasa' }
    );
    expect(viaRegion).toBe(viaPoland);
    expect(normalizeMatchScope('POLAND-PL-PK')).toBe('POLAND');
    expect(normalizeMatchScope('EU')).toBe('EUROPE');
    expect(normalizeMatchScope('ITALY')).toBe('ITALY');
  });

  it('buildRawScopeMatchId preserves the legacy pre-unification id as alias', () => {
    const uefa: any = {
      competition: { name: 'UEFA Champions League' },
      homeTeam: { name: 'Como 1907' },
      awayTeam: { name: 'Manchester United' },
      date: { dateTime: '2026-09-30T19:00:00.000Z' },
      _nativeId: 'native-1',
    };
    const canonical = buildNormalizedMatchId(uefa, {
      country: 'EU',
      league: 'UEFA Champions League',
    });
    const legacy = buildRawScopeMatchId(uefa, { country: 'EU', league: 'UEFA Champions League' });
    expect(canonical).not.toBe(legacy);
    expect(legacy).toContain('native-1');
  });

  it('getCanonicalMatchId prefers normalized id over native _id', () => {
    expect(getCanonicalMatchId({ id: 'canon', _id: 'native' })).toBe('canon');
    expect(getCanonicalMatchId({ _id: 'native' } as never)).toBe('native');
    expect(getCanonicalMatchId(null)).toBe('');
  });

  it('getMatchAliases exposes native forms resolving to canonical', () => {
    const aliases = getMatchAliases({
      id: 'derived__native-1',
      _id: 'native-1',
      _nativeId: 'native-1',
    });
    expect(aliases).toContain('native-1');
    expect(aliases).not.toContain('derived__native-1');
  });

  it('schedule refinement (window -> confirmed) keeps canonical identity', () => {
    const ctx = { country: 'POLAND', league: 'IV liga' };
    const base: any = {
      competition: { code: 'IVL', name: 'IV liga' },
      homeTeam: { name: 'Hutnik Kraków' },
      awayTeam: { name: 'Dalin Myślenice' },
      matchday: 7,
    };
    const windowId = buildNormalizedMatchId(
      {
        ...base,
        schedule: { status: 'date-window', startDate: '2026-10-22', endDate: '2026-10-23' },
      },
      ctx
    );
    const confirmedId = buildNormalizedMatchId(
      { ...base, date: { dateTime: '2026-10-23T14:00:00+02:00' } },
      ctx
    );
    expect(windowId).toBe(confirmedId);
  });

  it('pre-#9 schedule-based ids survive as aliases', () => {
    const ctx = { country: 'POLAND', league: 'IV liga' };
    const match: any = {
      competition: { code: 'IVL', name: 'IV liga' },
      homeTeam: { name: 'Hutnik Kraków' },
      awayTeam: { name: 'Dalin Myślenice' },
      matchday: 7,
      date: { dateTime: '2026-10-23T14:00:00+02:00' },
    };
    const canonical = buildNormalizedMatchId({ ...match }, ctx);
    const legacy = getLegacyScheduleIdAliases(match, ctx);
    expect(legacy.length).toBeGreaterThan(0);
    expect(legacy).not.toContain(canonical);
    const normalized: any = ensureMatchHasNormalizedId({ ...match }, ctx);
    expect(getMatchAliases(normalized)).toEqual(
      expect.arrayContaining(legacy.filter((a) => a !== normalized.id))
    );
  });
});
