import { promises as fs } from 'fs';
import path from 'path';

type Loader = { name: string; load: () => Promise<any> };

const POLAND_PROVINCES_LIST = [
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
  POLAND_PROVINCES_LIST.find((p) => p.code === code)?.name || '';

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
    {
      name: 'Coppa Italia',
      load: () => import('./../fixtures/LOCAL/ITALY/fixtures_ITALY_CUP.json'),
    },
  ],
  GERMANY: [
    { name: 'Bundesliga', load: () => import('./../fixtures/LOCAL/GERMANY/fixtures_BL1.json') },
    {
      name: 'Bundesliga 2',
      load: () => import('./../fixtures/LOCAL/GERMANY/fixtures_BUNDESLIGA_2.json'),
    },
    {
      name: 'Bundesliga 3',
      load: () => import('./../fixtures/LOCAL/GERMANY/fixtures_BUNDESLIGA_3.json'),
    },
  ],
  EUROPE: [
    { name: 'Champions League', load: () => import('./../fixtures/EU/fixtures_UCL.json') },
    { name: 'Conference League', load: () => import('./../fixtures/EU/fixtures_UECL.json') },
    { name: 'Europa League', load: () => import('./../fixtures/EU/fixtures_UEL.json') },
  ],
  FRANCE: [
    { name: 'Ligue 1', load: () => import('./../fixtures/LOCAL/FRANCE/fixtures_FL1.json') },
    {
      name: 'Ligue 2',
      load: () => import('./../fixtures/LOCAL/FRANCE/fixtures_FRANCE_LIGUE_2.json'),
    },
  ],
  SPAIN: [
    { name: 'La Liga', load: () => import('./../fixtures/LOCAL/SPAIN/fixtures_PD.json') },
    {
      name: 'Copa del Rey',
      load: () => import('./../fixtures/LOCAL/SPAIN/fixtures_SPAIN_CUP.json'),
    },
    {
      name: 'LaLiga2',
      load: () => import('./../fixtures/LOCAL/SPAIN/fixtures_SPAIN_LA_LIGA_2.json'),
    },
  ],
  'UNITED KINGDOM': [
    {
      name: 'Premier League',
      load: () => import('./../fixtures/LOCAL/UNITED_KINGDOM/fixtures_PL.json'),
    },
    {
      name: 'Championship',
      load: () => import('./../fixtures/LOCAL/UNITED_KINGDOM/fixtures_ELC.json'),
    },
    {
      name: 'League One',
      load: () => import('./../fixtures/LOCAL/UNITED_KINGDOM/fixtures_ENGLAND_LEAGUE_ONE.json'),
    },
    {
      name: 'League Two',
      load: () => import('./../fixtures/LOCAL/UNITED_KINGDOM/fixtures_ENGLAND_LEAGUE_TWO.json'),
    },
    {
      name: 'Premiership (Scotland)',
      load: () => import('./../fixtures/LOCAL/SCOTLAND/fixtures_SCOTLAND_LEAGUE_1.json'),
    },
    {
      name: 'Cymru Premier',
      load: () => import('./../fixtures/LOCAL/WALES/fixtures_WALES_LEAGUE_1.json'),
    },
  ],
  NETHERLANDS: [
    { name: 'Eredivisie', load: () => import('./../fixtures/LOCAL/NETHERLANDS/fixtures_DED.json') },
  ],
  GREECE: [
    {
      name: 'Super League',
      load: () => import('./../fixtures/LOCAL/GREECE/fixtures_GRECCE_SUPER_LEAGUE.json'),
    },
  ],
  HUNGARY: [
    {
      name: 'NB I. (Hungary 1 League)',
      load: () => import('./../fixtures/LOCAL/HUNGARY/fixtures_HUNGARY_NB_I.json'),
    },
  ],
  BULGARIA: [
    {
      name: 'efbet League (BULGARIA 1 League)',
      load: () => import('./../fixtures/LOCAL/BULGARIA/fixtures_BULGARIA_LEAGUE_1.json'),
    },
  ],
  CYPRUS: [
    {
      name: 'Cyprus League',
      load: () => import('./../fixtures/LOCAL/CYPRUS/fixtures_CYPRUS_LEAGUE_1.json'),
    },
  ],
  DENMARK: [
    {
      name: 'Superliga (Denmark)',
      load: () => import('./../fixtures/LOCAL/DENMARK/fixtures_DENMARK_LEAGUE_1.json'),
    },
  ],
  SWEDEN: [
    {
      name: 'Allsvenskan',
      load: () => import('./../fixtures/LOCAL/SWEDEN/fixtures_SWEDEN_LEAGUE_1.json'),
    },
  ],
  TURKEY: [
    {
      name: 'Super Lig',
      load: () => import('./../fixtures/LOCAL/TURKEY/fixtures_TURKEY_LEAGUE_1.json'),
    },
    {
      name: '1. Lig (Turkey 2 League)',
      load: () => import('./../fixtures/LOCAL/TURKEY/fixtures_TURKEY_LEAGUE_2.json'),
    },
  ],
  MEXICO: [
    {
      name: 'Liga MX (Mexico 1 League)',
      load: () => import('./../fixtures/LOCAL/MEXICO/fixtures_MEXICO_LIGA_MX.json'),
    },
  ],
  NORWAY: [
    {
      name: 'Eliteserien (Norway 1 League)',
      load: () => import('./../fixtures/LOCAL/NORWAY/fixtures_NORWAY_ELITESERIEN.json'),
    },
  ],
  PORTUGAL: [
    {
      name: 'Primeira Liga',
      load: () => import('./../fixtures/LOCAL/PORTUGAL/fixtures_PPL.json'),
    },
  ],
  BRAZIL: [
    {
      name: 'Campeonato Brasileiro Série A',
      load: () => import('./../fixtures/LOCAL/BRAZIL/fixtures_BSA.json'),
    },
  ],
  ROMANIA: [
    {
      name: 'Superliga (Romania 1 League)',
      load: () => import('./../fixtures/LOCAL/ROMANIA/fixtures_ROMANIA_SUPERLIGA.json'),
    },
  ],
  SERBIA: [
    {
      name: 'Mozzart Bet Super Liga (Serbia 1 League)',
      load: () => import('./../fixtures/LOCAL/SERBIA/fixtures_SERBIA_1_LEAGUE.json'),
    },
  ],
  SWITZERLAND: [
    {
      name: 'Super League (Switzerland 1 League)',
      load: () => import('./../fixtures/LOCAL/SWITZERLAND/fixtures_SWITZERLAND_1_LEAGUE.json'),
    },
  ],
  SLOVAKIA: [
    {
      name: 'Nike liga',
      load: () => import('./../fixtures/LOCAL/SLOVAKIA/fixtures_SLOVAKIA_1_LIGA.json'),
    },
  ],
  CZECHIA: [
    {
      name: 'Chance Liga',
      load: () => import('./../fixtures/LOCAL/CZECH-REPUBLIC/fixtures_CHANCE_LIGA.json'),
    },
  ],
  CROATIA: [
    {
      name: 'HNL (Croatia 1 League)',
      load: () => import('./../fixtures/LOCAL/CROATIA/fixtures_CROATIA_HNL.json'),
    },
  ],
  AUSTRIA: [
    {
      name: 'Bundesliga (Austria)',
      load: () => import('./../fixtures/LOCAL/AUSTRIA/fixtures_AUSTRIA_BUNDESLIGA.json'),
    },
    {
      name: '2. Liga (Austria)',
      load: () => import('./../fixtures/LOCAL/AUSTRIA/fixtures_AUSTRIA_2_LIGA.json'),
    },
  ],
  'UNITED STATES OF AMERICA': [
    {
      name: 'MLS',
      load: () => import('./../fixtures/LOCAL/USA/fixtures_USA_MLS.json'),
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

export const getFixturesForRegion = async (regionCode: string = 'PL-PK'): Promise<any[]> => {
  const regionDir = path.join(
    process.cwd(), // directory of this file
    'app',
    'fixtures',
    'LOCAL',
    'POLAND',
    regionCode
  );

  const relativeForImport = `./../fixtures/LOCAL/POLAND/${regionCode}`;

  try {
    await fs.access(regionDir);
  } catch {
    return [];
  }

  const entries = await fs.readdir(regionDir, { withFileTypes: true });

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name);

  const result = await Promise.all(
    files.map(async (file) => {
      const fullPath = path.join(regionDir, file);
      const raw = await fs.readFile(fullPath, 'utf8');
      const data = JSON.parse(raw);

      return {
        name: data.competitionName,
        load: () => import(`${relativeForImport}/${file}`),
        count: data.count,
      };
    })
  );

  return result;
};

export const POLAND_FIXTURES_BY_REGION = async (): Promise<Record<string, Loader[]>> => ({
  'PL-PK': [
    ...(await getFixturesForRegion('PL-PK')),

    {
      name: 'Polish III League (grupa IV)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_IV.json'),
    },
  ],
  'PL-MA': [
    ...(await getFixturesForRegion('PL-MA')),
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
    {
      name: 'Polish IV League (Świętokrzyskie)',
      load: () =>
        import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_IV_LEAGUE_SWIETOKRZYSKIE.json'),
    },
  ],
  'PL-LU': [
    {
      name: 'Polish III League (grupa IV)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_IV.json'),
    },
    {
      name: 'Polish IV League (Lubelskie)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_IV_LEAGUE_LUBELSKIE.json'),
    },
  ],
  'PL-LD': [
    {
      name: 'Polish III League (grupa I)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_I.json'),
    },
    {
      name: 'Polish IV League (Łódzkie)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_IV_LEAGUE_LODZKIE.json'),
    },
  ],
  'PL-MZ': [
    ...(await getFixturesForRegion('PL-MZ')),
    {
      name: 'Polish III League (grupa I)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_I.json'),
    },
  ],
  'PL-PD': [
    {
      name: 'Polish III League (grupa I)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_I.json'),
    },
    {
      name: 'Polish IV League (Podlaskie)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_IV_LEAGUE_PODLASKIE.json'),
    },
  ],
  'PL-WN': [
    {
      name: 'Polish III League (grupa I)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_I.json'),
    },
    {
      name: 'Polish IV League (Warmińsko-Mazurskie)',
      load: () =>
        import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_IV_LEAGUE_WARMINSKO_MAZURSKIE.json'),
    },
  ],
  'PL-KP': [
    {
      name: 'Polish III League (grupa I)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_II.json'),
    },
    {
      name: 'Polish IV League (Kujawsko-Pomorskie)',
      load: () =>
        import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_IV_LEAGUE_KUJAWSKO_POMORSKIE.json'),
    },
  ],
  'PL-PM': [
    {
      name: 'Polish III League (grupa I)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_II.json'),
    },
    {
      name: 'Polish IV League (Pomorskie)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_IV_LEAGUE_POMORSKIE.json'),
    },
  ],
  'PL-WP': [
    {
      name: 'Polish III League (grupa I)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_II.json'),
    },
    {
      name: 'Polish IV League (Wielkopolskie)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_IV_LEAGUE_WIELKOPOLSKIE.json'),
    },
  ],
  'PL-ZP': [
    {
      name: 'Polish III League (grupa I)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_II.json'),
    },
    {
      name: 'Polish IV League (Zachodniopomorskie)',
      load: () =>
        import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_IV_LEAGUE_ZACHODNIOPOMORSKIE.json'),
    },
  ],
  'PL-DS': [
    {
      name: 'Polish III League (grupa I)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_III.json'),
    },
    {
      name: 'Polish IV League (Dolnośląskie)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_IV_LEAGUE_DOLNOSLASKIE.json'),
    },
  ],
  'PL-LB': [
    {
      name: 'Polish III League (grupa I)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_III.json'),
    },
    {
      name: 'Polish IV League (Lubuskie)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_IV_LEAGUE_LUBUSKIE.json'),
    },
  ],
  'PL-OP': [
    {
      name: 'Polish III League (grupa I)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_III.json'),
    },
  ],
  'PL-SL': [
    ...(await getFixturesForRegion('PL-SL')),
    {
      name: 'Polish III League (grupa I)',
      load: () => import('./../fixtures/LOCAL/POLAND/fixtures_POLISH_III_LEAGUE_GRUPA_III.json'),
    },
  ],
});
