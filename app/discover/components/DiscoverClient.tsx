'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconAlertCircle } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'components/providers/LocaleProvider';
import {
  DISCOVER_DEFAULT_TRIP_LENGTHS,
  DiscoverCategory,
  DiscoverTrip,
  enrichTrip,
  getAvailableCategories,
  rankByCategory,
  rankTopPicks,
  resolveCategory,
  toDateOnlyUTC,
  tripMapSources,
} from 'lib/discover';
import { DEFAULT_INTER_TRAVEL_KM } from 'lib/distance';
import { MapViewportInsets } from 'lib/mapViewport';
import { buildFindUrl, deriveFindContextFromTrip } from 'lib/tripUrls';
import { Alert, Button, Paper } from '@mantine/core';
import MapWrapper from '../../components/map/MapWrapper';
import CompetitionPicker, { LeagueGroup } from './CompetitionPicker';
import DiscoverResultsDock from './DiscoverResultsDock';
import DiscoverSearchForm, { DestinationSelection } from './DiscoverSearchForm';
import DiscoverSearchSummary from './DiscoverSearchSummary';
import DiscoverTripDrawer from './DiscoverTripDrawer';
import { coerceToDate, matchIdOf } from './format';
import classes from '../discover.module.css';

type DiscoverView = 'search' | 'loading' | 'results';

const DISCOVER_CENTER = [50, 10] as unknown as [number, number];
const UEFA_LEAGUES = ['Champions League', 'Europa League', 'Conference League'];

/** Country preset chips (keys match BASE_FIXTURES groups, case-insensitive). */
const COUNTRY_PRESETS = [
  { key: 'UNITED KINGDOM', labelKey: 'englandPreset' },
  { key: 'SPAIN', labelKey: 'spainPreset' },
  { key: 'ITALY', labelKey: 'italyPreset' },
  { key: 'POLAND', labelKey: 'polandPreset' },
] as const;

/** "UNITED KINGDOM" -> "United Kingdom" for summary display. */
export function formatCountryName(raw: string): string {
  return raw
    .toLowerCase()
    .split(/[\s-]+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function defaultAvailability(): [Date | null, Date | null] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  return [start, end];
}

export default function DiscoverClient() {
  const t = useTranslations('Discover');
  const locale = useLocale();
  const router = useRouter();

  const [groups, setGroups] = useState<LeagueGroup[]>([]);
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);
  const [dates, setDates] = useState<[Date | null, Date | null]>(defaultAvailability);
  const [tripLengthsDays, setTripLengthsDays] = useState<number[]>(DISCOVER_DEFAULT_TRIP_LENGTHS);
  const [maxInterTravelKm, setMaxInterTravelKm] = useState(DEFAULT_INTER_TRAVEL_KM);
  const [destination, setDestination] = useState<DestinationSelection>({ type: 'anywhere' });
  const [advancedOpened, setAdvancedOpened] = useState(false);
  const [startLoc, setStartLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [view, setView] = useState<DiscoverView>('search');
  const [editing, setEditing] = useState(false);
  const [pickerOpened, setPickerOpened] = useState(false);
  const [trips, setTrips] = useState<DiscoverTrip[]>([]);
  const [category, setCategory] = useState<DiscoverCategory>('top');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [detailsTripId, setDetailsTripId] = useState<string | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastCriteria, setLastCriteria] = useState<{
    availabilityStart: string | null;
    availabilityEnd: string | null;
    competitionSummary: string;
    maxInterTravelKm: number;
  } | null>(null);

  useEffect(() => {
    fetch('/api/trips/suggest')
      .then((r) => r.json())
      .then((d) => setGroups(d.leagues || []))
      .catch(() => setGroups([]));
  }, []);

  const toggleLeague = useCallback((name: string, checked: boolean) => {
    setSelectedLeagues((prev) =>
      checked ? (prev.includes(name) ? prev : [...prev, name]) : prev.filter((n) => n !== name)
    );
  }, []);

  const toggleCountry = useCallback(
    (country: string, checked: boolean) => {
      const g = groups.find((x) => x.country === country);
      if (!g) {
        return;
      }
      const names = g.leagues.map((l) => l.name);
      setSelectedLeagues((prev) =>
        checked ? Array.from(new Set([...prev, ...names])) : prev.filter((n) => !names.includes(n))
      );
    },
    [groups]
  );

  const uefaActive = UEFA_LEAGUES.every((l) => selectedLeagues.includes(l));

  const toggleUefaPreset = useCallback(() => {
    setSelectedLeagues((prev) => {
      const allIn = UEFA_LEAGUES.every((l) => prev.includes(l));
      return allIn
        ? prev.filter((n) => !UEFA_LEAGUES.includes(n))
        : Array.from(new Set([...prev, ...UEFA_LEAGUES]));
    });
  }, []);

  // Country presets. Group keys come from the API in varying case
  // ("ITALY", "UNITED KINGDOM"), so matching is case-insensitive —
  // exact-case lookup silently broke the Italy preset before.
  const toggleCountryPreset = useCallback(
    (countryKey: string) => {
      const group = groups.find((g) => g.country.toUpperCase() === countryKey.toUpperCase());
      const names = group?.leagues.map((l) => l.name) ?? [];
      if (names.length === 0) {
        return;
      }
      setSelectedLeagues((prev) => {
        const allIn = names.every((n) => prev.includes(n));
        return allIn
          ? prev.filter((n) => !names.includes(n))
          : Array.from(new Set([...prev, ...names]));
      });
    },
    [groups]
  );

  const countryPresets = useMemo(
    () =>
      COUNTRY_PRESETS.map(({ key, labelKey }) => {
        const group = groups.find((g) => g.country.toUpperCase() === key);
        const names = group?.leagues.map((l) => l.name) ?? [];
        return {
          key,
          labelKey,
          active: names.length > 0 && names.every((n) => selectedLeagues.includes(n)),
        };
      }),
    [groups, selectedLeagues]
  );

  const competitionSummary = useMemo(() => {
    if (selectedLeagues.length === 0) {
      return '';
    }
    const parts: string[] = [];
    const uefaSelected = UEFA_LEAGUES.filter((l) => selectedLeagues.includes(l));
    if (uefaSelected.length === UEFA_LEAGUES.length) {
      parts.push(t('uefaPreset'));
    } else {
      parts.push(...uefaSelected);
    }
    const countryGroups = groups.filter(
      (g) =>
        g.country !== 'UEFA' &&
        g.leagues.length > 0 &&
        g.leagues.every((l) => selectedLeagues.includes(l.name))
    );
    parts.push(...countryGroups.map((g) => formatCountryName(g.country)));
    const covered = new Set<string>([...uefaSelected]);
    for (const g of countryGroups) {
      for (const l of g.leagues) {
        covered.add(l.name);
      }
    }
    const leftover = selectedLeagues.filter((n) => !covered.has(n));
    parts.push(...leftover.slice(0, 2));
    if (leftover.length > 2) {
      parts.push(`+${leftover.length - 2}`);
    }
    return parts.slice(0, 4).join(', ');
  }, [selectedLeagues, groups, t]);

  const useMyLocation = useCallback(() => {
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => setStartLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setGeoError(t('geoError'))
    );
  }, [t]);

  const onSubmit = useCallback(async () => {
    setError(null);
    if (selectedLeagues.length === 0) {
      setError(t('selectLeague'));
      return;
    }
    if (tripLengthsDays.length === 0) {
      setError(t('pickTripLength'));
      return;
    }
    const [rawStart, rawEnd] = dates;
    const start = coerceToDate(rawStart);
    const end = coerceToDate(rawEnd);
    if (!start || !end) {
      setError(t('selectDates'));
      return;
    }
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 0 || diffDays > 30) {
      setError(t('dateRangeError'));
      return;
    }
    setLoading(true);
    setView('loading');
    setEditing(false);
    setSelectedTripId(null);
    setDetailsTripId(null);
    try {
      const body: Record<string, unknown> = {
        leagues: selectedLeagues,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        tripLengthsDays,
        maxInterTravelKm,
        limit: 20,
      };
      if (startLoc) {
        body.startLocation = startLoc;
      }
      if (destination.type === 'around-city' && destination.location.label) {
        body.searchLocation = { lat: destination.location.lat, lon: destination.location.lon };
        body.searchRadiusKm = destination.radiusKm;
      }
      const res = await fetch('/api/trips/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t('errorFallback'));
      }
      const enriched: DiscoverTrip[] = (data.trips || []).map((trip: DiscoverTrip) => ({
        ...trip,
        ...enrichTrip(trip),
      }));
      setTrips(enriched);
      setLastCriteria({
        availabilityStart: body.startDate as string,
        availabilityEnd: body.endDate as string,
        competitionSummary,
        maxInterTravelKm,
      });
      setCategory('top');
      setView('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorFallback'));
      setView('results');
    } finally {
      setLoading(false);
    }
  }, [
    selectedLeagues,
    tripLengthsDays,
    dates,
    maxInterTravelKm,
    startLoc,
    destination,
    competitionSummary,
    t,
  ]);

  const availableCategories = useMemo(() => getAvailableCategories(trips), [trips]);
  const rankedTrips = useMemo(() => rankByCategory(trips, category), [trips, category]);
  const topPickId = useMemo(() => rankTopPicks(trips)[0]?.id ?? null, [trips]);
  const selectedTrip = useMemo(
    () => trips.find((tr) => tr.id === selectedTripId) ?? null,
    [trips, selectedTripId]
  );
  const detailsTrip = useMemo(
    () => trips.find((tr) => tr.id === detailsTripId) ?? null,
    [trips, detailsTripId]
  );

  // Category switching preserves selection only if still present
  useEffect(() => {
    if (selectedTripId && !rankedTrips.some((tr) => tr.id === selectedTripId)) {
      setSelectedTripId(null);
    }
  }, [rankedTrips, selectedTripId]);

  // Dynamic categories follow the candidate pool: fall back to Top picks
  // when the selected category is no longer available.
  useEffect(() => {
    setCategory((prev) => resolveCategory(trips, prev));
  }, [trips]);

  // While the details drawer is open, picking a trip switches the drawer
  // contents directly instead of toggling selection.
  const handleSelectTrip = useCallback(
    (id: string) => {
      if (detailsTripId !== null) {
        setSelectedTripId(id);
        setDetailsTripId(id);
        return;
      }
      setSelectedTripId((prev) => (prev === id ? null : id));
    },
    [detailsTripId]
  );

  // ---- Map adapter (decoupled semantics) ----
  const allMarkers = useMemo(() => {
    const seen = new Set<string>();
    const out: DiscoverTrip['matches'] = [];
    for (const tr of trips) {
      for (const m of [...tr.matches, ...(tr.tbcMatches ?? [])]) {
        const id = matchIdOf(m);
        if (!id || seen.has(id)) {
          continue;
        }
        seen.add(id);
        out.push(m);
      }
    }
    return out;
  }, [trips]);

  const showSearch = view === 'search' || editing;
  // Results overview: one destination marker per ranked trip.
  // Venue source is the itinerary, or the geocoded TBC opportunities for
  // opportunity-only candidates (which have no itinerary at all).
  const mapTripMarkers = useMemo(() => {
    if (selectedTrip || (view !== 'results' && view !== 'loading')) {
      return [];
    }
    return rankedTrips
      .map((tr) => {
        const source = tr.matches.length > 0 ? tr.matches : (tr.tbcMatches ?? []);
        const pts = source
          .map((m) => ({
            lat: m.stadium?.geo?.latitude,
            lon: m.stadium?.geo?.longitude,
          }))
          .filter(
            (p): p is { lat: number; lon: number } =>
              typeof p.lat === 'number' && typeof p.lon === 'number'
          );
        if (pts.length === 0) {
          return null;
        }
        const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
        const lon = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
        const count = tr.matchCount > 0 ? tr.matchCount : (tr.tbcMatches?.length ?? 0);
        return { id: tr.id, label: tr.destinationLabel, lat, lon, count };
      })
      .filter(
        (m): m is { id: string; label: string; lat: number; lon: number; count: number } =>
          m !== null
      );
  }, [rankedTrips, selectedTrip, view]);
  // Selected trip map semantics via the shared tripMapSources helper:
  // markers = itinerary + geocoded TBC (TBC-only: just TBC),
  // route = confirmed only, fit = marker set.
  const selectedMapSources = useMemo(
    () =>
      selectedTrip
        ? tripMapSources(selectedTrip)
        : { markers: [], route: [], selectedIds: [], hasItinerary: false },
    [selectedTrip]
  );
  const mapFixtures = selectedMapSources.markers;
  const mapRouteFixtures = selectedMapSources.route;
  const mapFitFixtures = selectedTrip
    ? selectedMapSources.markers
    : view === 'results' || view === 'loading'
      ? allMarkers
      : null;
  const mapRouteLabel =
    selectedTrip && selectedMapSources.hasItinerary
      ? t('totalKm', { count: selectedTrip.totalKm })
      : null;
  const mapSelectedMatchesIds = selectedMapSources.selectedIds;
  const mapSelectedLocation =
    destination.type === 'around-city' && destination.location.label ? destination.location : null;
  const mapShowCircle = mapSelectedLocation !== null && selectedTrip === null;

  // Floating overlays never resize the map itself; fitBounds targets the
  // actually visible region instead.
  const detailsOpen = detailsTripId !== null;
  const mapViewportInsets = useMemo<MapViewportInsets>(
    () => ({
      top: 76,
      right: detailsOpen ? 448 : 24,
      bottom: dockCollapsed ? 60 : detailsOpen ? 132 : 256,
      left: 24,
    }),
    [detailsOpen, dockCollapsed]
  );

  const form = (
    <DiscoverSearchForm
      dates={dates}
      onDatesChange={setDates}
      tripLengthsDays={tripLengthsDays}
      onTripLengthsChange={setTripLengthsDays}
      selectedLeagues={selectedLeagues}
      onOpenCompetitions={() => setPickerOpened(true)}
      onToggleUefaPreset={toggleUefaPreset}
      uefaActive={uefaActive}
      countryPresets={countryPresets}
      onToggleCountryPreset={toggleCountryPreset}
      maxInterTravelKm={maxInterTravelKm}
      onMaxInterTravelKmChange={setMaxInterTravelKm}
      destination={destination}
      onDestinationChange={setDestination}
      advancedOpened={advancedOpened}
      onToggleAdvanced={() => setAdvancedOpened((v) => !v)}
      startLoc={startLoc}
      onUseMyLocation={useMyLocation}
      onClearStartLoc={() => setStartLoc(null)}
      geoError={geoError}
      error={error}
      loading={loading}
      onSubmit={onSubmit}
    />
  );

  return (
    <main className={classes.discoverShell} data-testid="discover-view">
      <div
        className={`${classes.mapArea} ${showSearch ? classes.mapDimmed : ''}`}
        data-testid="discover-map"
      >
        <MapWrapper
          initialCenter={DISCOVER_CENTER}
          initialZoom={4}
          fixtures={mapFixtures}
          selectedMatchesIds={mapSelectedMatchesIds}
          selectedLocation={mapSelectedLocation}
          selectedRadius={destination.type === 'around-city' ? destination.radiusKm : null}
          showSelectedLocationRadius={mapShowCircle}
          routeFixtures={mapRouteFixtures}
          fitFixtures={mapFitFixtures}
          tripMarkers={mapTripMarkers}
          selectedTripMarkerId={selectedTripId}
          onTripMarkerClick={handleSelectTrip}
          routeLabel={mapRouteLabel}
          focus={null}
          viewportInsets={mapViewportInsets}
        />
      </div>

      {showSearch && <div className={classes.dimOverlay} aria-hidden />}
      {showSearch && (
        <div className={classes.searchCenter} data-testid="discover-search">
          <Paper
            radius="lg"
            shadow="xl"
            p="xl"
            className={classes.searchPaper}
            data-testid="discover-search-paper"
          >
            {view !== 'search' && editing && (
              <Alert
                color="blue"
                mb="md"
                icon={<IconAlertCircle size={16} />}
                data-testid="discover-editing-notice"
              >
                {t('editingNotice')}
              </Alert>
            )}
            {form}
            {view !== 'search' && editing && (
              <Button
                mt="sm"
                variant="subtle"
                fullWidth
                data-testid="discover-cancel-editing"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
              >
                {t('cancel')}
              </Button>
            )}
          </Paper>
        </div>
      )}

      {(view === 'results' || view === 'loading') && !editing && lastCriteria && (
        <DiscoverSearchSummary
          availabilityStart={lastCriteria.availabilityStart}
          availabilityEnd={lastCriteria.availabilityEnd}
          tripLengthsDays={tripLengthsDays}
          competitionSummary={lastCriteria.competitionSummary || competitionSummary}
          maxInterTravelKm={lastCriteria.maxInterTravelKm}
          locale={locale}
          onEdit={() => {
            setEditing(true);
            setError(null);
          }}
        />
      )}

      {(view === 'results' || view === 'loading') && !editing && (
        <DiscoverResultsDock
          loading={loading || view === 'loading'}
          trips={rankedTrips}
          category={category}
          availableCategories={availableCategories}
          onCategoryChange={setCategory}
          selectedTripId={selectedTripId}
          onSelectTrip={handleSelectTrip}
          onViewTrip={(id) => {
            setSelectedTripId(id);
            setDetailsTripId(id);
          }}
          topPickId={topPickId}
          error={view === 'results' ? error : null}
          onEditSearch={() => {
            setEditing(true);
            setError(null);
          }}
          detailsOpen={detailsOpen}
          collapsed={dockCollapsed}
          onToggleCollapsed={() => setDockCollapsed((v) => !v)}
        />
      )}

      <CompetitionPicker
        opened={pickerOpened}
        onClose={() => setPickerOpened(false)}
        groups={groups}
        selectedLeagues={selectedLeagues}
        onToggleLeague={toggleLeague}
        onToggleCountry={toggleCountry}
        onClear={() => setSelectedLeagues([])}
      />

      <DiscoverTripDrawer
        trip={detailsTrip}
        onClose={() => {
          setDetailsTripId(null);
          setDockCollapsed(false);
        }}
        onCustomize={(trip) => {
          const ctx = deriveFindContextFromTrip(trip);
          router.push(
            buildFindUrl(
              {
                location: ctx.location,
                startDate: ctx.startDate,
                endDate: ctx.endDate,
                radiusKm: ctx.radiusKm,
              },
              ctx.ids,
              { mode: 'customize' }
            )
          );
        }}
      />
    </main>
  );
}

export type { DiscoverView };
export { toDateOnlyUTC };
