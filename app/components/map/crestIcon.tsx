// app/lib/crestIcon.ts
import L from 'leaflet';
import { initials } from './../../lib/initials';

const iconCache = new Map<string, L.DivIcon>();

export function crestPairIcon(
  homeUrl?: string,
  awayUrl?: string,
  homeName?: string,
  awayName?: string,
  isSelected?: boolean
) {
  const key = `${homeUrl || ''}|${awayUrl || ''}|${homeName || ''}|${awayName || ''}`;
  const hit = iconCache.get(key);
  if (hit) {
    return hit;
  }

  const home = homeUrl
    ? `<img src="${homeUrl}" referrerpolicy="no-referrer" class="crest-img" alt="${homeName || ''}" />`
    : `<div class="crest-fallback">${initials(homeName)}</div>`;

  const away = awayUrl
    ? `<img src="${awayUrl}" referrerpolicy="no-referrer" class="crest-img" alt="${awayName || ''}" />`
    : `<div class="crest-fallback">${initials(awayName)}</div>`;
  const htmlClasses = isSelected ? 'crest-pair crest-pair--selected' : 'crest-pair';
  const html = `
    <div class="${htmlClasses}">
      <div class="crest">${home}</div>
      <div class="crest">${away}</div>
    </div>
  `;

  const icon = L.divIcon({
    html,
    className: 'crest-icon', // we style this in CSS
    iconSize: [44, 28], // width x height
    iconAnchor: [22, 28], // bottom-center
    popupAnchor: [0, -28],
  });

  iconCache.set(key, icon);
  return icon;
}
