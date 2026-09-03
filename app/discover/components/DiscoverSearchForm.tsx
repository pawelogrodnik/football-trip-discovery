'use client';

import { IconAlertCircle, IconSearch } from '@tabler/icons-react';
import { useTranslations } from 'components/providers/LocaleProvider';
import { DISCOVER_DEFAULT_TRIP_LENGTHS } from 'lib/discover';
import {
  Alert,
  Button,
  Chip,
  Collapse,
  Divider,
  Group,
  Radio,
  SegmentedControl,
  Slider,
  Stack,
  Text,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { AutocompleteLoading } from '../../components/form/AutoComplete';

export type DestinationSelection =
  | { type: 'anywhere' }
  | {
      type: 'around-city';
      location: { label: string; lat: number; lon: number };
      radiusKm: number;
    };

type Props = {
  dates: [Date | null, Date | null];
  onDatesChange: (d: [Date | null, Date | null]) => void;
  tripLengthsDays: number[];
  onTripLengthsChange: (v: number[]) => void;
  selectedLeagues: string[];
  onOpenCompetitions: () => void;
  onToggleUefaPreset: () => void;
  onToggleItalyPreset: () => void;
  uefaActive: boolean;
  italyActive: boolean;
  maxInterTravelKm: number;
  onMaxInterTravelKmChange: (v: number) => void;
  destination: DestinationSelection;
  onDestinationChange: (d: DestinationSelection) => void;
  advancedOpened: boolean;
  onToggleAdvanced: () => void;
  startLoc: { lat: number; lon: number } | null;
  onUseMyLocation: () => void;
  onClearStartLoc: () => void;
  geoError: string | null;
  error: string | null;
  loading: boolean;
  onSubmit: () => void;
  submitLabel?: string;
};

const TRIP_LENGTH_OPTIONS = ['2', '3', '4', '5'];

export default function DiscoverSearchForm(props: Props) {
  const t = useTranslations('Discover');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Stack gap="md" data-testid="discover-search-form">
      <div data-testid="discover-search-heading">
        <Text fw={700} size="xl">
          {t('title')}
        </Text>
        <Text size="sm" c="dimmed" mt={4}>
          {t('subtitle')}
        </Text>
      </div>

      <div data-testid="discover-field-dates">
        <Text size="sm" fw={600} mb={4}>
          {t('availability')}
        </Text>
        <DatePickerInput
          type="range"
          placeholder={t('availabilityPlaceholder')}
          value={props.dates}
          onChange={props.onDatesChange as never}
          minDate={today}
          popoverProps={{ withinPortal: true, zIndex: 5000, position: 'bottom-start' }}
        />
      </div>

      <div data-testid="discover-field-trip-length">
        <Text size="sm" fw={600} mb={4}>
          {t('tripLength')}
        </Text>
        <Chip.Group
          multiple
          value={props.tripLengthsDays.map(String)}
          onChange={(v) => props.onTripLengthsChange(v.map(Number))}
        >
          <Group gap={8}>
            {TRIP_LENGTH_OPTIONS.map((d) => (
              <Chip key={d} value={d} variant="filled" data-testid={`discover-trip-length-${d}`}>
                {t('daysOption', { count: Number(d) })}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      </div>

      <div data-testid="discover-field-competitions">
        <Text size="sm" fw={600} mb={4}>
          {t('competitions')}
        </Text>
        <Group gap={8}>
          <Chip
            checked={props.uefaActive}
            onChange={props.onToggleUefaPreset}
            variant="filled"
            data-testid="discover-preset-uefa"
          >
            {t('uefaPreset')}
          </Chip>
          <Chip
            checked={props.italyActive}
            onChange={props.onToggleItalyPreset}
            variant="filled"
            data-testid="discover-preset-italy"
          >
            {t('italyPreset')}
          </Chip>
          <Button
            size="xs"
            variant="light"
            onClick={props.onOpenCompetitions}
            data-testid="discover-open-competitions"
          >
            {t('chooseCompetitions')} ({props.selectedLeagues.length})
          </Button>
        </Group>
      </div>

      <div data-testid="discover-field-distance">
        <Text size="sm" fw={600} mb={4}>
          {t('distance')}
        </Text>
        <SegmentedControl
          value={String(props.maxInterTravelKm)}
          onChange={(v) => props.onMaxInterTravelKmChange(Number(v))}
          data-testid="discover-distance-control"
          data={[
            { label: '50 km', value: '50' },
            { label: '100 km', value: '100' },
            { label: '150 km', value: '150' },
            { label: '250 km', value: '250' },
          ]}
        />
      </div>

      <div data-testid="discover-field-destination">
        <Text size="sm" fw={600} mb={4}>
          {t('destination')}
        </Text>
        <Radio.Group
          value={props.destination.type}
          onChange={(v) =>
            v === 'around-city'
              ? props.onDestinationChange({
                  type: 'around-city',
                  location: { label: '', lat: 0, lon: 0 },
                  radiusKm: 50,
                })
              : props.onDestinationChange({ type: 'anywhere' })
          }
        >
          <Group gap="md">
            <Radio value="anywhere" label={t('anywhere')} />
            <Radio value="around-city" label={t('aroundCity')} />
          </Group>
        </Radio.Group>
        <Collapse in={props.destination.type === 'around-city'}>
          <Stack gap="xs" mt="sm">
            <AutocompleteLoading
              onLocationSelect={(loc) =>
                props.onDestinationChange({ type: 'around-city', location: loc, radiusKm: 50 })
              }
            />
            <div>
              <Text size="sm">
                {t('radius')}:{' '}
                {props.destination.type === 'around-city' ? props.destination.radiusKm : 50} km
              </Text>
              <Slider
                min={5}
                max={200}
                step={5}
                value={props.destination.type === 'around-city' ? props.destination.radiusKm : 50}
                onChange={(v) =>
                  props.destination.type === 'around-city' &&
                  props.onDestinationChange({ ...props.destination, radiusKm: v })
                }
              />
            </div>
          </Stack>
        </Collapse>
      </div>

      <div data-testid="discover-field-advanced">
        <Button
          size="xs"
          variant="subtle"
          onClick={props.onToggleAdvanced}
          data-testid="discover-toggle-advanced"
        >
          {t('advanced')}
        </Button>
        <Collapse in={props.advancedOpened}>
          <Group mt="xs">
            <Button
              variant="light"
              size="xs"
              onClick={props.onUseMyLocation}
              data-testid="discover-use-my-location"
            >
              {t('useMyLocation')}
              {props.startLoc
                ? ` (${props.startLoc.lat.toFixed(2)}, ${props.startLoc.lon.toFixed(2)})`
                : ''}
            </Button>
            {props.startLoc && (
              <Button
                variant="subtle"
                size="xs"
                onClick={props.onClearStartLoc}
                data-testid="discover-clear-start-location"
              >
                {t('clear')}
              </Button>
            )}
          </Group>
          {props.geoError && (
            <Alert
              color="red"
              mt="xs"
              icon={<IconAlertCircle size={16} />}
              data-testid="discover-geo-error"
            >
              {props.geoError}
            </Alert>
          )}
        </Collapse>
      </div>

      {props.tripLengthsDays.length === 0 && (
        <Alert
          color="yellow"
          icon={<IconAlertCircle size={16} />}
          data-testid="discover-warning-trip-length"
        >
          {t('pickTripLength')}
        </Alert>
      )}

      {props.error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} data-testid="discover-form-error">
          {props.error}
        </Alert>
      )}

      <Divider />

      <Button
        leftSection={<IconSearch size={16} />}
        onClick={props.onSubmit}
        loading={props.loading}
        disabled={props.tripLengthsDays.length === 0 || props.selectedLeagues.length === 0}
        fullWidth
        size="md"
        data-testid="discover-submit"
      >
        {props.submitLabel ?? t('discover')}
      </Button>
    </Stack>
  );
}

export { DISCOVER_DEFAULT_TRIP_LENGTHS };
