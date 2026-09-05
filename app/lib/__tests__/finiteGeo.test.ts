import { isCompleteFindCriteria } from 'lib/tripUrls';

jest.mock('react-leaflet', () => ({
  Circle: () => null,
  MapContainer: () => null,
  Marker: () => null,
  Polyline: () => null,
  Popup: () => null,
  TileLayer: () => null,
  Tooltip: () => null,
  useMap: () => null,
  ZoomControl: () => null,
}));

jest.mock('react-leaflet-markercluster', () => ({
  __esModule: true,
  default: () => null,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { geoPoints } = require('app/components/map/Map') as {
  geoPoints: (f: unknown) => [number, number][];
};

function criteria(lat: unknown, lon: unknown) {
  return {
    location: { label: 'Milan', lat: lat as number, lon: lon as number },
    startDate: new Date('2026-09-07T12:00:00.000'),
    endDate: new Date('2026-09-10T12:00:00.000'),
  };
}

describe('finite coordinate guards (NaN regression)', () => {
  it('E. rejects NaN / Infinity location as incomplete criteria', () => {
    expect(isCompleteFindCriteria(criteria(NaN, 19))).toBe(false);
    expect(isCompleteFindCriteria(criteria(50, NaN))).toBe(false);
    expect(isCompleteFindCriteria(criteria(Infinity, 19))).toBe(false);
    expect(isCompleteFindCriteria(criteria(50, -Infinity))).toBe(false);
    expect(isCompleteFindCriteria(criteria(50.06, 19.94))).toBe(true);
  });

  it('F. ignores fixtures with NaN stadium geo, keeps valid ones', () => {
    const fixtures = [
      { stadium: { geo: { latitude: NaN, longitude: 19.94 } } },
      { stadium: { geo: { latitude: 50.06, longitude: NaN } } },
      { stadium: { geo: { latitude: Infinity, longitude: 19.94 } } },
      { stadium: { geo: { latitude: 50.06, longitude: 19.94 } } },
    ];
    expect(geoPoints(fixtures)).toEqual([[50.06, 19.94]]);
  });

  it('geoPoints handles null/undefined input safely', () => {
    expect(geoPoints(null)).toEqual([]);
    expect(geoPoints(undefined)).toEqual([]);
    expect(geoPoints([])).toEqual([]);
  });
});
