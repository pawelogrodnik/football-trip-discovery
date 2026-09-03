'use client';

import { IconCalendar, IconClock, IconMapPin, IconPencil, IconTrophy } from '@tabler/icons-react';
import { useTranslations } from 'components/providers/LocaleProvider';
import { Button, Divider, Group, Paper, Text } from '@mantine/core';
import { formatShortRange } from './format';
import classes from '../discover.module.css';

type Props = {
  availabilityStart: string | null;
  availabilityEnd: string | null;
  tripLengthsDays: number[];
  competitionSummary: string;
  maxInterTravelKm: number;
  locale: string;
  onEdit: () => void;
};

function SummaryItem({
  icon,
  children,
  testId,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <Group gap={6} wrap="nowrap" data-testid={testId}>
      <span className={classes.summaryIcon}>{icon}</span>
      <Text size="sm" fw={500} lineClamp={1}>
        {children}
      </Text>
    </Group>
  );
}

export default function DiscoverSearchSummary({
  availabilityStart,
  availabilityEnd,
  tripLengthsDays,
  competitionSummary,
  maxInterTravelKm,
  locale,
  onEdit,
}: Props) {
  const t = useTranslations('Discover');
  const daysLabel =
    tripLengthsDays.length > 0
      ? `${Math.min(...tripLengthsDays)}–${Math.max(...tripLengthsDays)} ${t('daysShort')}`
      : '';

  return (
    <div className={classes.summaryBar} data-testid="discover-search-summary">
      <Paper radius="lg" shadow="md" px="md" py="xs" className={classes.summaryPaper}>
        <SummaryItem icon={<IconCalendar size={16} />} testId="discover-summary-dates">
          {formatShortRange(availabilityStart, availabilityEnd, locale, true)}
        </SummaryItem>
        <Divider orientation="vertical" />
        <SummaryItem icon={<IconClock size={16} />} testId="discover-summary-duration">
          {daysLabel}
        </SummaryItem>
        <Divider orientation="vertical" />
        <SummaryItem icon={<IconTrophy size={16} />} testId="discover-summary-competitions">
          {competitionSummary}
        </SummaryItem>
        <Divider orientation="vertical" />
        <SummaryItem icon={<IconMapPin size={16} />} testId="discover-summary-distance">
          {t('summaryDistance', { km: maxInterTravelKm })}
        </SummaryItem>
        <Divider orientation="vertical" />
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPencil size={14} />}
          onClick={onEdit}
          data-testid="discover-summary-edit"
        >
          {t('editSearch')}
        </Button>
      </Paper>
    </div>
  );
}
