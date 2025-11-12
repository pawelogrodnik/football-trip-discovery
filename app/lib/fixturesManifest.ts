type Loader = { name: string; load: () => Promise<any> };

const POLAND_PROVINDES_LIST = [
  { name: 'PODKARPACIE', code: 'PL-PK' },
  { name: 'PODLASKIE', code: 'PL-PD' },
  { name: 'ŁÓDZKIE', code: 'PL-LD' },
  { name: 'DOLNOŚLĄSKIE', code: 'PL-DS' },
  { name: 'OPOLSKIE', code: 'PL-OP' },
  { name: 'ŚWIĘTOKRZYSKIE', code: 'PL-SK' },
  { name: 'MAZOWIECKIE', code: 'PL-MZ' },
  { name: 'WIELKOPOLSKIE', code: 'PL-WP' },
  { name: 'MAŁOPOLSKA', code: 'PL-MA' },
  { name: 'Lubusz Voivodeship', code: 'PL-LB' },
  { name: 'KUJAWSKO-POMORSKIE', code: 'PL-KP' },
  { name: 'POMORSKIE', code: 'PL-PM' },
  { name: 'ZACHODNIO-POMORSKIE', code: 'PL-ZP' },
  { name: 'LUBELSKIE', code: 'PL-LU' },
  { name: 'WARMIŃSKO-MAZURSKIE', code: 'PL-WN' },
  { name: 'ŚLĄSKIE', code: 'PL-SL' },
];

export const getProvinceName = (code: string): string =>
  POLAND_PROVINDES_LIST.find((p) => p.code === code)?.name || '';

export const BASE_FIXTURES: Record<string, Loader[]> = {
  ITALY: [
    { name: 'Serie A', load: () => import('./../fixtures/LOCAL/ITALY/fixtures_SA.json') },
    { name: 'Serie B', load: () => import('./../fixtures/LOCAL/ITALY/fixtures_SERIE_B.json') },
    {
      name: 'Serie C Gr A',
      load: () => import('./../fixtures/LOCAL/ITALY/fixtures_SERIE_C_GR_A.json'),
    },
    {
      name: 'Serie C Gr B',
      load: () => import('./../fixtures/LOCAL/ITALY/fixtures_SERIE_C_GR_B.json'),
    },
    {
      name: 'Serie C Gr C',
      load: () => import('./../fixtures/LOCAL/ITALY/fixtures_SERIE_C_GR_C.json'),
    },
  ],
  GERMANY: [
    { name: 'Bundesliga', load: () => import('./../fixtures/LOCAL/GERMANY/fixtures_BL1.json') },
  ],
  EUROPE: [
    { name: 'Champions League', load: () => import('./../fixtures/EU/fixtures_UCL.json') },
    { name: 'Conference League', load: () => import('./../fixtures/EU/fixtures_UECL.json') },
    { name: 'Europa League', load: () => import('./../fixtures/EU/fixtures_UEL.json') },
  ],
  FRANCE: [{ name: 'Ligue 1', load: () => import('./../fixtures/LOCAL/FRANCE/fixtures_FL1.json') }],
  SPAIN: [{ name: 'La Liga', load: () => import('./../fixtures/LOCAL/SPAIN/fixtures_PD.json') }],
  'UNITED KINGDOM': [
    {
      name: 'Premier League',
      load: () => import('./../fixtures/LOCAL/UNITED_KINGDOM/fixtures_PL.json'),
    },
    {
      name: 'Championship',
      load: () => import('./../fixtures/LOCAL/UNITED_KINGDOM/fixtures_ELC.json'),
    },
  ],
  NETHERLANDS: [
    { name: 'Eredivisie', load: () => import('./../fixtures/LOCAL/NETHERLANDS/fixtures_DED.json') },
  ],
  BRAZIL: [
    {
      name: 'Campeonato Brasileiro Série A',
      load: () => import('./../fixtures/LOCAL/BRAZIL/fixtures_BSA.json'),
    },
  ],
  POLAND: [
    {
      name: 'Ekstraklasa',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_EKSTRAKLASA.json'),
    },
    {
      name: 'Polish I League',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_I_LEAGUE.json'),
    },
    {
      name: 'Polish II League',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_II_LEAGUE.json'),
    },

    {
      name: 'Polish Cup',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_CUP.json'),
    },
  ],
};

export const POLAND_FIXTURES_BY_REGION: Record<string, Loader[]> = {
  'PL-PK': [
    {
      name: 'Polish IV League (Podkarpacie)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_IV_LEAGUE_PODKARPACIE.json'),
    },
    {
      name: 'Polish A Klasa (Dębica)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_DEBICA_A_KLASA.json'),
    },
    {
      name: 'Polish A Klasa (Lubaczów)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_LUBACZOW_A_KLASA.json'),
    },
    {
      name: 'Polish III League (grupa IV)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_IV.json'),
    },
  ],
  'PL-MA': [
    {
      name: 'Polish V League (Małopolskie)',
      load: () =>
        import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_V_LEAGUE_MALOPOLSKA_ZACHOD.json'),
    },
    {
      name: 'Polish A Klasa (Chrzanów)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_CHRZANOW_A_KLASA.json'),
    },
    {
      name: 'Polish A Klasa (Kraków)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_KRAKOW_A_KLASA_GRUPA_II.json'),
    },
    {
      name: 'Polish III League (grupa IV)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_IV.json'),
    },
  ],
  'PL-SK': [
    {
      name: 'Polish III League (grupa IV)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_IV.json'),
    },
  ],
  'PL-LU': [
    {
      name: 'Polish III League (grupa IV)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_IV.json'),
    },
  ],
};
