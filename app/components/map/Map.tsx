'use client';

import { useEffect, useMemo, useRef } from 'react';
import L, { LatLngExpression } from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
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

type Props = {
  initialCenter: LatLngExpression;
  selectedLocation?: { label: string; lat: number; lon: number };
  selectedRadius?: number;
  initialZoom?: number;
  className?: string;
  selectedMatchesIds: string[];
  onLocationChosen?: (loc: { label: string; lat: number; lon: number; radiusKm: number }) => void;
  fixtures: any[];
  focus: {
    lat: number;
    lon: number;
    id?: string | number;
  } | null;
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

function FlyToOnFocus({
  focus,
}: {
  focus?: { lat: number; lon: number; id?: string | number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focus) {
      return;
    }
    map.flyTo([focus.lat, focus.lon], Math.max(map.getZoom(), 13), { duration: 0.8 });
  }, [focus, map]);
  return null;
}

function ViewportController({
  selectedLocation,
  radiusMeters,
  fallbackCenter,
}: {
  selectedLocation?: { lat: number; lon: number } | null;
  radiusMeters: number;
  fallbackCenter: LatLngExpression;
}) {
  const map = useMap();
  useEffect(() => {
    if (
      selectedLocation &&
      typeof selectedLocation.lat === 'number' &&
      typeof selectedLocation.lon === 'number'
    ) {
      const bounds = boundsForCircle(
        { lat: selectedLocation.lat, lon: selectedLocation.lon },
        radiusMeters
      );
      const fit = () => map.fitBounds(bounds, { padding: [32, 32] });
      if ((map as any)?._loaded) {
        fit();
      } else {
        map.once('load', fit);
      }
      return;
    }
    map.flyTo(fallbackCenter, map.getZoom(), { duration: 0.5 });
  }, [selectedLocation?.lat, selectedLocation?.lon, radiusMeters, fallbackCenter, map]);
  return null;
}

export default function MapWithSearch({
  initialCenter,
  initialZoom = 12,
  className = 'map-inner',
  selectedLocation,
  selectedRadius,
  selectedMatchesIds,
  fixtures,
  focus,
}: Props) {
  const markerRefs = useRef<Record<string, L.Marker>>({});
  const radiusMeters = useMemo(
    () => clamp(selectedRadius || DEFAULT_RADIUS * RADIUS_MULTIPLIER, 5, 1000) * 1000,
    [selectedRadius]
  );

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
        const id = String(fixture._id ?? fixture.id ?? `${lat},${lon}`);
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
          isSelected
        )
      );
    });
  }, [markerData, selectedMatchesIds]);

  return (
    <div className="map-wrapper">
      <div className={className}>
        <MapContainer center={center} zoom={initialZoom} style={{ height: '100%', width: '100%' }}>
          <ViewportController
            selectedLocation={selectedLocation ?? null}
            radiusMeters={radiusMeters}
            fallbackCenter={initialCenter}
          />
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

              <Circle center={[selectedLocation.lat, selectedLocation.lon]} radius={radiusMeters} />
            </>
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
            <FlyToOnFocus focus={focus} />
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
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  );
}
