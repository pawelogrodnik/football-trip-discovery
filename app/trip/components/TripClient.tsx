'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconAlertCircle, IconCopy, IconPencil } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'components/providers/LocaleProvider';
import { combineAllMatches } from 'lib/combineMatches';
import { panelViewportInsets } from 'lib/mapViewport';
import {
  buildFindUrl,
  deriveFindContextFromMatches,
  FindSearchCriteria,
  parseDateOnlyLocal,
  TRIP_PATH,
} from 'lib/tripUrls';
import { Alert, Button, Group, Paper, ScrollArea, Stack, Text } from '@mantine/core';
import MapWrapper from '../../components/map/MapWrapper';
import SharedMatchCard from '../../components/matchCard/SharedMatchCard';
import { MOBILE_VIEW } from '../../components/view-toggle/consts';
import ViewToggle from '../../components/view-toggle/ViewToggle';
import {
  dedupeMatches,
  formatDayHeader,
  formatShortDayRange,
  groupMatchesByDay,
  LooseMatch,
  matchIdOf,
  selectedTripRange,
  sortMatchesChronologically,
} from '../../find/components/findResultsUtils';
import classes from '../trip.module.css';

const INITIAL_CENTER = [57.0727808, 21.9262208] as [number, number];

type FetchState = 'idle' | 'loading' | 'success' | 'error';

const parseNumberParam = (value: string | null) => {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function venueCoords(match: LooseMatch): { lat: number; lon: number } | null {
  const lat = match?.stadium?.geo?.latitude;
  const lon = match?.stadium?.geo?.longitude;
  return typeof lat === 'number' && typeof lon === 'number' ? { lat, lon } : null;
}

export default function TripClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('TripPage');
  const locale = useLocale();
  const [mobileView, setMobileView] = useState(MOBILE_VIEW.LIST_VIEW);
  const [isMobile, setIsMobile] = useState(false);
  const [mapFocus, setMapFocus] = useState<{
    lat: number;
    lon: number;
    id?: string | number;
  } | null>(null);
  const [hoveredMatchId, setHoveredMatchId] = useState<string | null>(null);
  const [state, setState] = useState<{ matches: LooseMatch[]; totalCount: number }>({
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

  // Search/edit context only — never displayed as trip metadata.
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

  useEffect(() => {
    setIsMobile(window.innerWidth <= 720);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition((loc) => {
      if (loc?.coords?.latitude && loc?.coords?.longitude) {
        setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      }
    });
  }, []);

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
        const sanitized = matches.map((match: LooseMatch) => {
          if (typeof match._distanceKm === 'number') {
            return match;
          }
          const { _distanceKm: _ignored, ...rest } = match;
          return rest as LooseMatch;
        });
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

  const sortedMatches = useMemo(() => {
    const combined = combineAllMatches({
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
    }) as LooseMatch[];
    // by-ids can return the same fixture under two id forms — never render it twice.
    return sortMatchesChronologically(dedupeMatches(combined));
  }, [state.matches]);

  const matchesForMap = useMemo(
    () => sortedMatches.filter((m) => venueCoords(m) !== null),
    [sortedMatches]
  );

  // Deduped count is the truth — raw API totalCount can include duplicates
  // when the same fixture was requested under two id forms.
  const displayedCount = sortedMatches.length;

  // Map selection must use the same canonical ids as marker identity.
  const tripSelectedIds = useMemo(() => sortedMatches.map((m) => matchIdOf(m)), [sortedMatches]);

  // Displayed trip metadata derives from ACTUAL SELECTED FIXTURES,
  // never from the original Find search window.
  const range = useMemo(() => selectedTripRange(sortedMatches), [sortedMatches]);
  const rangeLabel = useMemo(
    () =>
      range.startISO && range.endISO
        ? formatShortDayRange(range.startISO, range.endISO, locale)
        : '',
    [range, locale]
  );
  const compactLabel = useMemo(
    () => sharedLocation?.label?.split(',')[0]?.trim() || '',
    [sharedLocation]
  );
  const tripMeta = useMemo(() => {
    const parts = [
      compactLabel,
      rangeLabel,
      range.count > 0
        ? range.dayCount <= 1
          ? t('oneDay')
          : t('days', { count: range.dayCount })
        : '',
      t('matchCount', { count: displayedCount }),
    ].filter(Boolean);
    return parts.join(' · ');
  }, [compactLabel, rangeLabel, range, displayedCount, t]);

  const groups = useMemo(() => groupMatchesByDay(sortedMatches), [sortedMatches]);

  const initialCenter = useMemo<[number, number]>(() => {
    if (sharedLocation) {
      return [sharedLocation.lat, sharedLocation.lon];
    }
    if (matchesForMap.length === 1) {
      const coords = venueCoords(matchesForMap[0]);
      if (coords) {
        return [coords.lat, coords.lon];
      }
    }
    if (userLocation) {
      return [userLocation.lat, userLocation.lon];
    }
    return INITIAL_CENTER;
  }, [sharedLocation, matchesForMap, userLocation]);

  const navigationOrigin =
    userLocation ?? sharedLocation ?? (mapFocus ? { lat: mapFocus.lat, lon: mapFocus.lon } : null);

  const navigationUrlFactory = useMemo(
    () => (match: LooseMatch) => {
      const coords = venueCoords(match);
      if (!coords) {
        return null;
      }
      const params = new URLSearchParams({
        api: '1',
        destination: `${coords.lat},${coords.lon}`,
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
  const shouldRenderPanel = !isMobile || !shouldRenderMobileMap;

  // Measure the real rendered panel so map insets track the actual
  // obstruction — same mechanism as /find, no second offset system.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelSize, setPanelSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        setPanelSize({ width: rect.width, height: rect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [shouldRenderPanel, state.totalCount]);

  const mapViewportInsets = useMemo(
    () =>
      panelViewportInsets({
        panelWidthPx: panelSize?.width ?? null,
        panelHeightPx: panelSize?.height ?? null,
        panelVisible: shouldRenderPanel && displayedCount > 0,
        isMobile,
      }),
    [panelSize, shouldRenderPanel, displayedCount, isMobile]
  );

  const handleMatchClick = (match: LooseMatch) => {
    const coords = venueCoords(match);
    if (coords) {
      setMapFocus({ ...coords, id: matchIdOf(match) });
    }
  };

  const copyUrl = async () => {
    try {
      const canonical = `${window.location.origin}${TRIP_PATH}?${searchParams.toString()}`;
      await navigator.clipboard.writeText(canonical);
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
      const derived = deriveFindContextFromMatches(
        state.matches as unknown as Array<Record<string, unknown>>
      );
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

  return (
    <main className={classes.tripShell} data-testid="trip-view">
      <div className={classes.mapArea} data-testid="trip-map">
        {shouldRenderMap && (
          <MapWrapper
            initialCenter={initialCenter}
            initialZoom={12}
            fixtures={matchesForMap}
            selectedMatchesIds={tripSelectedIds}
            hoveredMatchId={hoveredMatchId}
            routeFixtures={matchesForMap}
            fitFixtures={matchesForMap}
            showSelectedLocationRadius={false}
            focus={mapFocus}
            viewportInsets={mapViewportInsets}
          />
        )}
      </div>

      {isMobile && displayedCount > 0 && (
        <div className={classes.mobileToggle}>
          <ViewToggle onChange={setMobileView} />
        </div>
      )}

      {shouldRenderPanel && (
        <Paper
          ref={panelRef}
          radius="lg"
          shadow="xl"
          p="md"
          className={classes.tripPanel}
          data-testid="trip-panel"
        >
          <div className={classes.tripHeader} data-testid="trip-header">
            <Text fw={700} size="lg" truncate title={compactLabel || undefined}>
              {t('title')}
            </Text>
            <Text size="sm" c="dimmed" mt={2} data-testid="trip-meta">
              {tripMeta}
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
          </div>
          {status === 'loading' && (
            <Text size="sm" c="dimmed" data-testid="trip-loading">
              {t('loading')}
            </Text>
          )}
          {status === 'error' && error && (
            <Alert color="red" icon={<IconAlertCircle size={16} />} data-testid="trip-error">
              {error}
            </Alert>
          )}
          {status !== 'loading' && displayedCount === 0 && !error && (
            <p className="no-matches-found" data-testid="trip-empty">
              {ids.length === 0 ? t('emptyNoIds') : t('emptyNotFound')}
            </p>
          )}
          {displayedCount > 0 && (
            <ScrollArea className={classes.tripScroll} type="auto" data-testid="trip-results-list">
              <Stack gap={8} pb={8}>
                {groups.map((g) => (
                  <div key={g.dayKey}>
                    <Text
                      size="xs"
                      fw={700}
                      c="dimmed"
                      data-testid={`trip-day-${g.dayKey}`}
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                        background: 'var(--mantine-color-body)',
                        padding: '6px 2px 4px',
                      }}
                    >
                      {formatDayHeader(g.dateTime, locale)}
                    </Text>
                    <Stack gap={8} mt={2}>
                      {g.matches.map((m) => {
                        const id = matchIdOf(m);
                        return (
                          <SharedMatchCard
                            key={id || `${g.dayKey}-${m.homeTeam?.name}-${m.awayTeam?.name}`}
                            match={m}
                            variant="trip"
                            testIdPrefix="trip-match-card"
                            hovered={hoveredMatchId === id}
                            navigationHref={navigationUrlFactory(m)}
                            onFocus={handleMatchClick}
                            onHover={setHoveredMatchId}
                          />
                        );
                      })}
                    </Stack>
                  </div>
                ))}
              </Stack>
            </ScrollArea>
          )}
          {missingIds.length > 0 && (
            <Alert color="yellow" mt="sm" data-testid="trip-missing">
              {t('missingWarning', { ids: missingIds.map((v) => `"${v}"`).join(', ') })}
            </Alert>
          )}
        </Paper>
      )}
    </main>
  );
}
