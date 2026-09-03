'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconAlertCircle, IconArrowLeft } from '@tabler/icons-react';
import { useTranslations } from 'components/providers/LocaleProvider';
import { combineAllMatches } from 'lib/combineMatches';
import { panelViewportInsets } from 'lib/mapViewport';
import {
  buildTripUrl,
  FIND_DEFAULT_RADIUS_KM,
  FindSearchCriteria,
  isCompleteFindCriteria,
  matchIdOfLoose,
  parseFindSearchParams,
  toDateOnlyLocal,
} from 'lib/tripUrls';
import { ActionIcon, Alert, Button, Paper, Text } from '@mantine/core';
import MapWrapper from '../../components/map/MapWrapper';
import MatchList from '../../components/matchList/matchList';
import { MOBILE_VIEW } from '../../components/view-toggle/consts';
import ViewToggle from '../../components/view-toggle/ViewToggle';
import FindSearchForm from './FindSearchForm';
import FindSearchSummary from './FindSearchSummary';
import classes from '../find.module.css';

const FIND_CENTER = [50, 10] as unknown as [number, number];

function criteriaFromUrl(searchParams: URLSearchParams): {
  criteria: FindSearchCriteria;
  ids: string[];
  mode: string | null;
} {
  const parsed = parseFindSearchParams(searchParams);
  return {
    criteria: {
      location: parsed.location,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      radiusKm: parsed.radiusKm,
    },
    ids: parsed.ids,
    mode: parsed.mode,
  };
}

export default function FindMatchesClient() {
  const t = useTranslations('FindMatches');
  const router = useRouter();
  const searchParams = useSearchParams();

  const initial = useMemo(() => criteriaFromUrl(new URLSearchParams(searchParams.toString())), []);

  const [criteria, setCriteria] = useState<FindSearchCriteria>(initial.criteria);
  const [submitted, setSubmitted] = useState<FindSearchCriteria | null>(null);
  const [editing, setEditing] = useState(false);
  const [fixtures, setFixtures] = useState<{ fixtures: unknown[]; totalCount?: number }>({
    fixtures: [],
    totalCount: undefined,
  });
  const [extraMatches, setExtraMatches] = useState<Record<string, unknown>[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initial.ids);
  const [mapFocus, setMapFocus] = useState<{
    lat: number;
    lon: number;
    id?: string | number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [mobileView, setMobileView] = useState(MOBILE_VIEW.LIST_VIEW);
  const [isMobile, setIsMobile] = useState(false);
  const autoSearched = useRef(false);

  const customizeMode = initial.mode === 'customize';

  useEffect(() => {
    setIsMobile(window.innerWidth <= 720);
  }, []);

  const runSearch = useCallback(async (c: FindSearchCriteria, preselected: string[]) => {
    if (!isCompleteFindCriteria(c)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        lat: String(c.location!.lat),
        lon: String(c.location!.lon),
        radius: String(c.radiusKm),
        startDate: toDateOnlyLocal(c.startDate!),
        endDate: toDateOnlyLocal(c.endDate!),
      });
      const res = await fetch(`/api/matches?${q.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Search failed');
      }
      setFixtures(data);
      setSubmitted(c);
      setEditing(false);
      setHasSearched(true);

      // Preserve preselected matches missing from radius results via by-ids.
      const foundIds = new Set(
        (combineAllMatches(data) as Array<{ _id?: unknown; id?: unknown }>).map(matchIdOfLoose)
      );
      const missing = preselected.filter((id) => !foundIds.has(String(id)));
      if (missing.length > 0) {
        try {
          const bq = new URLSearchParams({ ids: missing.join(',') });
          bq.set('lat', String(c.location!.lat));
          bq.set('lon', String(c.location!.lon));
          const bres = await fetch(`/api/matches/by-ids?${bq.toString()}`);
          const bdata = await bres.json();
          if (bres.ok && Array.isArray(bdata.matches)) {
            setExtraMatches(bdata.matches);
          } else {
            setExtraMatches([]);
          }
        } catch {
          setExtraMatches([]);
        }
      } else {
        setExtraMatches([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Customize mode: auto-run once with URL criteria.
  useEffect(() => {
    if (autoSearched.current) {
      return;
    }
    if (initial.mode === 'customize' && isCompleteFindCriteria(initial.criteria)) {
      autoSearched.current = true;
      setSelectedIds(initial.ids);
      void runSearch(initial.criteria, initial.ids);
    }
  }, []);

  const apiMatches = useMemo(
    () => (hasSearched ? (combineAllMatches(fixtures) as Array<Record<string, unknown>>) : []),
    [fixtures, hasSearched]
  );

  const allMatches = useMemo(() => {
    if (extraMatches.length === 0) {
      return apiMatches;
    }
    const seen = new Set(
      apiMatches.map((m) => matchIdOfLoose(m as { _id?: unknown; id?: unknown }))
    );
    return [
      ...apiMatches,
      ...extraMatches.filter(
        (m) => !seen.has(matchIdOfLoose(m as { _id?: unknown; id?: unknown }))
      ),
    ];
  }, [apiMatches, extraMatches]);

  const totalCount = hasSearched ? allMatches.length : undefined;

  const toggleMatchSelection = useCallback((rawId: string | number) => {
    if (rawId === null || rawId === undefined) {
      return;
    }
    const id = String(rawId);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleMatchClick = useCallback(
    (match: {
      stadium?: { geo?: { latitude?: unknown; longitude?: unknown } };
      _id?: unknown;
      id?: unknown;
    }) => {
      const lat = match?.stadium?.geo?.latitude;
      const lon = match?.stadium?.geo?.longitude;
      if (typeof lat === 'number' && typeof lon === 'number') {
        setMapFocus({ lat, lon, id: matchIdOfLoose(match) });
      }
    },
    []
  );

  const handleCreateTrip = useCallback(() => {
    const c = submitted ?? criteria;
    router.push(buildTripUrl(c, selectedIds));
  }, [router, submitted, criteria, selectedIds]);

  const showSearch = !hasSearched || editing;
  const activeCriteria = submitted ?? criteria;

  const shouldRenderMobileMap = isMobile && mobileView === MOBILE_VIEW.MAP_VIEW;
  const shouldRenderMap = !isMobile || shouldRenderMobileMap || !hasSearched;
  const shouldRenderPanel = !isMobile || !shouldRenderMobileMap;

  // Measure the real rendered panel so the map right/bottom inset tracks
  // the actual obstruction (no hardcoded sidebar width).
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
  }, [hasSearched, showSearch, shouldRenderPanel]);

  const panelVisible = hasSearched && !showSearch && shouldRenderPanel;
  const mapViewportInsets = useMemo(
    () =>
      panelViewportInsets({
        panelWidthPx: panelSize?.width ?? null,
        panelHeightPx: panelSize?.height ?? null,
        panelVisible,
        isMobile,
      }),
    [panelSize, panelVisible, isMobile]
  );

  return (
    <main className={classes.findShell} data-testid="find-view">
      <div
        className={`${classes.mapArea} ${showSearch ? classes.mapDimmed : ''}`}
        data-testid="find-map"
      >
        {shouldRenderMap && (
          <MapWrapper
            initialCenter={FIND_CENTER}
            initialZoom={4}
            fixtures={allMatches}
            selectedMatchesIds={selectedIds}
            selectedLocation={activeCriteria.location}
            selectedRadius={activeCriteria.radiusKm ?? FIND_DEFAULT_RADIUS_KM}
            showSelectedLocationRadius={hasSearched && !showSearch}
            routeFixtures={[]}
            fitFixtures={hasSearched ? allMatches : null}
            focus={mapFocus}
            viewportInsets={mapViewportInsets}
          />
        )}
      </div>

      {showSearch && <div className={classes.dimOverlay} aria-hidden />}
      {isMobile && hasSearched && !showSearch && (
        <div className={classes.mobileToggle}>
          <ViewToggle onChange={setMobileView} />
        </div>
      )}

      {showSearch && (
        <div className={classes.searchCenter} data-testid="find-search">
          <Paper radius="lg" shadow="xl" p="xl" className={classes.searchPaper}>
            <FindSearchForm
              criteria={criteria}
              onChange={setCriteria}
              onSubmit={() => {
                setSelectedIds((prev) => (hasSearched ? prev : []));
                if (!hasSearched) {
                  setExtraMatches([]);
                }
                void runSearch(criteria, hasSearched ? selectedIds : []);
              }}
              loading={loading}
              error={error}
            />
            {hasSearched && (
              <Button
                mt="sm"
                variant="subtle"
                fullWidth
                data-testid="find-cancel-editing"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setCriteria(submitted ?? criteria);
                }}
              >
                {t('cancel')}
              </Button>
            )}
          </Paper>
        </div>
      )}

      {hasSearched && !showSearch && submitted && (
        <FindSearchSummary
          criteria={submitted}
          customizeMode={customizeMode}
          onEdit={() => {
            setCriteria(submitted);
            setEditing(true);
            setError(null);
          }}
        />
      )}

      {hasSearched && !showSearch && shouldRenderPanel && (
        <Paper
          ref={panelRef}
          radius="lg"
          shadow="xl"
          p="md"
          className={classes.resultsPanel}
          data-testid="find-results-panel"
        >
          {loading ? (
            <Text size="sm" c="dimmed" data-testid="find-loading">
              {t('loading')}
            </Text>
          ) : error ? (
            <Alert color="red" icon={<IconAlertCircle size={16} />} data-testid="find-error">
              {error}
            </Alert>
          ) : allMatches.length === 0 ? (
            <div data-testid="find-empty-state">
              <Text fw={600}>{t('emptyTitle')}</Text>
              <Text size="sm" c="dimmed" mt={4}>
                {t('emptyHint', {
                  label: submitted?.location?.label ?? '',
                })}
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                {t('emptyRecovery')}
              </Text>
              <Button
                mt="sm"
                variant="light"
                fullWidth
                data-testid="find-edit-search"
                onClick={() => {
                  setEditing(true);
                  setError(null);
                }}
              >
                {t('editSearch')}
              </Button>
            </div>
          ) : (
            <>
              <div className={classes.resultsHeader} data-testid="find-results-header">
                <ActionIcon
                  variant="default"
                  aria-label={t('editSearch')}
                  onClick={() => {
                    setEditing(true);
                    setError(null);
                  }}
                  data-testid="find-back-to-search"
                >
                  <IconArrowLeft style={{ width: '70%', height: '70%' }} stroke={1.5} />
                </ActionIcon>
                <div className={classes.resultsHeaderTitle}>
                  <Text fw={700}>{t('matchesNearby', { count: allMatches.length })}</Text>
                  <Text size="xs" c="dimmed">
                    {submitted?.startDate && submitted?.endDate
                      ? `${toDateOnlyLocal(submitted.startDate)} → ${toDateOnlyLocal(submitted.endDate)}`
                      : ''}{' '}
                    ·{' '}
                    {t('withinRadius', {
                      km: submitted?.radiusKm ?? 0,
                      label: submitted?.location?.label ?? '',
                    })}
                  </Text>
                </div>
                {/* {customizeMode && (
                  <Text size="xs" c="dimmed" mt={4} data-testid="find-customize-notice-list">
                    {t('customizeModeNotice')}
                  </Text>
                )} */}
              </div>
              <div className={classes.resultsScroll} data-testid="find-results-list">
                <MatchList
                  totalCount={totalCount}
                  matches={allMatches}
                  onGoBack={() => {
                    setEditing(true);
                    setError(null);
                  }}
                  onMatchClick={handleMatchClick}
                  onMatchSelect={toggleMatchSelection}
                  areMatchesSelectable
                  selectedMatchesIds={selectedIds}
                  source="home"
                  onContinue={handleCreateTrip}
                  hideFooter
                  hideHeader
                />
              </div>
              <div className={classes.resultsFooter} data-testid="find-selection-footer">
                <Text size="sm" fw={500} mb={8}>
                  {t('selectedCount', { count: selectedIds.length })}
                </Text>
                <Button
                  fullWidth
                  disabled={selectedIds.length === 0}
                  onClick={handleCreateTrip}
                  data-testid="find-create-trip"
                >
                  {t('createTrip', { count: selectedIds.length })}
                </Button>
              </div>
            </>
          )}
        </Paper>
      )}
    </main>
  );
}
