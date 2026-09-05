'use client';

import { memo } from 'react';
import { IconExternalLink } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'components/providers/LocaleProvider';
import { Anchor, Badge, Card, Checkbox, Group, Stack, Text } from '@mantine/core';
import {
  formatDistanceKmDisplay,
  formatKickoffTime,
  formatScheduleWindow,
  isApproximateKickoff,
  isTbcMatch,
  LooseMatch,
  matchDateTimeOf,
  matchIdOf,
} from '../../find/components/findResultsUtils';
import { getFixtureSchedule } from '../../lib/matchSchedule';
import { CompetitionLogo, TeamCrest } from './crests';

export type MatchCardVariant = 'selectable' | 'trip';

type Props = {
  match: LooseMatch;
  variant: MatchCardVariant;
  selected?: boolean;
  hovered?: boolean;
  /** Selectable only: flags matches merged from outside the search radius. */
  outsideRadius?: boolean;
  /** Test-id prefix, e.g. "find-match-card" or "trip-match-card". */
  testIdPrefix: string;
  /** Checkbox test-id prefix (selectable only). Defaults to `${testIdPrefix}-select`. */
  selectTestIdPrefix?: string;
  onToggle?: (id: string) => void;
  onFocus?: (match: LooseMatch) => void;
  onHover?: (id: string | null) => void;
  /** Trip only: compact external-maps href for the stadium. */
  navigationHref?: string | null;
};

function FixtureRow({ name, crest }: { name: string; crest?: string | null }) {
  return (
    <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
      <TeamCrest name={name} crest={crest} size={28} />
      <Text size="sm" fw={600} truncate style={{ lineHeight: 1.3 }}>
        {name}
      </Text>
    </Group>
  );
}

function SharedMatchCardInner({
  match,
  variant,
  selected = false,
  hovered = false,
  outsideRadius = false,
  testIdPrefix,
  selectTestIdPrefix,
  onToggle,
  onFocus,
  onHover,
  navigationHref,
}: Props) {
  const tFind = useTranslations('FindMatches');
  const tTrip = useTranslations('TripPage');
  const locale = useLocale();
  const id = matchIdOf(match);
  const selectable = variant === 'selectable';
  const home = match.homeTeam?.name ?? '?';
  const away = match.awayTeam?.name ?? '?';
  const schedule = getFixtureSchedule(match as never);
  const isWindow = schedule?.status === 'date-window';
  const isDayOnly =
    schedule?.status === 'date-confirmed' && !match.date?.dateTime && !match.utcDate;
  const iso = isWindow ? '' : matchDateTimeOf(match);
  const approx = isApproximateKickoff(match);
  // Window fixtures never show a kickoff; date-confirmed (day known, no
  // time) shows a TBC label instead of a synthetic noon time.
  const kickoff = !isWindow && !isDayOnly ? formatKickoffTime(iso, locale, approx) : '';
  const tbcLabel = isWindow
    ? `${formatScheduleWindow(schedule.startDate, schedule.endDate, locale)} · ${tFind('scheduleTbc')}`
    : isDayOnly
      ? (tFind('kickoffTbc') as string)
      : null;
  const showTbc = isTbcMatch(match);
  const competition = match.competition?.name ?? '';
  const venue = match.stadium?.venue || match.stadium?.address || '';
  const distance = selectable ? formatDistanceKmDisplay(match._distanceKm) : null;

  return (
    <Card
      withBorder
      radius="md"
      padding="sm"
      shadow={selected ? 'sm' : hovered ? 'sm' : 'xs'}
      onClick={() => onFocus?.(match)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onFocus?.(match);
        }
      }}
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
      tabIndex={0}
      role="button"
      aria-label={`${home} vs ${away}, ${kickoff || tbcLabel || ''}`}
      data-testid={`${testIdPrefix}-${id}`}
      data-selected={selected ? 'true' : undefined}
      data-hovered={hovered ? 'true' : undefined}
      style={{
        cursor: 'pointer',
        background: selected ? 'var(--mantine-color-blue-0)' : undefined,
        borderColor: selected ? 'var(--mantine-color-blue-5)' : undefined,
        borderWidth: selected ? 1.5 : undefined,
      }}
    >
      <Group gap={8} wrap="nowrap" align="flex-start">
        {selectable ? (
          <Checkbox
            checked={selected}
            onChange={() => onToggle?.(id)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            size="md"
            aria-label={tFind('selectMatch', { home, away })}
            data-testid={`${selectTestIdPrefix ?? `${testIdPrefix}-select`}-${id}`}
            styles={{ input: { cursor: 'pointer' } }}
            mt={2}
          />
        ) : null}
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <FixtureRow name={home} crest={match.homeTeam?.crest} />
          <Text
            size="xs"
            c="dimmed"
            fw={500}
            pl={36}
            style={{ lineHeight: 1, fontSize: 10, letterSpacing: '0.04em' }}
          >
            {tFind('versus')}
          </Text>
          <FixtureRow name={away} crest={match.awayTeam?.crest} />

          <Group gap={6} wrap="nowrap" mt={4} style={{ minWidth: 0 }}>
            {competition ? <CompetitionLogo name={competition} boxSize={24} /> : null}
            <Text size="xs" c="dimmed" fw={500} truncate style={{ minWidth: 0 }}>
              {competition}
            </Text>
            {kickoff ? (
              <Text size="xs" fw={700} style={{ whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                {kickoff}
              </Text>
            ) : tbcLabel ? (
              <Text
                size="xs"
                fw={700}
                style={{ whiteSpace: 'nowrap', marginLeft: 'auto' }}
                data-testid={`${testIdPrefix}-tbc-${id}`}
              >
                {tbcLabel}
              </Text>
            ) : null}
          </Group>

          <Group gap={6} wrap="nowrap" justify="space-between" style={{ minWidth: 0 }}>
            <Text size="xs" c="dimmed" truncate style={{ minWidth: 0, flex: 1 }}>
              {venue}
            </Text>
            {distance ? (
              <Badge size="sm" variant="light" color="gray" style={{ flexShrink: 0 }}>
                {distance}
              </Badge>
            ) : null}
            {!selectable && navigationHref ? (
              <Anchor
                size="xs"
                fw={600}
                href={navigationHref}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                data-testid={`${testIdPrefix}-maps-${id}`}
                style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <IconExternalLink size={13} />
                {tTrip('openInMaps')}
              </Anchor>
            ) : null}
          </Group>
          {approx && kickoff ? (
            <Text size="xs" c="dimmed" data-testid={`${testIdPrefix}-approx-${id}`}>
              {tFind('approxTime')}
            </Text>
          ) : null}
          {showTbc && !isWindow && !isDayOnly ? (
            <Text size="xs" c="dimmed" data-testid={`${testIdPrefix}-tbc-note-${id}`}>
              {tFind('scheduleTbc')}
            </Text>
          ) : null}
          {isWindow ? (
            <Text size="xs" c="dimmed" data-testid={`${testIdPrefix}-tbc-note-${id}`}>
              {tFind('dateKickoffTbc')}
            </Text>
          ) : null}
          {selectable && outsideRadius ? (
            <Badge
              size="xs"
              variant="outline"
              color="orange"
              data-testid={`${testIdPrefix}-outside-${id}`}
            >
              {tFind('outsideRadius')}
            </Badge>
          ) : null}
        </Stack>
      </Group>
    </Card>
  );
}

const SharedMatchCard = memo(SharedMatchCardInner);
export default SharedMatchCard;
