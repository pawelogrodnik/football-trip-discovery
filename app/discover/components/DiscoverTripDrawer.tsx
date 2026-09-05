'use client';

import { IconBallFootball, IconBed, IconPencil, IconRoute, IconTrophy } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'components/providers/LocaleProvider';
import { isUefaCompetition } from 'lib/competitionPriority';
import type { DiscoverTrip } from 'lib/discover';
import { getFixtureSchedule, scheduleCertaintyCounts } from 'lib/matchSchedule';
import { Avatar, Badge, Button, Drawer, Group, Stack, Text, Timeline } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { formatKickoff, formatShortRange, formatTripDayLabel, matchIdOf } from './format';
import classes from '../discover.module.css';

type Props = {
  trip: DiscoverTrip | null;
  onClose: () => void;
  onCustomize?: (trip: DiscoverTrip) => void;
};

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

/** "UEFA Champions League" already contains the prefix — don't duplicate it. */
function uefaBadgeLabel(name: string): string {
  return /^uefa\s/i.test(name.trim()) ? name.trim() : `UEFA ${name.trim()}`;
}

export default function DiscoverTripDrawer({ trip, onClose, onCustomize }: Props) {
  const t = useTranslations('Discover');
  const locale = useLocale();
  const isMobile = useMediaQuery('(max-width: 768px)');
  // User-facing certainty: date-confirmed itinerary slots count as TBC.
  const confirmedCount = trip?.confirmedCount ?? scheduleCertaintyCounts(trip?.matches).confirmed;
  const tbcTotal =
    trip?.tbcCount ?? scheduleCertaintyCounts(trip?.matches).tbc + (trip?.tbcMatches?.length ?? 0);

  return (
    <Drawer
      opened={trip !== null}
      onClose={onClose}
      position={isMobile ? 'bottom' : 'right'}
      size={isMobile ? '85vh' : 'clamp(380px, 24vw, 440px)'}
      title={trip ? trip.destinationLabel || 'Football trip' : ''}
      withOverlay={false}
      // Above the results dock (1001, portal order wins ties), below the header (1002).
      zIndex={1001}
      data-testid="discover-trip-drawer"
      className="discover-trip-drawer"
    >
      {trip && (
        <Stack gap="sm" data-testid="discover-drawer-body">
          <Text size="sm" c="dimmed" data-testid="discover-drawer-dates">
            {formatShortRange(trip.tripStartDate, trip.tripEndDate, locale, true)} ·{' '}
            {t('daysOption', { count: trip.tripLengthDays })}
          </Text>
          <Group gap={6} data-testid="discover-drawer-badges">
            <Badge variant="light" leftSection={<IconBallFootball size={12} />}>
              {tbcTotal > 0
                ? t('confirmedTbc', { confirmed: confirmedCount, tbc: tbcTotal })
                : t('matchCount', { count: trip.matchCount })}
            </Badge>
            {trip.uefaMatchCount > 0 && (
              <Badge variant="light" color="violet" leftSection={<IconTrophy size={12} />}>
                {t('uefaCount', { count: trip.uefaMatchCount })}
              </Badge>
            )}
            <Badge variant="outline" color="gray" leftSection={<IconRoute size={12} />}>
              {t('totalKm', { count: trip.totalKm })}
            </Badge>
          </Group>
          <div className={classes.drawerBaseBox} data-testid="discover-drawer-base">
            {trip.destinationLabel && trip.destinationLabel !== 'Football trip' ? (
              <>
                <Group gap={6} wrap="nowrap">
                  <IconBed size={16} />
                  <Text size="sm" fw={600}>
                    {t('drawerBase', { city: trip.destinationLabel })}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" mt={2}>
                  {t('maxLeg', { km: trip.maxLegKm })}
                </Text>
              </>
            ) : (
              <>
                <Group gap={6} wrap="nowrap">
                  <IconRoute size={16} />
                  <Text size="sm" fw={600}>
                    {t('matchCount', { count: trip.matchCount })} ·{' '}
                    {t('daysOption', { count: trip.tripLengthDays })}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" mt={2}>
                  {t('maxLeg', { km: trip.maxLegKm })}
                </Text>
              </>
            )}
          </div>
          {trip.matches.length > 0 ? (
            <>
              {tbcTotal > 0 && (
                <Text size="sm" fw={700} data-testid="discover-drawer-confirmed-heading">
                  {t('confirmedItinerary')}
                </Text>
              )}
              <Timeline
                active={trip.matchCount}
                bulletSize={24}
                lineWidth={2}
                data-testid="discover-drawer-timeline"
              >
                {trip.matches.map((m, i) => {
                  const leg = trip.legs?.find((l) => l.fromIdx === i);
                  const schedule = getFixtureSchedule(m);
                  // Day known but kickoff TBC: never render a synthetic noon time.
                  const isDayOnly = schedule?.status === 'date-confirmed' && !m.date?.dateTime;
                  const dateTime = isDayOnly
                    ? `${schedule.date}T12:00:00.000Z`
                    : (m.date?.dateTime ??
                      (m.date?.date ? `${m.date.date}T12:00:00.000Z` : undefined));
                  return (
                    <Timeline.Item
                      key={matchIdOf(m)}
                      bullet={
                        <Text size="sm" fw={700}>
                          {i + 1}
                        </Text>
                      }
                      title={
                        <Group gap={6} wrap="nowrap">
                          <Crest
                            name={m.homeTeam?.name ?? ''}
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
                            name={m.awayTeam?.name ?? ''}
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
                        {isDayOnly ? (
                          <>
                            {formatTripDayLabel(dateTime, locale)} · {t('kickoffTbc')}
                          </>
                        ) : (
                          <>
                            {formatTripDayLabel(dateTime, locale)} ·{' '}
                            {m.date?.approximate ? '~' : ''}
                            {formatKickoff(dateTime, locale)}
                          </>
                        )}
                      </Text>
                      <Group gap={4} mt={2}>
                        {isUefaCompetition(m.competition) && (
                          <Badge size="xs" variant="light" color="violet">
                            {uefaBadgeLabel(m.competition?.name ?? '')}
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">
                        {m.competition?.name}
                        {(m.stadium?.name || m.stadium?.city) &&
                          ` • ${[m.stadium?.name, m.stadium?.city].filter(Boolean).join(', ')}`}
                      </Text>
                      {leg && (
                        <Badge size="xs" variant="outline" color="gray" mt={4}>
                          ↓ {t('toNext', { km: leg.km })}
                        </Badge>
                      )}
                    </Timeline.Item>
                  );
                })}
              </Timeline>
            </>
          ) : null}
          {(trip.tbcMatches?.length ?? 0) > 0 && (
            <Stack gap={6} mt="sm" data-testid="discover-drawer-tbc">
              <Text size="sm" fw={700} data-testid="discover-drawer-tbc-heading">
                {t('possibleMatches')}
              </Text>
              {(trip.tbcMatches ?? []).map((m) => {
                const window =
                  m.date?.startDate && m.date?.endDate
                    ? { start: m.date.startDate, end: m.date.endDate }
                    : null;
                return (
                  <Group
                    key={matchIdOf(m)}
                    gap={6}
                    wrap="nowrap"
                    data-testid="discover-drawer-tbc-item"
                  >
                    <Crest name={m.homeTeam?.name ?? ''} crest={m.homeTeam?.crest} size={20} />
                    <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                      <Text size="sm" fw={500} lineClamp={1}>
                        {m.homeTeam?.name} vs {m.awayTeam?.name}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {window
                          ? `${formatShortRange(window.start, window.end, locale)} · ${m.competition?.name ?? ''}`
                          : (m.competition?.name ?? '')}
                      </Text>
                    </Stack>
                  </Group>
                );
              })}
              <Text size="xs" c="dimmed">
                {t('tbcOpportunities', { count: trip.tbcMatches?.length ?? 0 })}
              </Text>
            </Stack>
          )}
          {onCustomize && (
            <Button
              variant="light"
              leftSection={<IconPencil size={16} />}
              fullWidth
              data-testid="discover-customize-trip"
              onClick={() => onCustomize(trip)}
            >
              {t('customizeTrip')}
            </Button>
          )}
        </Stack>
      )}
    </Drawer>
  );
}
