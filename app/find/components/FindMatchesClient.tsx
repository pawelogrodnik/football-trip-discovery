'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconAlertCircle } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'components/providers/LocaleProvider';
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
import { useIsMobile } from 'lib/useIsMobile';
import { Alert, Button, Group, Paper, Text } from '@mantine/core';
import MapWrapper from '../../components/map/MapWrapper';
import { MOBILE_VIEW } from '../../components/view-toggle/consts';
import ViewToggle from '../../components/view-toggle/ViewToggle';
import FindResultsPanel, { ResultsFilter } from './FindResultsPanel';
import {
  dedupeMatches,
  formatShortDayRange,
  LooseMatch,
  matchIdOf,
  reconcileSelectedIds,
} from './findResultsUtils';
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
  const locale = useLocale();
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
  const [hoveredMatchId, setHoveredMatchId] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<ResultsFilter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  // Mobile defaults to Matches/List; desktop keeps map-first composition.
  // User choice is never overwritten after mount.
  const [mobileView, setMobileView] = useState<string>(MOBILE_VIEW.LIST_VIEW);
  const isMobile = useIsMobile();
  const autoSearched = useRef(false);

  const customizeMode = initial.mode === 'customize';
  // Original Discover suggestion, preserved separately so Reset never loses it.
  const [originalSuggestedIds] = useState<string[]>(() =>
    Array.from(new Set(initial.ids.map(String).filter(Boolean)))
  );

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
          bq.set('radius', String(c.radiusKm));
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
    () => (hasSearched ? (combineAllMatches(fixtures) as Array<LooseMatch>) : []),
    [fixtures, hasSearched]
  );

  const allMatches = useMemo(() => {
    let merged: LooseMatch[];
    if (extraMatches.length === 0) {
      merged = apiMatches;
    } else {
      const seen = new Set(apiMatches.map((m) => matchIdOf(m)));
      merged = [
        ...apiMatches,
        ...(extraMatches as LooseMatch[]).filter((m) => !seen.has(matchIdOf(m))),
      ];
    }
    // Same fixture under two id forms must not render (or select) twice.
    return dedupeMatches(merged);
  }, [apiMatches, extraMatches]);

  // IDs merged via by-ids (outside the radius result set) stay visible + flagged.
  const outsideIds = useMemo(
    () => new Set((extraMatches as LooseMatch[]).map(matchIdOf).filter(Boolean)),
    [extraMatches]
  );

  // Single source of truth for selection: raw selected ids (URL, Discover,
  // native forms) reconciled against loaded fixtures to canonical ids.
  // "Selected N" and effective selected fixtures always agree.
  const canonicalSelectedIds = useMemo(
    () => reconcileSelectedIds(selectedIds, allMatches),
    [selectedIds, allMatches]
  );

  const toggleMatchSelection = useCallback(
    (rawId: string | number) => {
      if (rawId === null || rawId === undefined) {
        return;
      }
      // Resolve through loaded fixtures so toggling works for any id form
      // (canonical, Discover-issued, native) — state converges to canonical.
      const toggled = reconcileSelectedIds([String(rawId)], allMatches)[0] ?? String(rawId);
      setSelectedIds((prev) => {
        const remaining = prev.filter(
          (x) => (reconcileSelectedIds([x], allMatches)[0] ?? x) !== toggled
        );
        return remaining.length === prev.length ? [...prev, toggled] : remaining;
      });
    },
    [allMatches]
  );

  const handleHover = useCallback((id: string | null) => {
    setHoveredMatchId(id);
  }, []);

  const handleMatchClick = useCallback(
    (match: {
      stadium?: { geo?: { latitude?: unknown; longitude?: unknown } };
      _id?: unknown;
      id?: unknown;
    }) => {
      const lat = match?.stadium?.geo?.latitude;
      const lon = match?.stadium?.geo?.longitude;
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        setMapFocus({ lat: lat as number, lon: lon as number, id: matchIdOfLoose(match) });
      }
    },
    []
  );

  const handleResetSuggested = useCallback(() => {
    setSelectedIds(originalSuggestedIds);
    setViewFilter('all');
  }, [originalSuggestedIds]);

  const handleCreateTrip = useCallback(() => {
    const c = submitted ?? criteria;
    router.push(buildTripUrl(c, canonicalSelectedIds));
  }, [router, submitted, criteria, canonicalSelectedIds]);

  const showSearch = !hasSearched || editing;
  const activeCriteria = submitted ?? criteria;
  // Results state (not the form, not editing): the only state where mobile
  // switches to the list-first / map-first compositions.
  const inResults = hasSearched && !showSearch;

  const isMobileList = isMobile && mobileView === MOBILE_VIEW.LIST_VIEW && inResults;
  const isMobileMap = isMobile && mobileView === MOBILE_VIEW.MAP_VIEW && inResults;
  const shouldRenderMobileMap = isMobileMap;
  // Pre-search (and while editing) mobile renders the dimmed map + form
  // exactly like desktop — the map must never mount into a display:none
  // container (Leaflet computes NaN in a 0×0 box and throws).
  const shouldRenderMap = !isMobile || shouldRenderMobileMap || !inResults;
  const shouldRenderPanel = !isMobile || isMobileList;

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
  const mapViewportInsets = useMemo(() => {
    // Mobile map mode: only the toggle + compact pill overlay the map.
    if (isMobileMap) {
      return { top: 132, right: 16, bottom: 112, left: 16 };
    }
    return panelViewportInsets({
      panelWidthPx: panelSize?.width ?? null,
      panelHeightPx: panelSize?.height ?? null,
      panelVisible,
      isMobile,
    });
  }, [panelSize, panelVisible, isMobile, isMobileMap]);

  // Center the top summary over the VISIBLE map area (viewport minus panel).
  const summaryShiftPx = panelVisible && !isMobile ? (panelSize?.width ?? 0) / 2 : 0;
  // Constrain the summary to the unobstructed map area so it never slides
  // under the floating results panel on desktop.
  const summaryMaxWidth =
    panelVisible && !isMobile && panelSize
      ? `min(800px, calc(100vw - ${Math.ceil(panelSize.width) + 64}px))`
      : undefined;

  const headerTitle = useMemo(() => {
    const label =
      submitted?.location?.label?.split(',')[0]?.trim() || submitted?.location?.label || '';
    return t('matchesNear', { count: allMatches.length, label });
  }, [t, allMatches.length, submitted]);

  const headerSubtitle = useMemo(() => {
    if (!submitted?.startDate || !submitted?.endDate) {
      return t('withinRadius', {
        km: submitted?.radiusKm ?? 0,
        label: submitted?.location?.label ?? '',
      });
    }
    const range = formatShortDayRange(
      submitted.startDate.toISOString(),
      submitted.endDate.toISOString(),
      locale
    );
    return t('searchRange', { range, km: submitted?.radiusKm ?? 0 });
  }, [t, locale, submitted]);

  const showReset = customizeMode && originalSuggestedIds.length > 0;

  return (
    <main
      className={`${classes.findShell} ${isMobileList ? classes.mobileList : ''} ${isMobileMap ? classes.mobileMap : ''}`}
      data-testid="find-view"
      data-mobile-view={isMobileList ? 'list' : isMobileMap ? 'map' : undefined}
    >
      {shouldRenderMap && (
        <div
          className={`${classes.mapArea} ${showSearch ? classes.mapDimmed : ''}`}
          data-testid="find-map"
        >
          <MapWrapper
            initialCenter={FIND_CENTER}
            initialZoom={4}
            fixtures={allMatches}
            selectedMatchesIds={canonicalSelectedIds}
            hoveredMatchId={hoveredMatchId}
            selectedLocation={activeCriteria.location}
            selectedRadius={activeCriteria.radiusKm ?? FIND_DEFAULT_RADIUS_KM}
            showSelectedLocationRadius={hasSearched && !showSearch}
            routeFixtures={[]}
            fitFixtures={hasSearched ? allMatches : null}
            focus={mapFocus}
            viewportInsets={mapViewportInsets}
          />
        </div>
      )}

      {showSearch && <div className={classes.dimOverlay} aria-hidden />}
      {isMobile && hasSearched && !showSearch && (
        <div className={classes.mobileToggle} data-testid="find-mobile-toggle">
          <ViewToggle
            value={mobileView}
            ariaLabel={t('viewModeLabel')}
            options={[
              { value: MOBILE_VIEW.LIST_VIEW, label: t('viewMatches') },
              { value: MOBILE_VIEW.MAP_VIEW, label: t('viewMap') },
            ]}
            onChange={setMobileView}
          />
        </div>
      )}

      {isMobileMap && hasSearched && !showSearch && (
        <div className={classes.mapStatusPill} data-testid="find-map-status">
          <Text size="sm" fw={600} truncate className={classes.mapStatusText}>
            {t('matchesNear', {
              count: allMatches.length,
              label: submitted?.location?.label?.split(',')[0]?.trim() || '',
            })}
            {' · '}
            {t('selectedCount', { count: canonicalSelectedIds.length })}
          </Text>
          {canonicalSelectedIds.length > 0 ? (
            <Button
              size="xs"
              onClick={handleCreateTrip}
              data-testid="find-map-create-trip"
              style={{ flexShrink: 0 }}
            >
              {t('createTrip')}
            </Button>
          ) : (
            <Button
              size="xs"
              variant="light"
              onClick={() => setMobileView(MOBILE_VIEW.LIST_VIEW)}
              data-testid="find-map-view-matches"
              style={{ flexShrink: 0 }}
            >
              {t('viewMatches')}
            </Button>
          )}
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

      {hasSearched && !showSearch && submitted && !isMobileMap && (
        <FindSearchSummary
          criteria={submitted}
          customizeMode={customizeMode}
          centerShiftPx={summaryShiftPx}
          maxWidth={summaryMaxWidth}
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
            <div data-testid="find-error">
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {t('errorFallback')}
              </Alert>
              <Group gap={8} mt="sm">
                <Button
                  variant="light"
                  fullWidth
                  data-testid="find-retry"
                  onClick={() => {
                    if (submitted && isCompleteFindCriteria(submitted)) {
                      void runSearch(submitted, selectedIds);
                    }
                  }}
                >
                  {t('tryAgain')}
                </Button>
                <Button
                  variant="subtle"
                  fullWidth
                  data-testid="find-edit-search"
                  onClick={() => {
                    setEditing(true);
                    setError(null);
                  }}
                >
                  {t('editSearch')}
                </Button>
              </Group>
            </div>
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
              <Text size="sm" c="dimmed" ta="center" mt="sm">
                <Link href="/">{t('discoverLink')} →</Link>
              </Text>
            </div>
          ) : (
            <FindResultsPanel
              matches={allMatches}
              selectedIds={canonicalSelectedIds}
              filter={viewFilter}
              onFilterChange={setViewFilter}
              onToggle={toggleMatchSelection}
              onFocus={handleMatchClick}
              onHover={handleHover}
              hoveredId={hoveredMatchId}
              onBack={() => {
                setEditing(true);
                setError(null);
              }}
              onCreateTrip={handleCreateTrip}
              headerTitle={headerTitle}
              headerSubtitle={headerSubtitle}
              customizeMode={customizeMode}
              onResetSuggested={handleResetSuggested}
              showReset={showReset}
              outsideIds={outsideIds}
              flatScroll={isMobileList}
            />
          )}
        </Paper>
      )}
    </main>
  );
}
