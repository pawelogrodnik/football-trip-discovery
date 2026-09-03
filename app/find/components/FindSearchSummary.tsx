'use client';

import { CSSProperties, ReactNode } from 'react';
import { IconCalendar, IconMapPin, IconPencil, IconRuler } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'components/providers/LocaleProvider';
import { FindSearchCriteria } from 'lib/tripUrls';
import { Badge, Button, Divider, Group, Paper, Text } from '@mantine/core';
import { formatShortDayRange } from './findResultsUtils';
import classes from '../find.module.css';

type Props = {
  criteria: FindSearchCriteria;
  onEdit: () => void;
  customizeMode: boolean;
  /** Shift (px) left so the bar centers over the visible map area, not viewport. */
  centerShiftPx?: number;
  /** Cap so the bar never slides under the floating results panel. */
  maxWidth?: string;
};

function Item({
  icon,
  children,
  testId,
  style,
  title,
}: {
  icon: ReactNode;
  children: ReactNode;
  testId: string;
  style?: CSSProperties;
  title?: string;
}) {
  return (
    <Group
      gap={6}
      wrap="nowrap"
      data-testid={testId}
      style={{ flexShrink: 0, ...style }}
      title={title}
    >
      <span style={{ display: 'inline-flex', color: 'var(--mantine-color-dimmed)', flexShrink: 0 }}>
        {icon}
      </span>
      <Text size="sm" fw={500} truncate style={{ minWidth: 0 }}>
        {children}
      </Text>
    </Group>
  );
}

export default function FindSearchSummary({
  criteria,
  onEdit,
  customizeMode,
  centerShiftPx = 0,
  maxWidth,
}: Props) {
  const t = useTranslations('FindMatches');
  const locale = useLocale();
  const dates =
    criteria.startDate && criteria.endDate
      ? formatShortDayRange(
          criteria.startDate.toISOString(),
          criteria.endDate.toISOString(),
          locale
        )
      : '';
  const fullLabel = criteria.location?.label ?? '';
  return (
    <div
      className={classes.summaryBar}
      data-testid="find-search-summary"
      style={{
        ...(centerShiftPx ? { marginLeft: -centerShiftPx } : undefined),
        ...(maxWidth ? { maxWidth } : undefined),
      }}
    >
      <Paper radius="lg" shadow="md" px="md" py="xs" className={classes.summaryPaper}>
        <Group gap={12} wrap="nowrap" align="center" className={classes.summaryInner}>
          <Item
            icon={<IconMapPin size={16} />}
            testId="find-summary-location"
            style={{ flex: '1 1 auto', minWidth: 0 }}
            title={fullLabel || undefined}
          >
            {fullLabel}
          </Item>
          <Divider orientation="vertical" style={{ flexShrink: 0 }} />
          <Item icon={<IconCalendar size={16} />} testId="find-summary-dates">
            {dates}
          </Item>
          <Divider orientation="vertical" style={{ flexShrink: 0 }} />
          <Item icon={<IconRuler size={16} />} testId="find-summary-radius">
            {criteria.radiusKm} km
          </Item>
          <Divider orientation="vertical" style={{ flexShrink: 0 }} />
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPencil size={14} />}
            onClick={onEdit}
            data-testid="find-summary-edit"
            style={{ flexShrink: 0 }}
          >
            {t('editSearch')}
          </Button>
          {customizeMode && (
            <Badge
              size="xs"
              variant="light"
              color="violet"
              data-testid="find-customize-notice"
              style={{ flexShrink: 0 }}
            >
              {t('customizingBadge')}
            </Badge>
          )}
        </Group>
      </Paper>
    </div>
  );
}
