import { createHash } from 'crypto';

export function makeMatchId(match: any, country: string, league: string) {
  if (match.id) {
    return String(match.id);
  }

  const raw = [
    country,
    league,
    match?.competition?.code,
    match?.homeTeam?.name,
    match?.awayTeam?.name,
    match?.date?.dateTime ?? match?.utcDate ?? match?.date?.date,
  ]
    .filter(Boolean)
    .join('|');

  return createHash('md5').update(raw).digest('hex');
}
