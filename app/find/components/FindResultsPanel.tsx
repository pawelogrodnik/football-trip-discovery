'use client';

import { memo, useMemo } from 'react';
import { IconArrowLeft } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'components/providers/LocaleProvider';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import FindMatchCard from './FindMatchCard';
import {
  countConfirmedTbc,
  formatDayHeader,
  formatScheduleWindow,
  formatShortDayRange,
  groupMatchesByDay,
  LooseMatch,
  matchIdOf,
  selectedTripRange,
} from './findResultsUtils';

export type ResultsFilter = 'all' | 'selected';

type Props = {
  matches: LooseMatch[];
  selectedIds: string[];
  filter: ResultsFilter;
  onFilterChange: (f: ResultsFilter) => void;
  onToggle: (id: string) => void;
  onFocus: (m: LooseMatch) => void;
  onHover: (id: string | null) => void;
  hoveredId: string | null;
  onBack: () => void;
  onCreateTrip: () => void;
  headerTitle: string;
  headerSubtitle: string;
  customizeMode: boolean;
  onResetSuggested?: () => void;
  showReset?: boolean;
  outsideIds?: Set<string>;
  selectedRangeSuffix?: string;
};

function FooterPreview({
  selectedMatches,
  onCreateTrip,
}: {
  selectedMatches: LooseMatch[];
  onCreateTrip: () => void;
}) {
  const t = useTranslations('FindMatches');
  const locale = useLocale();
  const range = useMemo(() => selectedTripRange(selectedMatches), [selectedMatches]);
  const rangeLabel = useMemo(
    () =>
      range.startISO && range.endISO
        ? formatShortDayRange(range.startISO, range.endISO, locale)
        : '',
    [range, locale]
  );
  const { confirmed, tbc } = useMemo(() => countConfirmedTbc(selectedMatches), [selectedMatches]);
  const countLabel = useMemo(
    () =>
      tbc > 0
        ? t('confirmedTbcCount', { confirmed, tbc })
        : t('selectedCount', { count: range.count }),
    [t, tbc, confirmed, range.count]
  );
  const sub =
    range.count === 0
      ? ''
      : range.dayCount <= 1
        ? rangeLabel
        : t('selectedRangeDays', {
            range: rangeLabel,
            count: range.dayCount,
          });
  return (
    <div data-testid="find-selection-footer">
      <Text size="sm" fw={600} data-testid="find-selected-count">
        {countLabel}
      </Text>
      {sub ? (
        <Text size="xs" c="dimmed" data-testid="find-selected-range">
          {sub}
        </Text>
      ) : null}
      <Button
        fullWidth
        mt={8}
        disabled={range.count === 0}
        onClick={onCreateTrip}
        data-testid="find-create-trip"
      >
        {t('createTrip')}
      </Button>
    </div>
  );
}

function FindResultsPanelInner({
  matches,
  selectedIds,
  filter,
  onFilterChange,
  onToggle,
  onFocus,
  onHover,
  hoveredId,
  onBack,
  onCreateTrip,
  headerTitle,
  headerSubtitle,
  customizeMode,
  onResetSuggested,
  showReset,
  outsideIds,
}: Props) {
  const t = useTranslations('FindMatches');
  const locale = useLocale();
  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

  const visibleMatches = useMemo(
    () => (filter === 'selected' ? matches.filter((m) => selectedSet.has(matchIdOf(m))) : matches),
    [matches, filter, selectedSet]
  );
  const groups = useMemo(() => groupMatchesByDay(visibleMatches), [visibleMatches]);
  const selectedMatches = useMemo(
    () => matches.filter((m) => selectedSet.has(matchIdOf(m))),
    [matches, selectedSet]
  );

  return (
    <Stack gap={0} style={{ height: '100%', minHeight: 0 }}>
      <div style={{ paddingBottom: 8 }}>
        <Group gap={8} wrap="nowrap" align="flex-start">
          <ActionIcon
            variant="default"
            aria-label={t('editSearch')}
            onClick={onBack}
            data-testid="find-back-to-search"
            style={{ flexShrink: 0, marginTop: 2 }}
          >
            <IconArrowLeft style={{ width: '70%', height: '70%' }} stroke={1.5} />
          </ActionIcon>
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={700} size="sm" truncate data-testid="find-results-title">
              {headerTitle}
            </Text>
            <Text size="xs" c="dimmed" truncate data-testid="find-results-subtitle">
              {headerSubtitle}
            </Text>
            {customizeMode ? (
              <Badge
                size="xs"
                variant="light"
                color="violet"
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
                data-testid="find-customizing-badge"
              >
                {t('customizingBadge')}
              </Badge>
            ) : null}
          </Stack>
        </Group>
        <Group gap={8} wrap="nowrap" mt={8} justify="space-between">
          <SegmentedControl
            size="xs"
            value={filter}
            onChange={(v) => onFilterChange(v as ResultsFilter)}
            data-testid="find-view-filter"
            data={[
              { label: `${t('allMatches')} ${matches.length}`, value: 'all' },
              { label: `${t('selectedMatches')} ${selectedIds.length}`, value: 'selected' },
            ]}
            style={{ flex: 1 }}
          />
        </Group>
        {showReset && customizeMode ? (
          <Button
            variant="subtle"
            size="xs"
            mt={4}
            onClick={onResetSuggested}
            data-testid="find-reset-suggested"
          >
            {t('resetSuggested')}
          </Button>
        ) : null}
      </div>

      <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto" data-testid="find-results-list">
        <Stack gap={8} pb={8}>
          {filter === 'selected' && selectedMatches.length === 0 ? (
            <div data-testid="find-selected-empty">
              <Text size="sm" fw={600}>
                {t('noSelectedTitle')}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                {t('noSelectedHint')}
              </Text>
              <Button
                variant="light"
                size="xs"
                mt={8}
                onClick={() => onFilterChange('all')}
                data-testid="find-show-all"
              >
                {t('showAll')}
              </Button>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.dayKey}>
                <Text
                  size="xs"
                  fw={700}
                  c="dimmed"
                  data-testid={`find-day-${g.dayKey}`}
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    background: 'var(--mantine-color-body)',
                    padding: '6px 2px 4px',
                  }}
                >
                  {g.window
                    ? `${formatScheduleWindow(g.window.startDateOnly, g.window.endDateOnly, locale)} · ${t('scheduleTbc')}`
                    : formatDayHeader(g.dateTime, locale)}
                </Text>
                <Stack gap={8} mt={2}>
                  {g.matches.map((m) => {
                    const id = matchIdOf(m);
                    return (
                      <FindMatchCard
                        key={id || `${g.dayKey}-${m.homeTeam?.name}-${m.awayTeam?.name}`}
                        match={m}
                        selected={selectedSet.has(id)}
                        hovered={hoveredId === id}
                        outsideRadius={outsideIds?.has(id) ?? false}
                        onToggle={onToggle}
                        onFocus={onFocus}
                        onHover={onHover}
                      />
                    );
                  })}
                </Stack>
              </div>
            ))
          )}
        </Stack>
      </ScrollArea>

      <div
        style={{
          borderTop: '1px solid var(--mantine-color-gray-3)',
          paddingTop: 10,
          marginTop: 4,
          background: 'var(--mantine-color-body)',
        }}
      >
        <FooterPreview selectedMatches={selectedMatches} onCreateTrip={onCreateTrip} />
      </div>
    </Stack>
  );
}

const FindResultsPanel = memo(FindResultsPanelInner);
export default FindResultsPanel;
