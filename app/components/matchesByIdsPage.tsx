'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LatLngExpression } from 'leaflet';
import { combineAllMatches } from 'lib/combineMatches';
import MapWrapper from './map/MapWrapper';
import MatchList from './matchList/matchList';
import { MOBILE_VIEW } from './view-toggle/consts';
import ViewToggle from './view-toggle/ViewToggle';

const INITIAL_CENTER: LatLngExpression = [57.0727808, 21.9262208];

type FetchState = 'idle' | 'loading' | 'success' | 'error';

const toReadableList = (values: string[]) =>
  values.length ? values.map((v) => `"${v}"`).join(', ') : '';

const parseNumberParam = (value: string | null) => {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function MatchesByIdsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileView, setMobileView] = useState(MOBILE_VIEW.LIST_VIEW);
  const [isMobile, setIsMobile] = useState(false);
  const [mapFocus, setMapFocus] = useState<{
    lat: number;
    lon: number;
    id?: string | number;
  } | null>(null);
  const [state, setState] = useState<{ matches: any[]; totalCount: number }>({
    matches: [],
    totalCount: 0,
  });
  const [status, setStatus] = useState<FetchState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [missingIds, setMissingIds] = useState<string[]>([]);

  const ids = useMemo(() => {
    const collected = [...searchParams.getAll('ids'), ...searchParams.getAll('id')].flatMap(
      (entry) => entry.split(',')
    );
    const trimmed = collected.map((id) => id.trim()).filter(Boolean);
    return Array.from(new Set(trimmed));
  }, [searchParams]);

  const sharedLocationParams = useMemo(() => {
    const lat = parseNumberParam(searchParams.get('lat'));
    const lon = parseNumberParam(searchParams.get('lon'));
    const radius = parseNumberParam(searchParams.get('radius'));
    const label = searchParams.get('label') ?? searchParams.get('locationLabel');
    const location =
      lat !== null && lon !== null
        ? {
            lat,
            lon,
            label: label || 'Shared location',
          }
        : null;
    return {
      location,
      radius: radius ?? undefined,
    };
  }, [searchParams]);

  const sharedLocation = sharedLocationParams.location;
  const sharedRadius = sharedLocationParams.radius;
  const [initialCenter, setInitialCenter] = useState<LatLngExpression>(
    sharedLocation ? [sharedLocation.lat, sharedLocation.lon] : INITIAL_CENTER
  );

  useEffect(() => {
    setIsMobile(window.innerWidth <= 720);
  }, []);

  useEffect(() => {
    if (sharedLocation) {
      setInitialCenter([sharedLocation.lat, sharedLocation.lon]);
      return;
    }
    navigator.geolocation.getCurrentPosition((loc) => {
      if (loc?.coords?.latitude && loc?.coords?.longitude) {
        setInitialCenter([loc.coords.latitude, loc.coords.longitude]);
      }
    });
  }, [sharedLocation]);

  useEffect(() => {
    if (ids.length === 0) {
      setState({ matches: [], totalCount: 0 });
      setStatus('idle');
      setError(null);
      setMissingIds([]);
      return;
    }

    const controller = new AbortController();
    const query = new URLSearchParams();
    query.set('ids', ids.join(','));
    if (sharedLocation) {
      query.set('lat', String(sharedLocation.lat));
      query.set('lon', String(sharedLocation.lon));
    }
    if (typeof sharedRadius === 'number') {
      query.set('radius', String(sharedRadius));
    }

    setStatus('loading');
    setError(null);
    setMissingIds([]);

    fetch(`/api/matches/by-ids?${query.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? 'Failed to fetch matches');
        }
        const matches = Array.isArray(data.matches) ? data.matches : [];
        const sanitized = matches.map((match: { _distanceKm: any }) => ({
          ...match,
          _distanceKm: typeof match._distanceKm === 'number' ? match._distanceKm : 0,
        }));
        setState({ matches: sanitized, totalCount: data.totalCount ?? sanitized.length });
        setMissingIds(Array.isArray(data.missingIds) ? data.missingIds : []);
        setStatus('success');
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          return;
        }
        setError(err.message || 'Failed to fetch selected matches.');
        setStatus('error');
        setState({ matches: [], totalCount: 0 });
      });

    return () => controller.abort();
  }, [ids, sharedLocation, sharedRadius]);

  const matchesCombined = useMemo(
    () =>
      combineAllMatches({
        fixtures: state.matches.length
          ? [
              {
                leagues: [
                  {
                    matches: state.matches,
                  },
                ],
              },
            ]
          : [],
      }),
    [state.matches]
  );

  const matchesForMap = useMemo(
    () =>
      matchesCombined.filter(
        (match: { stadium: { geo: { latitude: any; longitude: any } } }) =>
          typeof match?.stadium?.geo?.latitude === 'number' &&
          typeof match?.stadium?.geo?.longitude === 'number'
      ),
    [matchesCombined]
  );

  const shouldRenderMobileMap = isMobile && mobileView === MOBILE_VIEW.MAP_VIEW;
  const shouldRenderMap = !isMobile || shouldRenderMobileMap;

  const handleMatchClick = (match: any) => {
    const lat = match?.stadium?.geo?.latitude;
    const lon = match?.stadium?.geo?.longitude;
    if (typeof lat === 'number' && typeof lon === 'number') {
      setMapFocus({ lat, lon, id: match._id ?? match.id });
    }
  };

  const handleGoBack = () => router.push('/');

  return (
    <main className="p-6">
      <div className={`page-inner ${isMobile ? 'page-inner--mobile' : ''}`}>
        {isMobile && state.totalCount > 0 && <ViewToggle onChange={setMobileView} />}
        {shouldRenderMap && (
          <div className="left-side">
            <MapWrapper
              initialCenter={initialCenter}
              initialZoom={12}
              selectedLocation={sharedLocation ?? undefined}
              selectedRadius={sharedRadius}
              fixtures={matchesForMap}
              focus={mapFocus}
            />
          </div>
        )}
        {!shouldRenderMobileMap && (
          <div className="right-side">
            {status === 'loading' && <p>Loading selected matches...</p>}
            {status === 'error' && error && <p className="no-matches-found">{error}</p>}
            {status !== 'loading' && state.totalCount === 0 && !error && (
              <p className="no-matches-found">
                {ids.length === 0
                  ? 'Provide match ids via "?ids=match1,match2" to see results.'
                  : 'No matches found for provided ids.'}
              </p>
            )}
            {state.totalCount > 0 && (
              <MatchList
                totalCount={state.totalCount}
                matches={matchesCombined}
                onGoBack={handleGoBack}
                onMatchClick={handleMatchClick}
                selectedMatchesIds={[]}
                onMatchSelect={() => false}
                areMatchesSelectable={false}
                source="matches"
              />
            )}
            {missingIds.length > 0 && (
              <p className="no-matches-found">
                Missing matches for ids: {toReadableList(missingIds)}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
