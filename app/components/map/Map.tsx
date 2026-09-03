'use client';

import { useEffect, useMemo, useRef } from 'react';
import L, { LatLngExpression } from 'leaflet';
import {
  focusPanOffsetPx,
  insetsToFitPadding,
  MapViewportInsets,
  normalizeInsets,
} from 'lib/mapViewport';
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  ZoomControl,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { DEFAULT_RADIUS, RADIUS_MULTIPLIER } from './../consts';
import { crestPairIcon } from './crestIcon';

import 'leaflet/dist/leaflet.css';
import './map.css';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

export type MapLocation = { label: string; lat: number; lon: number };
export type MapFocus = { lat: number; lon: number; id?: string | number } | null;

type Props = {
  initialCenter: LatLngExpression;
  initialZoom?: number;
  className?: string;
  /** All markers rendered on the map. */
  fixtures: any[];
  selectedMatchesIds: string[];
  onLocationChosen?: (loc: { label: string; lat: number; lon: number; radiusKm: number }) => void;
  /** Explicit search origin; marker shown whenever present. */
  selectedLocation?: MapLocation | null;
  selectedRadius?: number | null;
  /** Controls Circle rendering. Defaults to true when selectedLocation exists (legacy). */
  showSelectedLocationRadius?: boolean;
  /**
   * ONLY fixtures of the selected trip. Polyline is built from these.
   * undefined = legacy fallback to `fixtures` (homepage callers).
   * null / [] = no route line.
   */
  routeFixtures?: any[] | null;
  /**
   * Fixtures the viewport should fit to.
   * undefined = legacy fallback to `fixtures`.
   * null = no automatic fitting.
   */
  fitFixtures?: any[] | null;
  focus?: MapFocus;
  /**
   * Destination-level trip markers (Discover results overview).
   * Rendered as numbered circles with city labels; excluded from
   * route/fit logic. Click selects the trip via onTripMarkerClick.
   */
  tripMarkers?: TripMarker[];
  selectedTripMarkerId?: string | null;
  onTripMarkerClick?: (tripId: string) => void;
  /** Honest label on the selected-trip route line, e.g. "74 km total". */
  routeLabel?: string | null;
  /**
   * Floating-UI aware viewport insets (Discover overlays / Find sidebar
   * float above the full-size map). All fitting and focusing targets the
   * actually visible region. Defaults keep legacy symmetric padding.
   */
  viewportInsets?: Partial<MapViewportInsets>;
};

export type TripMarker = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  count: number;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const EARTH_RADIUS_METERS = 6_371_000;

function boundsForCircle(center: { lat: number; lon: number }, radiusMeters: number) {
  const lat = center.lat;
  const lon = center.lon;
  const latDelta = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const lonDelta = latDelta / Math.max(Math.cos((lat * Math.PI) / 180), 0.0001); // avoid division by zero near poles

  const southWest = L.latLng(lat - latDelta, lon - lonDelta);
  const northEast = L.latLng(lat + latDelta, lon + lonDelta);
  return L.latLngBounds(southWest, northEast);
}

function geoPoints(fixtures: any[] | undefined | null): [number, number][] {
  if (!fixtures) {
    return [];
  }
  return fixtures
    .map((f) => {
      const lat = f?.stadium?.geo?.latitude;
      const lon = f?.stadium?.geo?.longitude;
      if (typeof lat === 'number' && typeof lon === 'number') {
        return [lat, lon] as [number, number];
      }
      return null;
    })
    .filter(Boolean) as [number, number][];
}

function FlyToOnFocus({ focus, insets }: { focus?: MapFocus; insets: MapViewportInsets }) {
  const map = useMap();
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  useEffect(() => {
    if (!focus) {
      return;
    }
    map.flyTo([focus.lat, focus.lon], Math.max(map.getZoom(), 13), { duration: 0.8 });
    // Recenter the focused point into the visible region (not the raw
    // container center). Offset derives from the current insets only.
    const offset = focusPanOffsetPx(insetsRef.current);
    if (offset[0] === 0 && offset[1] === 0) {
      return;
    }
    const recenter = () => map.panBy(offset, { animate: false });
    map.once('moveend', recenter);
    return () => {
      map.off('moveend', recenter);
    };
  }, [focus, map]);
  return null;
}

export type FitPadding = {
  topLeft: [number, number];
  bottomRight: [number, number];
};

/** @deprecated Use MapViewportInsets + viewportInsets instead. */
export function fitPaddingToInsets(padding: FitPadding): MapViewportInsets {
  return {
    top: padding.topLeft[1],
    right: padding.bottomRight[0],
    bottom: padding.bottomRight[1],
    left: padding.topLeft[0],
  };
}

function FitToFixtures({
  fixtures,
  insets,
}: {
  fixtures: any[] | null | undefined;
  insets: MapViewportInsets;
}) {
  const map = useMap();
  const key = useMemo(
    () =>
      !fixtures
        ? ''
        : fixtures
            .map((f) =>
              String(
                f?._id ?? f?.id ?? `${f?.stadium?.geo?.latitude},${f?.stadium?.geo?.longitude}`
              )
            )
            .sort()
            .join('|'),
    [fixtures]
  );
  const paddingKey = `${insets.top},${insets.right},${insets.bottom},${insets.left}`;
  useEffect(() => {
    if (!fixtures || fixtures.length < 2) {
      return;
    }
    const points = geoPoints(fixtures);
    if (points.length < 2) {
      return;
    }
    const bounds = L.latLngBounds(points);
    const padding = insetsToFitPadding(insets);
    const t = setTimeout(() => {
      map.fitBounds(bounds, {
        paddingTopLeft: L.point(...padding.topLeft),
        paddingBottomRight: L.point(...padding.bottomRight),
      });
    }, 300);
    return () => {
      clearTimeout(t);
    };
  }, [key, paddingKey, map]);
  return null;
}

function ViewportController({
  selectedLocation,
  radiusMeters,
  fallbackCenter,
  hasFitTargets,
  showCircle,
  insets,
}: {
  selectedLocation?: { lat: number; lon: number } | null;
  radiusMeters: number;
  fallbackCenter: LatLngExpression;
  hasFitTargets: boolean;
  showCircle: boolean;
  insets: MapViewportInsets;
}) {
  const map = useMap();
  const insetsKey = `${insets.top},${insets.right},${insets.bottom},${insets.left}`;
  useEffect(() => {
    if (
      showCircle &&
      selectedLocation &&
      typeof selectedLocation.lat === 'number' &&
      typeof selectedLocation.lon === 'number' &&
      !hasFitTargets
    ) {
      const bounds = boundsForCircle(
        { lat: selectedLocation.lat, lon: selectedLocation.lon },
        radiusMeters
      );
      const padding = insetsToFitPadding(insets);
      const fit = () =>
        map.fitBounds(bounds, {
          paddingTopLeft: L.point(...padding.topLeft),
          paddingBottomRight: L.point(...padding.bottomRight),
        });
      if ((map as unknown as { _loaded?: boolean })?._loaded) {
        fit();
      } else {
        map.once('load', fit);
      }
      return;
    }
    if (hasFitTargets) {
      return;
    }
    map.flyTo(fallbackCenter, map.getZoom(), { duration: 0.5 });
  }, [
    selectedLocation?.lat,
    selectedLocation?.lon,
    radiusMeters,
    fallbackCenter,
    hasFitTargets,
    showCircle,
    insetsKey,
    map,
  ]);
  return null;
}

function fixtureId(fixture: any): string {
  const lat = fixture?.stadium?.geo?.latitude;
  const lon = fixture?.stadium?.geo?.longitude;
  return String(fixture._id ?? fixture.id ?? `${lat},${lon}`);
}

export default function MapWithSearch({
  initialCenter,
  initialZoom = 12,
  className = 'map-inner',
  selectedLocation,
  selectedRadius,
  showSelectedLocationRadius,
  selectedMatchesIds,
  fixtures,
  routeFixtures,
  fitFixtures,
  focus,
  tripMarkers,
  selectedTripMarkerId,
  onTripMarkerClick,
  routeLabel,
  viewportInsets,
}: Props) {
  const markerRefs = useRef<Record<string, L.Marker>>({});
  const insets = useMemo(() => normalizeInsets(viewportInsets), [viewportInsets]);
  const radiusMeters = useMemo(
    () => clamp(selectedRadius || DEFAULT_RADIUS * RADIUS_MULTIPLIER, 5, 1000) * 1000,
    [selectedRadius]
  );

  // Explicit semantics with legacy fallbacks for existing callers:
  const showCircle = showSelectedLocationRadius ?? Boolean(selectedLocation);
  const fitTargets = fitFixtures === undefined ? fixtures : fitFixtures;
  // routeFixtures undefined => legacy: polyline from all fixtures.
  // Discover passes explicit array (possibly empty) to avoid meaningless lines.
  const routeSource = routeFixtures === undefined ? fixtures : (routeFixtures ?? []);

  const center = useMemo<LatLngExpression>(() => {
    if (selectedLocation) {
      return [selectedLocation.lat, selectedLocation.lon];
    }
    return initialCenter;
  }, [selectedLocation, initialCenter]);

  const markerData = useMemo(() => {
    return fixtures
      .map((fixture) => {
        const lat = fixture?.stadium?.geo?.latitude;
        const lon = fixture?.stadium?.geo?.longitude;
        if (typeof lat !== 'number' || typeof lon !== 'number') {
          return null;
        }
        const id = fixtureId(fixture);
        return {
          fixture,
          id,
          position: [lat, lon] as [number, number],
          defaultIcon: crestPairIcon(
            fixture.homeTeam?.crest,
            fixture.awayTeam?.crest,
            fixture.homeTeam?.name,
            fixture.awayTeam?.name,
            false
          ),
          kickoff: new Date(fixture.date?.dateTime ?? fixture.utcDate ?? '').toLocaleString(),
        };
      })
      .filter(Boolean) as Array<{
      fixture: any;
      id: string;
      position: [number, number];
      defaultIcon: L.DivIcon;
      kickoff: string;
    }>;
  }, [fixtures]);

  // Order map for numbering selected-trip markers: id -> sequence index
  const routeOrder = useMemo(() => {
    const map = new Map<string, number>();
    routeSource.forEach((f: any, i: number) => {
      const id = fixtureId(f);
      if (!map.has(id)) {
        map.set(id, i + 1);
      }
    });
    return map;
  }, [routeSource]);

  const polylinePositions = useMemo(() => {
    const pts = geoPoints(routeSource);
    if (pts.length < 2) {
      return null;
    }
    // Preserve routeFixtures order (trip sequence), not marker render order
    return pts;
  }, [routeSource]);

  const tripMarkerData = useMemo(() => {
    if (!tripMarkers || tripMarkers.length === 0) {
      return [];
    }
    return tripMarkers
      .filter(
        (m) =>
          typeof m.lat === 'number' &&
          typeof m.lon === 'number' &&
          Number.isFinite(m.lat) &&
          Number.isFinite(m.lon)
      )
      .map((m) => ({
        ...m,
        icon: L.divIcon({
          html: `<div class="trip-marker${m.id === selectedTripMarkerId ? ' trip-marker--selected' : ''}"><span>${m.count}</span></div>`,
          className: 'trip-marker-icon',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
      }));
    // Permanent city labels only for readable counts; denser sets use hover tooltips.
  }, [tripMarkers, selectedTripMarkerId]);

  const showTripLabels = tripMarkerData.length > 0 && tripMarkerData.length <= 12;

  useEffect(() => {
    const ids = new Set(markerData.map(({ id }) => id));
    Object.keys(markerRefs.current).forEach((existingId) => {
      if (!ids.has(existingId)) {
        delete markerRefs.current[existingId];
      }
    });
  }, [markerData]);

  useEffect(() => {
    const selection = new Set(selectedMatchesIds?.map(String));
    markerData.forEach(({ fixture, id }) => {
      const marker = markerRefs.current[id];
      if (!marker) {
        return;
      }
      const isSelected = selection.has(id);
      marker.setIcon(
        crestPairIcon(
          fixture.homeTeam?.crest,
          fixture.awayTeam?.crest,
          fixture.homeTeam?.name,
          fixture.awayTeam?.name,
          isSelected,
          routeOrder.get(id)
        )
      );
    });
  }, [markerData, selectedMatchesIds, routeOrder]);

  return (
    <div className="map-wrapper">
      <div className={className}>
        <MapContainer
          center={center}
          zoom={initialZoom}
          zoomControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <ZoomControl position="bottomright" />
          <ViewportController
            selectedLocation={selectedLocation ?? null}
            radiusMeters={radiusMeters}
            fallbackCenter={initialCenter}
            hasFitTargets={(fitTargets?.length ?? 0) > 1}
            showCircle={showCircle}
            insets={insets}
          />
          <FitToFixtures fixtures={fitTargets} insets={insets} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM contributors</a>'
          />
          {selectedLocation && (
            <>
              <Marker position={[selectedLocation.lat, selectedLocation.lon]}>
                <Popup>
                  <div className="text-sm font-medium">{selectedLocation.label}</div>
                  <div className="text-xs">
                    Radius: {clamp(selectedRadius || DEFAULT_RADIUS, 5, 1000)} km
                  </div>
                </Popup>
              </Marker>

              {showCircle && (
                <Circle
                  center={[selectedLocation.lat, selectedLocation.lon]}
                  radius={radiusMeters}
                />
              )}
            </>
          )}
          {polylinePositions && (
            <Polyline
              positions={polylinePositions}
              pathOptions={{ color: '#228be6', weight: 3, opacity: 0.7, dashArray: '6 8' }}
            >
              {routeLabel && (
                <Tooltip permanent direction="center" className="route-label">
                  {routeLabel}
                </Tooltip>
              )}
            </Polyline>
          )}
          <MarkerClusterGroup
            chunkedLoading
            spiderfyOnEveryZoom
            showCoverageOnHover={false}
            maxClusterRadius={60}
            iconCreateFunction={(cluster: { getChildCount: () => any }) => {
              const count = cluster.getChildCount();
              return L.divIcon({
                html: `<div class="rlc-bubble">${count}</div>`,
                className: 'rlc-cluster-icon',
                iconSize: [36, 36],
              });
            }}
          >
            <FlyToOnFocus focus={focus} insets={insets} />
            {tripMarkerData.map((m) => (
              <Marker
                key={`trip-${m.id}`}
                position={[m.lat, m.lon]}
                icon={m.icon}
                eventHandlers={{
                  click: () => {
                    onTripMarkerClick?.(m.id);
                  },
                }}
              >
                {showTripLabels ? (
                  <Tooltip
                    permanent
                    direction="bottom"
                    offset={[0, 12]}
                    className="trip-marker-label"
                  >
                    {m.label}
                  </Tooltip>
                ) : (
                  <Tooltip direction="top" offset={[0, -20]}>
                    {m.label} · {m.count}
                  </Tooltip>
                )}
              </Marker>
            ))}
            {markerData.map(({ fixture, id, position, defaultIcon, kickoff }) => (
              <Marker
                key={id}
                position={position}
                icon={defaultIcon}
                ref={(ref) => {
                  if (ref) {
                    markerRefs.current[id] = ref as unknown as L.Marker;
                  }
                }}
              >
                <Popup>
                  <div className="text-sm font-medium">
                    {fixture.homeTeam.name} vs {fixture.awayTeam.name}
                  </div>
                  <div className="text-xs">{kickoff}</div>
                  <div className="text-xs" style={{ opacity: 0.7 }}>
                    {fixture.competition?.name}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  );
}
