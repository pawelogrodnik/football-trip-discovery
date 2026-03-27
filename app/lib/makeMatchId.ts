import { createHash } from 'crypto';

export function makeMatchId(match: any, country?: string, league?: string) {
  const rawParts = [
    country,
    league,
    match?.competition?.code ?? match?.competition?.name,
    match?.homeTeam?.name,
    match?.awayTeam?.name,
    match?.date?.dateTime ?? match?.utcDate ?? match?.date?.date,
  ].filter(Boolean);

  if (rawParts.length === 0) {
    return '';
  }

  return createHash('md5').update(rawParts.join('|')).digest('hex');
}
