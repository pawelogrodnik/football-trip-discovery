'use client';

import { useEffect, useMemo, useState } from 'react';
import { LatLngExpression } from 'leaflet';
import {
  Accordion,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Chip,
  Divider,
  Group,
  Slider,
  Stack,
  Text,
  Timeline,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { AutocompleteLoading } from '../../../components/form/AutoComplete';
import MapWrapper from '../../../components/map/MapWrapper';

type LeagueGroup = { country: string; leagues: { name: string; country: string }[] };

function Crest({ name, crest, size = 20 }: { name: string; crest?: string | null; size?: number }) {
  if (crest) {
    return (
      <img
        src={crest}
        alt={name}
        width={size}
        height={size}
        style={{ objectFit: 'contain', borderRadius: 2, background: '#fff' }}
      />
    );
  }
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <Avatar size={size} radius="xs" color="blue">
      {initials}
    </Avatar>
  );
}

export default function SuggestClient() {
  const [groups, setGroups] = useState<LeagueGroup[]>([]);
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [dates, setDates] = useState<[Date | null, Date | null]>([
    new Date(),
    new Date(Date.now() + 7 * 24 * 3600 * 1000),
  ]);
  const [hop, setHop] = useState(100);
  const [searchLocation, setSearchLocation] = useState<{
    label: string;
    lat: number;
    lon: number;
  } | null>(null);
  const [searchRadius, setSearchRadius] = useState(30);
  const [startLoc, setStartLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTripIdx, setSelectedTripIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/trips/suggest')
      .then((r) => r.json())
      .then((d) => setGroups(d.leagues || []))
      .catch(() => setGroups([]));
  }, []);

  const toggleCountry = (country: string, checked: boolean) => {
    if (checked) {
      setSelectedCountries((prev) => [...prev, country]);
      const g = groups.find((x) => x.country === country);
      if (g) {
        const names = g.leagues.map((l) => l.name);
        setSelectedLeagues((prev) => Array.from(new Set([...prev, ...names])));
      }
    } else {
      setSelectedCountries((prev) => prev.filter((c) => c !== country));
      const g = groups.find((x) => x.country === country);
      if (g) {
        const names = new Set(g.leagues.map((l) => l.name));
        setSelectedLeagues((prev) => prev.filter((n) => !names.has(n)));
      }
    }
  };

  const toggleLeague = (name: string, checked: boolean) => {
    if (checked) setSelectedLeagues((prev) => [...prev, name]);
    else {
      setSelectedLeagues((prev) => prev.filter((n) => n !== name));
    }
  };

  const countryChecked = (country: string) => selectedCountries.includes(country);
  const countryIndeterminate = (country: string) => {
    const g = groups.find((x) => x.country === country);
    if (!g) return false;
    const total = g.leagues.length;
    const selected = g.leagues.filter((l) => selectedLeagues.includes(l.name)).length;
    return selected > 0 && selected < total;
  };

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const onSubmit = async () => {
    setError(null);
    if (selectedLeagues.length === 0) {
      setError('Select at least one league');
      return;
    }
    const rawStart: any = dates[0];
    const rawEnd: any = dates[1];
    const start: Date | null = rawStart
      ? rawStart instanceof Date
        ? rawStart
        : new Date(rawStart)
      : null;
    const end: Date | null = rawEnd ? (rawEnd instanceof Date ? rawEnd : new Date(rawEnd)) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError('Select date range');
      return;
    }
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 0 || diffDays > 30) {
      setError('Date range must be 0-30 days');
      return;
    }
    setLoading(true);
    setTrips([]);
    setSelectedTripIdx(null);
    try {
      const body: any = {
        leagues: selectedLeagues,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        maxInterTravelKm: hop,
        limit: 3,
      };
      if (startLoc) body.startLocation = startLoc;
      if (searchLocation) {
        body.searchLocation = { lat: searchLocation.lat, lon: searchLocation.lon };
        body.searchRadiusKm = searchRadius;
      }
      const res = await fetch('/api/trips/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setTrips(data.trips || []);
      setHasSearched(true);
      if ((data.trips || []).length === 0)
        setError(
          'No trips found for selected leagues/dates/hop. Try expanding hop to 200-300km or wider dates.'
        );
    } catch (e: any) {
      setError(e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const onBack = () => {
    setHasSearched(false);
    setTrips([]);
    setSelectedTripIdx(null);
    setError(null);
  };

  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setStartLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setError('Geolocation failed')
    );
  };

  const selectedTrip = selectedTripIdx !== null ? trips[selectedTripIdx] : null;
  const mapFixtures = useMemo(() => {
    if (!selectedTrip) return [];
    return selectedTrip.matches;
  }, [selectedTrip]);
  const mapCenter = useMemo(() => {
    if (selectedTrip && selectedTrip.matches.length > 0) {
      const first = selectedTrip.matches[0];
      const lat = first?.stadium?.geo?.latitude;
      const lon = first?.stadium?.geo?.longitude;
      if (typeof lat === 'number' && typeof lon === 'number') return [lat, lon] as LatLngExpression;
    }
    if (searchLocation) return [searchLocation.lat, searchLocation.lon] as LatLngExpression;
    if (startLoc) return [startLoc.lat, startLoc.lon] as LatLngExpression;
    return [50.0647, 19.945] as LatLngExpression;
  }, [selectedTrip, searchLocation, startLoc]);

  const mapSelectedLocation = useMemo(() => {
    if (searchLocation) return searchLocation;
    if (startLoc) return { label: 'Start', lat: startLoc.lat, lon: startLoc.lon } as any;
    return null;
  }, [searchLocation, startLoc]);

  const mapSelectedRadius = useMemo(() => {
    if (searchLocation) return searchRadius;
    if (startLoc) return hop;
    return null;
  }, [searchLocation, searchRadius, startLoc, hop]);

  return (
    <div className="page-inner">
      <div className="left-side">
        <MapWrapper
          initialCenter={mapCenter}
          initialZoom={8}
          selectedLocation={mapSelectedLocation}
          selectedRadius={mapSelectedRadius}
          fixtures={mapFixtures}
          selectedMatchesIds={mapFixtures.map((m: any) => String(m.id))}
          focus={null}
        />
      </div>

      <div className="right-side">
        <div style={{ padding: 16, overflowY: 'auto', height: '100%' }}>
          {hasSearched ? (
            <Stack gap="md">
              <Button variant="subtle" size="xs" onClick={onBack} leftSection={<span>←</span>}>
                Back to filters
              </Button>
              {error && <Alert color="red">{error}</Alert>}
              {trips.length > 0 ? (
                <Stack>
                  <Text fw={600}>Suggested trips ({trips.length})</Text>
                  {trips.map((t, idx) => (
                    <Card
                      key={t.id}
                      withBorder
                      shadow="sm"
                      style={{
                        borderColor:
                          selectedTripIdx === idx ? 'var(--mantine-color-blue-filled)' : undefined,
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedTripIdx(idx)}
                    >
                      <Group justify="space-between">
                        <Text fw={600}>
                          Trip {idx + 1}: {t.matchCount} matches • {t.totalKm} km total
                        </Text>
                        <Badge variant="light">
                          {t.matches[0]?.date?.date?.slice(0, 10)} →{' '}
                          {t.matches[t.matches.length - 1]?.date?.date?.slice(0, 10)}
                        </Badge>
                      </Group>

                      <Timeline active={t.matchCount} bulletSize={22} lineWidth={2} mt={12}>
                        {t.matches.map((m: any, i: number) => {
                          const leg = t.legs?.find((l: any) => l.fromIdx === i);
                          const nextDist = leg ? `${leg.km} km` : null;
                          return (
                            <Timeline.Item
                              key={m.id}
                              bullet={
                                <Text size="sm" fw={700}>
                                  {i + 1}
                                </Text>
                              }
                              title={
                                <Group gap={6} wrap="nowrap">
                                  <Crest
                                    name={m.homeTeam?.name}
                                    crest={m.homeTeam?.crest}
                                    size={20}
                                  />
                                  <Text size="sm" fw={500} lineClamp={1}>
                                    {m.homeTeam?.name}
                                  </Text>
                                  <Text size="sm" c="dimmed">
                                    vs
                                  </Text>
                                  <Crest
                                    name={m.awayTeam?.name}
                                    crest={m.awayTeam?.crest}
                                    size={20}
                                  />
                                  <Text size="sm" fw={500} lineClamp={1}>
                                    {m.awayTeam?.name}
                                  </Text>
                                </Group>
                              }
                            >
                              <Text size="xs" c="dimmed">
                                {m.date?.approximate ? '~' : ''}
                                {new Date(m.date?.dateTime || m.date?.date).toLocaleString()} •{' '}
                                {m.competition?.name} {m.stadium?.name ? `• ${m.stadium.name}` : ''}
                              </Text>
                              {nextDist && (
                                <Badge size="xs" variant="outline" color="gray" mt={4}>
                                  ↓ {nextDist} to next
                                </Badge>
                              )}
                            </Timeline.Item>
                          );
                        })}
                      </Timeline>

                      <Button
                        mt={12}
                        size="xs"
                        fullWidth
                        variant={selectedTripIdx === idx ? 'filled' : 'light'}
                        onClick={() => setSelectedTripIdx(idx)}
                      >
                        {selectedTripIdx === idx ? 'Showing on map' : 'Show on map'}
                      </Button>
                    </Card>
                  ))}
                </Stack>
              ) : (
                !loading && (
                  <Text size="sm" c="dimmed">
                    No trips found. Try expanding hop or dates.
                  </Text>
                )
              )}
              {error && !trips.length && <Alert color="red">{error}</Alert>}
            </Stack>
          ) : (
            <Stack gap="md">
              <div>
                <Text fw={700} size="xl">
                  Suggested Trips
                </Text>
                <Text size="sm" c="dimmed" mt={4}>
                  Select leagues, date range (max 30 days) and how far you are willing to travel
                  between matches. System will propose best non-overlapping trips.
                </Text>
              </div>

              {selectedLeagues.length > 0 && (
                <div>
                  <Text size="sm" fw={500} mb={4}>
                    Selected ({selectedLeagues.length})
                  </Text>
                  <Group gap={6}>
                    {selectedLeagues.slice(0, 12).map((n) => (
                      <Chip
                        key={n}
                        checked={true}
                        onChange={() => toggleLeague(n, false)}
                        size="xs"
                        variant="filled"
                      >
                        {n}
                      </Chip>
                    ))}
                    {selectedLeagues.length > 12 && (
                      <Text size="xs" c="dimmed">
                        +{selectedLeagues.length - 12} more
                      </Text>
                    )}
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => {
                        setSelectedLeagues([]);
                        setSelectedCountries([]);
                      }}
                    >
                      Clear all
                    </Button>
                  </Group>
                </div>
              )}

              <div
                style={{
                  maxHeight: 300,
                  overflowY: 'auto',
                  border: '1px solid #eee',
                  borderRadius: 8,
                  padding: 4,
                }}
              >
                <Accordion variant="separated">
                  {groups.map((g) => (
                    <Accordion.Item key={g.country} value={g.country}>
                      <Accordion.Control>
                        <Group justify="space-between" style={{ width: '100%' }}>
                          <Checkbox
                            label={`${g.country} (${g.leagues.length})`}
                            checked={countryChecked(g.country)}
                            indeterminate={countryIndeterminate(g.country)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleCountry(g.country, e.currentTarget.checked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap={4}>
                          {g.leagues.map((l) => (
                            <Checkbox
                              key={l.name}
                              label={l.name}
                              checked={selectedLeagues.includes(l.name)}
                              onChange={(e) => toggleLeague(l.name, e.currentTarget.checked)}
                            />
                          ))}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </div>

              <DatePickerInput
                type="range"
                label="Date range (max 30 days)"
                placeholder="Pick dates"
                value={dates}
                onChange={setDates as any}
                minDate={today}
                popoverProps={{ withinPortal: true, zIndex: 10000, position: 'bottom-start' }}
              />

              <div>
                <Text size="sm" fw={500}>
                  How far willing to travel between matches: {hop} km
                </Text>
                <Slider
                  mb={30}
                  min={20}
                  max={300}
                  step={10}
                  value={hop}
                  onChange={setHop}
                  marks={[
                    { value: 20, label: '20' },
                    { value: 100, label: '100' },
                    { value: 200, label: '200' },
                    { value: 300, label: '300' },
                  ]}
                />
              </div>

              <Divider label="Limit search to area (optional)" labelPosition="center" />

              <div>
                <Text size="sm" fw={500}>
                  Lokalizacja (opcjonalnie)
                </Text>
                <Text size="xs" c="dimmed">
                  np Kraków + 30km – tylko mecze w tym promieniu, jak na stronie głównej
                </Text>
                <AutocompleteLoading onLocationSelect={(loc: any) => setSearchLocation(loc)} />
                {searchLocation && (
                  <Group justify="space-between" mt={4}>
                    <Text size="xs" c="dimmed" lineClamp={1} style={{ flex: 1 }}>
                      {searchLocation.label}
                    </Text>
                    <Button size="xs" variant="subtle" onClick={() => setSearchLocation(null)}>
                      Clear
                    </Button>
                  </Group>
                )}
              </div>

              {searchLocation && (
                <div>
                  <Text size="sm" fw={500}>
                    Radius: {searchRadius} km
                  </Text>
                  <Slider
                    min={5}
                    max={200}
                    step={5}
                    value={searchRadius}
                    onChange={setSearchRadius}
                    marks={[
                      { value: 30, label: '30' },
                      { value: 100, label: '100' },
                      { value: 200, label: '200' },
                    ]}
                  />
                </div>
              )}

              <Group>
                <Button variant="light" onClick={useMyLocation}>
                  Use my location{' '}
                  {startLoc ? `(${startLoc.lat.toFixed(2)}, ${startLoc.lon.toFixed(2)})` : ''}
                </Button>
                {startLoc && (
                  <Button variant="subtle" onClick={() => setStartLoc(null)}>
                    Clear
                  </Button>
                )}
              </Group>

              <Button onClick={onSubmit} loading={loading} fullWidth>
                Suggest trips
              </Button>

              {error && <Alert color="red">{error}</Alert>}
            </Stack>
          )}
        </div>
      </div>
    </div>
  );
}
