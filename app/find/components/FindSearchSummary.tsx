'use client';

import { IconCalendar, IconMapPin, IconPencil, IconRuler } from '@tabler/icons-react';
import { useTranslations } from 'components/providers/LocaleProvider';
import { FindSearchCriteria, toDateOnlyLocal } from 'lib/tripUrls';
import { Button, Divider, Group, Paper, Text } from '@mantine/core';
import classes from '../find.module.css';

type Props = {
  criteria: FindSearchCriteria;
  onEdit: () => void;
  customizeMode: boolean;
};

function Item({
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
      <span>{icon}</span>
      <Text size="sm" fw={500} lineClamp={1}>
        {children}
      </Text>
    </Group>
  );
}

export default function FindSearchSummary({ criteria, onEdit, customizeMode }: Props) {
  const t = useTranslations('FindMatches');
  const dates =
    criteria.startDate && criteria.endDate
      ? `${toDateOnlyLocal(criteria.startDate)} → ${toDateOnlyLocal(criteria.endDate)}`
      : '';
  return (
    <div className={classes.summaryBar} data-testid="find-search-summary">
      <Paper radius="lg" shadow="md" px="md" py="xs" className={classes.summaryPaper}>
        <Item icon={<IconMapPin size={16} />} testId="find-summary-location">
          {criteria.location?.label ?? ''}
        </Item>
        <Divider orientation="vertical" />
        <Item icon={<IconCalendar size={16} />} testId="find-summary-dates">
          {dates}
        </Item>
        <Divider orientation="vertical" />
        <Item icon={<IconRuler size={16} />} testId="find-summary-radius">
          {criteria.radiusKm} km
        </Item>
        <Divider orientation="vertical" />
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPencil size={14} />}
          onClick={onEdit}
          data-testid="find-summary-edit"
        >
          {t('editSearch')}
        </Button>
        {customizeMode && (
          <Text size="xs" c="dimmed" data-testid="find-customize-notice">
            {t('customizeModeNotice')}
          </Text>
        )}
      </Paper>
    </div>
  );
}
