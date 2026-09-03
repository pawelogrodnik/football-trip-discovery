'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconAlertCircle, IconCopy, IconPencil } from '@tabler/icons-react';
import { useTranslations } from 'components/providers/LocaleProvider';
import { combineAllMatches } from 'lib/combineMatches';
import {
  buildFindUrl,
  deriveFindContextFromMatches,
  FindSearchCriteria,
  parseDateOnlyLocal,
  toDateOnlyLocal,
} from 'lib/tripUrls';
import { Alert, Button, Group, Paper, Text } from '@mantine/core';
import MapWrapper from './map/MapWrapper';
import MatchList from './matchList/matchList';
import { MOBILE_VIEW } from './view-toggle/consts';
import ViewToggle from './view-toggle/ViewToggle';

const INITIAL_CENTER = [57.0727808, 21.9262208] as [number, number];

type FetchState = 'idle' | 'loading' | 'success' | 'error';

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
  const t = useTranslations('TripPage');
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
  const [copied, setCopied] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

  const ids = useMemo(() => {
    const collected = [...searchParams.getAll('ids'), ...searchParams.getAll('id')].flatMap(
      (entry) => entry.split(',')
    );
    const trimmed = collected.map((id) => id.trim()).filter(Boolean);
    return Array.from(new Set(trimmed));
  }, [searchParams]);

  const tripContext = useMemo(() => {
    const lat = parseNumberParam(searchParams.get('lat'));
    const lon = parseNumberParam(searchParams.get('lon'));
    const radius = parseNumberParam(searchParams.get('radius'));
    const label = searchParams.get('label') ?? searchParams.get('locationLabel');
    const startDate = parseDateOnlyLocal(searchParams.get('startDate'));
    const endDate = parseDateOnlyLocal(searchParams.get('endDate'));
    const location =
      lat !== null && lon !== null
        ? {
            lat,
            lon,
            label: label || 'Trip area',
          }
        : null;
    return {
      location,
      radius: radius ?? undefined,
      startDate,
      endDate,
    };
  }, [searchParams]);

  const sharedLocation = tripContext.location;
  const sharedRadius = tripContext.radius;
  const [initialCenter, setInitialCenter] = useState<[number, number]>(
    sharedLocation ? [sharedLocation.lat, sharedLocation.lon] : INITIAL_CENTER
  );

  useEffect(() => {
    setIsMobile(window.innerWidth <= 720);
  }, []);

  useEffect(() => {
    if (sharedLocation) {
      setInitialCenter([sharedLocation.lat, sharedLocation.lon]);
    } else {
      setInitialCenter(INITIAL_CENTER);
    }

    if (typeof window === 'undefined' || !navigator?.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition((loc) => {
      if (loc?.coords?.latitude && loc?.coords?.longitude) {
        const currentLocation = { lat: loc.coords.latitude, lon: loc.coords.longitude };
        setUserLocation(currentLocation);
        if (!sharedLocation) {
          setInitialCenter([currentLocation.lat, currentLocation.lon]);
        }
      }
    });
  }, [searchParams]);

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
        const sanitized = matches.map((match: { _distanceKm: unknown }) => ({
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
  }, [searchParams]);

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
        (match: { stadium: { geo: { latitude: unknown; longitude: unknown } } }) =>
          typeof match?.stadium?.geo?.latitude === 'number' &&
          typeof match?.stadium?.geo?.longitude === 'number'
      ),
    [matchesCombined]
  );

  const navigationOrigin =
    userLocation ?? sharedLocation ?? (mapFocus ? { lat: mapFocus.lat, lon: mapFocus.lon } : null);

  const navigationUrlFactory = useMemo(
    () => (match: { stadium?: { geo?: { latitude?: unknown; longitude?: unknown } } }) => {
      const lat = match?.stadium?.geo?.latitude;
      const lon = match?.stadium?.geo?.longitude;
      if (typeof lat !== 'number' || typeof lon !== 'number') {
        return null;
      }
      const params = new URLSearchParams({
        api: '1',
        destination: `${lat},${lon}`,
      });
      if (navigationOrigin) {
        params.set('origin', `${navigationOrigin.lat},${navigationOrigin.lon}`);
      }
      return `https://www.google.com/maps/dir/?${params.toString()}`;
    },
    [navigationOrigin]
  );

  const shouldRenderMobileMap = isMobile && mobileView === MOBILE_VIEW.MAP_VIEW;
  const shouldRenderMap = !isMobile || shouldRenderMobileMap;

  const handleMatchClick = (match: {
    stadium?: { geo?: { latitude?: unknown; longitude?: unknown } };
    _id?: unknown;
    id?: unknown;
  }) => {
    const lat = match?.stadium?.geo?.latitude;
    const lon = match?.stadium?.geo?.longitude;
    if (typeof lat === 'number' && typeof lon === 'number') {
      setMapFocus({ lat, lon, id: String(match._id ?? match.id ?? '') });
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — keep button state unchanged
    }
  };

  const handleEditTrip = () => {
    let location = sharedLocation;
    let radiusKm = typeof sharedRadius === 'number' ? sharedRadius : 50;
    let startDate = tripContext.startDate;
    let endDate = tripContext.endDate;
    if (!location || !startDate || !endDate) {
      const derived = deriveFindContextFromMatches(state.matches);
      location = location ?? derived.location;
      startDate = startDate ?? derived.startDate;
      endDate = endDate ?? derived.endDate;
      if (typeof sharedRadius !== 'number') {
        radiusKm = derived.radiusKm;
      }
    }
    if (!location) {
      return;
    }
    const criteria: FindSearchCriteria = { location, startDate, endDate, radiusKm };
    router.push(buildFindUrl(criteria, ids, { mode: 'customize' }));
  };

  const dateRangeLabel =
    tripContext.startDate && tripContext.endDate
      ? `${toDateOnlyLocal(tripContext.startDate)} → ${toDateOnlyLocal(tripContext.endDate)}`
      : null;

  return (
    <main className="p-6" data-testid="trip-view">
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
              routeFixtures={matchesForMap}
              focus={mapFocus}
            />
          </div>
        )}
        {!shouldRenderMobileMap && (
          <div className="right-side">
            <Paper radius="lg" shadow="sm" p="md" mb="md" data-testid="trip-header">
              <Text fw={700} size="lg">
                {t('title')}
              </Text>
              <Text size="sm" c="dimmed" mt={2} data-testid="trip-meta">
                {t('matchCount', { count: state.totalCount })}
                {dateRangeLabel ? ` · ${dateRangeLabel}` : ''}
                {sharedLocation ? ` · ${sharedLocation.label}` : ''}
              </Text>
              <Group gap={8} mt="sm">
                <Button
                  variant="light"
                  size="sm"
                  leftSection={<IconCopy size={14} />}
                  onClick={copyUrl}
                  data-testid="trip-copy-link"
                >
                  {copied ? t('linkCopied') : t('copyLink')}
                </Button>
                <Button
                  variant="filled"
                  size="sm"
                  leftSection={<IconPencil size={14} />}
                  onClick={handleEditTrip}
                  disabled={ids.length === 0}
                  data-testid="trip-edit"
                >
                  {t('editTrip')}
                </Button>
              </Group>
            </Paper>
            {status === 'loading' && <p>{t('loading')}</p>}
            {status === 'error' && error && (
              <Alert color="red" icon={<IconAlertCircle size={16} />} data-testid="trip-error">
                {error}
              </Alert>
            )}
            {status !== 'loading' && state.totalCount === 0 && !error && (
              <p className="no-matches-found" data-testid="trip-empty">
                {ids.length === 0 ? t('emptyNoIds') : t('emptyNotFound')}
              </p>
            )}
            {state.totalCount > 0 && (
              <MatchList
                totalCount={state.totalCount}
                matches={matchesCombined}
                onGoBack={() => router.push('/find')}
                onMatchClick={handleMatchClick}
                selectedMatchesIds={[]}
                onMatchSelect={() => false}
                areMatchesSelectable={false}
                source="matches"
                getNavigationUrl={navigationUrlFactory}
                hideFooter
              />
            )}
            {missingIds.length > 0 && (
              <Alert color="yellow" mt="sm" data-testid="trip-missing">
                {t('missingWarning', { ids: missingIds.map((v) => `"${v}"`).join(', ') })}
              </Alert>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
