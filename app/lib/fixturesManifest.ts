export const fixturesLoaders: Record<string, { name: string; load: () => Promise<any> }[]> = {
  ITALY: [
    { name: 'Serie A', load: () => import('./../fixtures/LOCAL/fixtures_SA.json') },
    { name: 'Serie B', load: () => import('./../fixtures/LOCAL/fixtures_SERIE_B.json') },
    { name: 'Serie C Gr A', load: () => import('./../fixtures/LOCAL/fixtures_SERIE_C_GR_A.json') },
    { name: 'Serie C Gr B', load: () => import('./../fixtures/LOCAL/fixtures_SERIE_C_GR_B.json') },
    { name: 'Serie C Gr C', load: () => import('./../fixtures/LOCAL/fixtures_SERIE_C_GR_C.json') },
  ],
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
  NETHERLANDS: [
    { name: 'Eredivisie', load: () => import('./../fixtures/LOCAL/fixtures_DED.json') },
  ],
  BRAZIL: [
    {
      name: 'Campeonato Brasileiro Série A',
      load: () => import('./../fixtures/LOCAL/fixtures_BSA.json'),
    },
  ],
  POLAND: [
    { name: 'Ekstraklasa', load: () => import('./../fixtures/LOCAL/fixtures_EKSTRAKLASA.json') },
    {
      name: 'Polish I League',
      load: () => import('./../fixtures/LOCAL/fixtures_POLISH_I_LEAGUE.json'),
    },
    {
      name: 'Polish II League',
      load: () => import('./../fixtures/LOCAL/fixtures_POLISH_II_LEAGUE.json'),
    },
    {
      name: 'Polish III League (grupa IV)',
      load: () => import('./../fixtures/LOCAL/fixtures_POLISH_III_LEAGUE_GRUPA_IV.json'),
    },
    {
      name: 'Polish IV League (Podkarpacie)',
      load: () => import('./../fixtures/LOCAL/fixtures_POLISH_IV_LEAGUE_PODKARPACIE.json'),
    },
    {
      name: 'Polish V League (Małopolskie)',
      load: () => import('./../fixtures/LOCAL/fixtures_POLISH_V_LEAGUE_MALOPOLSKA_ZACHOD.json'),
    },
    { name: 'Polish Cup', load: () => import('./../fixtures/LOCAL/fixtures_POLISH_CUP.json') },
    {
      name: 'Polish A Klasa (Chrzanów)',
      load: () => import('./../fixtures/LOCAL/fixtures_POLISH_CHRZANOW_A_KLASA.json'),
    },
    {
      name: 'Polish A Klasa (Kraków)',
      load: () => import('./../fixtures/LOCAL/fixtures_POLISH_KRAKOW_A_KLASA_GRUPA_II.json'),
    },
    {
      name: 'Polish A Klasa (Dębica)',
      load: () => import('./../fixtures/LOCAL/fixtures_POLISH_DEBICA_A_KLASA.json'),
    },
    {
      name: 'Polish A Klasa (Lubaczów)',
      load: () => import('./../fixtures/LOCAL/fixtures_POLISH_LUBACZOW_A_KLASA.json'),
    },
  ],
};
