/**
 * Single source of truth for competition importance.
 *
 * Used by trip cards (team crest order, competition logo order, featured
 * match), category ranking (UEFA counts) and the details drawer.
 * Higher number = more important. Deterministic, no hardcoded clubs.
 */

export type CompetitionRef = {
  name?: string | null;
  code?: string | null;
};

/** Lowercase, diacritics-free, "uefa "-prefixed variants collapsed. */
export function normalizeCompetitionName(raw: string): string {
  const lowered = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return lowered.replace(/^uefa /, '');
}

const TIER_1 = new Map<string, number>([
  ['champions league', 3],
  ['europa league', 2],
  ['conference league', 1],
]);

const TIER_1_CODES = new Map<string, number>([
  ['UCL', 3],
  ['UEL', 2],
  ['UECL', 1],
]);

const TIER_2_NAMES = new Set([
  'premier league',
  'serie a',
  'la liga',
  'primera division',
  'bundesliga',
  'ligue 1',
  'eredivisie',
  'primeira liga',
  'belgian pro league',
  'super lig',
  'superliga',
  'ekstraklasa',
  'scottish premiership',
  'austrian bundesliga',
  'swiss super league',
  'danish superliga',
  'allsvenskan',
  'eliteserien',
  'veikkausliiga',
  'croatian hnl',
  'czech first league',
  'slovak first league',
  'ukrainian premier league',
  'romanian liga i',
  'bulgarian first league',
  'hungarian nb i',
  'polish ekstraklasa',
]);

const TIER_2_CODES = new Set(['PL', 'SA', 'PD', 'BL1', 'FL1', 'DED', 'PPL']);

const TIER_3_NAMES = new Set([
  'serie b',
  'championship',
  '2 bundesliga',
  'segunda division',
  'ligue 2',
  'eerste divisie',
  'segunda liga',
  'i liga',
  'polish i league',
  'ii liga',
  'polish ii league',
  'fa cup',
  'coppa italia',
  'copa del rey',
  'dfb pokal',
  'coupe de france',
  'knvb beker',
  'taca de portugal',
  'turkish cup',
  'polish cup',
  'puchar polski',
  'scottish cup',
  'efl cup',
  'carabao cup',
  'coppa italia serie c',
]);

const CUP_KEYWORDS = [
  'cup',
  'coppa',
  'copa',
  'pokal',
  'puchar',
  'coupe',
  'beker',
  'taca',
  'trophy',
  'supercup',
  'super cup',
];

// Second/third-tier names that appear with sponsor prefixes (e.g. "Betclic 1 Liga").
const SECOND_TIER_KEYWORDS = ['1 liga', '2 liga', 'serie b'];

const TIER_4_KEYWORDS = [
  'serie c',
  'serie d',
  'league one',
  'league two',
  'national league',
  '3 liga',
  'iii liga',
  'iv liga',
  'v liga',
  'klasa',
  'okregowa',
  'regional',
  'oberliga',
  'regionalliga',
];

/** 1 (European) .. 4 (lower levels), 0 = unknown/empty. */
export function getCompetitionTier(comp: CompetitionRef | string | null | undefined): number {
  if (!comp) {
    return 0;
  }
  const raw = typeof comp === 'string' ? comp : (comp.name ?? comp.code ?? '');
  const code = (typeof comp === 'string' ? '' : (comp.code ?? '')).toUpperCase().trim();
  const name = normalizeCompetitionName(raw);
  if (!name && !code) {
    return 0;
  }
  if ((code && TIER_1_CODES.has(code)) || TIER_1.has(name)) {
    return 1;
  }
  if ((code && TIER_2_CODES.has(code)) || TIER_2_NAMES.has(name)) {
    return 2;
  }
  if (
    TIER_3_NAMES.has(name) ||
    CUP_KEYWORDS.some((k) => name.includes(k)) ||
    SECOND_TIER_KEYWORDS.some((k) => name.includes(k))
  ) {
    return 3;
  }
  if (TIER_4_KEYWORDS.some((k) => name.includes(k))) {
    return 4;
  }
  return 0;
}

/**
 * Numeric priority for sorting (higher = more important).
 * European: UCL > UEL > UECL, then top domestic, cups/second tier,
 * lower levels, unknown last.
 */
export function getCompetitionPriority(comp: CompetitionRef | string | null | undefined): number {
  if (!comp) {
    return 0;
  }
  const raw = typeof comp === 'string' ? comp : (comp.name ?? comp.code ?? '');
  const code = (typeof comp === 'string' ? '' : (comp.code ?? '')).toUpperCase().trim();
  const name = normalizeCompetitionName(raw);
  const sub1 = (code ? (TIER_1_CODES.get(code) ?? 0) : 0) || TIER_1.get(name) || 0;
  if (sub1 > 0) {
    return 400 + sub1;
  }
  const tier = getCompetitionTier(comp);
  if (tier === 1) {
    return 400;
  }
  if (tier === 2) {
    return 300;
  }
  if (tier === 3) {
    return 200;
  }
  if (tier === 4) {
    return 100;
  }
  return name ? 50 : 0;
}

/** True for Champions / Europa / Conference League (any naming variant). */
export function isUefaCompetition(comp: CompetitionRef | string | null | undefined): boolean {
  return getCompetitionTier(comp) === 1;
}
