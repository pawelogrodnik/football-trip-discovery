'use client';

import Link from 'next/link';
import { IconAlertCircle, IconSearch } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'components/providers/LocaleProvider';
import { FOOTBALL_DISTANCE_OPTIONS_KM } from 'lib/distance';
import { FindSearchCriteria } from 'lib/tripUrls';
import { Alert, Button, Chip, Group, ScrollArea, Stack, Text, Title } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { AutocompleteLoading } from '../../components/form/AutoComplete';
import { coerceToDate } from '../../discover/components/format';

type Props = {
  criteria: FindSearchCriteria;
  onChange: (c: FindSearchCriteria) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
};

export default function FindSearchForm({ criteria, onChange, onSubmit, loading, error }: Props) {
  const t = useTranslations('FindMatches');
  const locale = useLocale();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Stack gap="lg" data-testid="find-search-form">
      <div data-testid="find-search-heading">
        <Title order={2}>{t('title')}</Title>
        <Text size="sm" c="dimmed" mt={4}>
          {t('subtitle')}
        </Text>
      </div>

      <div data-testid="find-field-destination">
        <AutocompleteLoading
          initialValue={criteria.location?.label ?? ''}
          label={t('destination')}
          placeholder={t('destinationPlaceholder')}
          onLocationSelect={(loc) => onChange({ ...criteria, location: loc })}
        />
      </div>

      <div data-testid="find-field-dates">
        <Text size="sm" fw={600} mb={4}>
          {t('dates')}
        </Text>
        <DatePickerInput
          type="range"
          locale={locale}
          placeholder={t('datesPlaceholder')}
          value={[criteria.startDate, criteria.endDate]}
          onChange={(v) => {
            const [s, e] = v as [unknown, unknown];
            onChange({ ...criteria, startDate: coerceToDate(s), endDate: coerceToDate(e) });
          }}
          minDate={today}
          popoverProps={{ withinPortal: true, zIndex: 5000, position: 'bottom-start' }}
        />
      </div>

      <div data-testid="find-field-radius">
        <Text size="sm" fw={600} mb={4}>
          {t('radius')}
        </Text>
        <ScrollArea
          scrollbars="x"
          type="auto"
          className="find-radius-rail"
          data-testid="find-radius-scroll"
        >
          <Chip.Group
            value={String(criteria.radiusKm)}
            onChange={(v) => onChange({ ...criteria, radiusKm: Number(v) })}
          >
            <Group gap={8} wrap="nowrap" pr={12} data-testid="find-radius-control">
              {FOOTBALL_DISTANCE_OPTIONS_KM.map((r) => (
                <span key={r} style={{ flexShrink: 0 }} data-testid={`find-radius-${r}`}>
                  <Chip value={String(r)} variant="filled">
                    {r} km
                  </Chip>
                </span>
              ))}
              {!FOOTBALL_DISTANCE_OPTIONS_KM.includes(
                criteria.radiusKm as (typeof FOOTBALL_DISTANCE_OPTIONS_KM)[number]
              ) && (
                <span style={{ flexShrink: 0 }} data-testid={`find-radius-${criteria.radiusKm}`}>
                  <Chip value={String(criteria.radiusKm)} variant="filled">
                    {criteria.radiusKm} km
                  </Chip>
                </span>
              )}
            </Group>
          </Chip.Group>
        </ScrollArea>
      </div>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} data-testid="find-form-error">
          {error}
        </Alert>
      )}

      <Button
        leftSection={<IconSearch size={16} />}
        onClick={onSubmit}
        loading={loading}
        disabled={!criteria.location || !criteria.startDate || !criteria.endDate}
        fullWidth
        size="md"
        data-testid="find-submit"
      >
        {t('findMatches')}
      </Button>

      <Text size="sm" c="dimmed" ta="center" data-testid="find-discover-link">
        {t('notSureWhere')} <Link href="/">{t('discoverTrips')} →</Link>
      </Text>
    </Stack>
  );
}
