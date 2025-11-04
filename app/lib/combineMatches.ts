function matchISO(m: any): string {
  // prefer precise UTC datetime, fall back to date-only at UTC midnight
  return m?.date?.dateTime ?? m?.utcDate ?? (m?.date?.date ? `${m.date.date}T00:00:00.000Z` : '');
}

export function combineAllMatches(response: any) {
  if (!response || !Array.isArray(response.fixtures)) {
    return [];
  }

  const all = response.fixtures.flatMap((f: { leagues: any }) =>
    (f.leagues ?? []).flatMap((l: { matches: any }) => l.matches ?? [])
  );

  const sorted = all.sort((a: any, b: any) => {
    const isoA = matchISO(a);
    const isoB = matchISO(b);

    // day keys in UTC (YYYY-MM-DD)
    const dayA = isoA ? new Date(isoA).toISOString().slice(0, 10) : '';
    const dayB = isoB ? new Date(isoB).toISOString().slice(0, 10) : '';

    if (dayA !== dayB) {
      // earlier day first
      return dayA < dayB ? -1 : 1;
    }

    // same day → sort by distance (closer first)
    // const distA =
    //   typeof a._distanceKm === 'number' && isFinite(a._distanceKm)
    //     ? a._distanceKm
    //     : Number.POSITIVE_INFINITY;
    // const distB =
    //   typeof b._distanceKm === 'number' && isFinite(b._distanceKm)
    //     ? b._distanceKm
    //     : Number.POSITIVE_INFINITY;

    // if (distA !== distB) {
    //   return distA - distB;
    // }

    // tie-breaker: time within the day
    const tA = isoA ? new Date(isoA).getTime() : 0;
    const tB = isoB ? new Date(isoB).getTime() : 0;
    if (tA !== tB) {
      return tA - tB;
    }

    // final tie-breaker: stable-ish by teams
    const aKey = `${a?.homeTeam?.name ?? ''} vs ${a?.awayTeam?.name ?? ''}`;
    const bKey = `${b?.homeTeam?.name ?? ''} vs ${b?.awayTeam?.name ?? ''}`;
    return aKey.localeCompare(bKey);
  });

  return sorted;
}
