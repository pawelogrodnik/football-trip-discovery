export const fixturesLoaders: Record<string, { name: string; load: () => Promise<any> }[]> = {
  ITALY: [{ name: 'Serie A', load: () => import('./../fixtures/LOCAL/fixtures_SA.json') }],
  GERMANY: [{ name: 'Bundesliga', load: () => import('./../fixtures/LOCAL/fixtures_BL1.json') }],
  EUROPE: [
    { name: 'Champions League', load: () => import('./../fixtures/EU/fixtures_UCL.json') },
    { name: 'Conference League', load: () => import('./../fixtures/EU/fixtures_UECL.json') },
    { name: 'Europa League', load: () => import('./../fixtures/EU/fixtures_UEL.json') },
  ],
  FRANCE: [{ name: 'Ligue 1', load: () => import('./../fixtures/LOCAL/fixtures_FL1.json') }],
  SPAIN: [{ name: 'La Liga', load: () => import('./../fixtures/LOCAL/fixtures_PD.json') }],
  'UNITED KINGDOM': [
    { name: 'Premier League', load: () => import('./../fixtures/LOCAL/fixtures_PL.json') },
    { name: 'Championship', load: () => import('./../fixtures/LOCAL/fixtures_ELC.json') },
  ],
};
