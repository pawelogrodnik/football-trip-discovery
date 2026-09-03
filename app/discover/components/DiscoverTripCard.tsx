'use client';

import { useMemo } from 'react';
import {
  IconBallFootball,
  IconChevronRight,
  IconMapPin,
  IconRoute,
  IconStar,
  IconTrophy,
} from '@tabler/icons-react';
import { useLocale, useTranslations } from 'components/providers/LocaleProvider';
import type { DiscoverTrip } from 'lib/discover';
import { Badge, Box, Button, Card, Group, Stack, Text, Tooltip } from '@mantine/core';
import { formatShortRange } from './format';
import {
  getFeaturedTripMatch,
  getTripCountryLabel,
  getVisibleTripCompetitions,
  getVisibleTripTeams,
} from './tripCardData';
import classes from '../discover.module.css';

type Props = {
  trip: DiscoverTrip;
  selected: boolean;
  isTopPick: boolean;
  onSelect: () => void;
  onView: () => void;
  variant?: 'regular' | 'compact';
};

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Football crest with contain fit (never cropped) + initials fallback. */
function TeamCrest({ name, crest, size }: { name: string; crest?: string | null; size: number }) {
  return (
    <Tooltip label={name} withArrow position="top">
      <Box className={classes.teamCrestBox} style={{ width: size, height: size }}>
        {crest ? (
          <img
            src={crest}
            alt={`${name} crest`}
            width={size - 6}
            height={size - 6}
            loading="lazy"
            className={classes.teamCrestImg}
          />
        ) : (
          <Text size="xs" fw={700} c="blue" aria-label={`${name} crest`}>
            {initials(name)}
          </Text>
        )}
      </Box>
    </Tooltip>
  );
}

function CompetitionLogo({
  name,
  logo,
  boxSize = 26,
}: {
  name: string;
  logo: string;
  boxSize?: number;
}) {
  const imgSize = boxSize - 6;
  return (
    <Tooltip label={name} withArrow position="top">
      <Box className={classes.compLogoBox} style={{ width: boxSize, height: boxSize }}>
        <img
          src={logo}
          alt={`${name} logo`}
          width={imgSize}
          height={imgSize}
          loading="lazy"
          className={classes.teamCrestImg}
        />
      </Box>
    </Tooltip>
  );
}

function TopPickBadge({ label }: { label: string }) {
  return (
    <Badge
      size="xs"
      color="yellow"
      variant="light"
      leftSection={<IconStar size={11} />}
      style={{ flexShrink: 0 }}
    >
      {label}
    </Badge>
  );
}

function MetricsRow({
  uefaCount,
  totalKm,
  matchLabel,
  uefaLabel,
  kmLabel,
}: {
  uefaCount: number;
  totalKm: number;
  matchLabel: string;
  uefaLabel: string;
  kmLabel: string;
}) {
  return (
    <Group gap="sm" wrap="nowrap" data-testid="discover-trip-metrics">
      <Group gap={5} wrap="nowrap">
        <IconBallFootball size={14} className={classes.cardMetaIcon} />
        <Text size="xs" fw={600} style={{ whiteSpace: 'nowrap' }}>
          {matchLabel}
        </Text>
      </Group>
      {uefaCount > 0 && (
        <Group gap={5} wrap="nowrap">
          <IconTrophy size={14} className={classes.cardMetaIcon} />
          <Text size="xs" fw={600} style={{ whiteSpace: 'nowrap' }}>
            {uefaLabel}
          </Text>
        </Group>
      )}
      {Number.isFinite(totalKm) && (
        <Group gap={5} wrap="nowrap">
          <IconRoute size={14} className={classes.cardMetaIcon} />
          <Text size="xs" fw={600} style={{ whiteSpace: 'nowrap' }}>
            {kmLabel}
          </Text>
        </Group>
      )}
    </Group>
  );
}

export default function DiscoverTripCard({
  trip,
  selected,
  isTopPick,
  onSelect,
  onView,
  variant = 'regular',
}: Props) {
  const t = useTranslations('Discover');
  const locale = useLocale();

  const { visible: teams, hiddenCount: hiddenTeams } = useMemo(
    () => getVisibleTripTeams(trip.matches, 6),
    [trip.matches]
  );
  const competitions = useMemo(
    () => getVisibleTripCompetitions(trip.matches, variant === 'compact' ? 3 : 5),
    [trip.matches, variant]
  );
  const featured = useMemo(() => getFeaturedTripMatch(trip.matches), [trip.matches]);
  const countryLabel = useMemo(() => getTripCountryLabel(trip.matches), [trip.matches]);

  const destination = trip.destinationLabel || 'Football trip';
  const datesLine = `${formatShortRange(trip.tripStartDate, trip.tripEndDate, locale)} · ${t('daysOption', { count: trip.tripLengthDays })}${countryLabel ? ` · ${countryLabel}` : ''}`;
  const remaining = featured ? trip.matchCount - 1 : trip.matchCount;
  const cardClass =
    variant === 'compact'
      ? `${classes.tripCard} ${classes.tripCardCompact} ${selected ? classes.tripCardSelected : ''}`
      : `${classes.tripCard} ${selected ? classes.tripCardSelected : ''}`;

  return (
    <Card
      withBorder
      radius="lg"
      shadow={selected ? 'md' : 'sm'}
      padding="xs"
      className={cardClass}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="option"
      aria-selected={selected}
      data-testid={`discover-trip-card-${trip.id}`}
    >
      <Stack gap={variant === 'compact' ? 4 : 6}>
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
            <Group gap={6} wrap="nowrap">
              <IconMapPin size={14} className={classes.cardMetaIcon} />
              <Text
                fw={700}
                size={variant === 'compact' ? 'sm' : 'md'}
                truncate
                style={{ lineHeight: 1.25 }}
                data-testid="discover-trip-destination"
              >
                {destination}
              </Text>
            </Group>
            <Text size="xs" c="dimmed" truncate data-testid="discover-trip-dates">
              {datesLine}
            </Text>
          </Stack>
          {isTopPick && <TopPickBadge label={t('topPick')} />}
        </Group>

        <Group gap={6} wrap="nowrap" data-testid="discover-trip-teams">
          {teams.map((team) => (
            <TeamCrest
              key={team.key}
              name={team.name}
              crest={team.crest}
              size={variant === 'compact' ? 28 : 34}
            />
          ))}
          {hiddenTeams > 0 && (
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {t('moreTeams', { count: hiddenTeams })}
            </Text>
          )}
        </Group>

        {competitions.length > 0 && (
          <Group gap={4} wrap="nowrap" data-testid="discover-trip-competitions">
            {competitions.map((c) => (
              <CompetitionLogo
                key={c.key}
                name={c.name}
                logo={c.logo ?? ''}
                boxSize={variant === 'compact' ? 22 : 26}
              />
            ))}
          </Group>
        )}

        <MetricsRow
          uefaCount={trip.uefaMatchCount}
          totalKm={trip.totalKm}
          matchLabel={t('matchCount', { count: trip.matchCount })}
          uefaLabel={t('uefaCount', { count: trip.uefaMatchCount })}
          kmLabel={t('totalKm', { count: trip.totalKm })}
        />

        {variant === 'regular' && featured && (
          <Group
            justify="space-between"
            wrap="nowrap"
            align="flex-end"
            gap="sm"
            data-testid="discover-trip-featured"
          >
            <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
              <Text size="sm" fw={600} truncate>
                {featured.homeTeam?.name} – {featured.awayTeam?.name}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {featured.competition?.name}
                {remaining > 0 ? ` · ${t('moreMatches', { count: remaining })}` : ''}
              </Text>
            </Stack>
            <Button
              size="xs"
              variant="subtle"
              rightSection={<IconChevronRight size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
              aria-label={`${t('viewTrip')}: ${destination}`}
              data-testid="discover-trip-view"
              style={{ flexShrink: 0 }}
            >
              {t('viewTrip')}
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
