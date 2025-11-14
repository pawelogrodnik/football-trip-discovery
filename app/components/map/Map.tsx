'use client';

import { useEffect, useMemo, useRef } from 'react';
import L, { LatLng, LatLngExpression } from 'leaflet';
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
  onLocationChosen?: (loc: { label: string; lat: number; lon: number; radiusKm: number }) => void;
  fixtures: any[];
  focus: {
    lat: number;
    lon: number;
    id?: string | number;
  } | null;
};

function FlyTo({ lat, lon, zoom = 12 }: { lat: number; lon: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(new LatLng(lat, lon), zoom, { duration: 0.8 });
  }, [lat, lon, zoom, map]);
  return null;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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

function FlyToInitialCenter({ initialCenter }: { initialCenter: LatLngExpression }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) {
      return;
    }
    map.flyTo(initialCenter, Math.max(map.getZoom(), 13), { duration: 0.8 });
  }, [initialCenter]);
  return null;
}

export default function MapWithSearch({
  initialCenter,
  initialZoom = 12,
  className = 'map-inner',
  selectedLocation,
  selectedRadius,
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

  return (
    <div className="map-wrapper">
      <div className={className}>
        <MapContainer center={center} zoom={initialZoom} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM contributors</a>'
          />
          {selectedLocation && (
            <>
              <FlyTo lat={selectedLocation.lat} lon={selectedLocation.lon} />
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
            <FlyToInitialCenter initialCenter={initialCenter} />
            <FlyToOnFocus focus={focus} />
            {fixtures.map((fixture) => {
              const when = new Date(
                fixture.date?.dateTime ?? fixture.utcDate ?? ''
              ).toLocaleString();
              const lat = fixture.stadium.geo.latitude;
              const lon = fixture.stadium.geo.longitude;
              const id = String(fixture._id ?? fixture.id ?? `${lat},${lon}`);
              return (
                <Marker
                  key={fixture.id}
                  position={[fixture.stadium.geo.latitude, fixture.stadium.geo.longitude]}
                  icon={crestPairIcon(
                    fixture.homeTeam?.crest,
                    fixture.awayTeam?.crest,
                    fixture.homeTeam?.name,
                    fixture.awayTeam?.name
                  )}
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
                    <div className="text-xs">{when}</div>
                  </Popup>
                </Marker>
              );
            })}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  );
}
