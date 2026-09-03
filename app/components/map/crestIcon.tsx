// app/lib/crestIcon.ts
import L from 'leaflet';
import { initials } from './../../lib/initials';

const iconCache = new Map<string, L.DivIcon>();

export function crestPairIcon(
  homeUrl?: string | null,
  awayUrl?: string | null,
  homeName?: string,
  awayName?: string,
  isSelected?: boolean,
  orderLabel?: number | null,
  highlighted?: boolean
) {
  const order = typeof orderLabel === 'number' && orderLabel > 0 ? String(orderLabel) : '';
  const key = `${homeUrl || ''}|${awayUrl || ''}|${homeName || ''}|${awayName || ''}|${
    isSelected ? 'selected' : 'default'
  }|${order}|${highlighted ? 'hot' : 'cold'}`;
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
  const htmlClasses = isSelected
    ? `crest-pair crest-pair--selected${highlighted ? ' crest-pair--hovered' : ''}`
    : `crest-pair${highlighted ? ' crest-pair--hovered' : ''}`;
  const badge = order ? `<div class="crest-order">${order}</div>` : '';
  const html = `
    <div class="${htmlClasses}">
      ${badge}
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
