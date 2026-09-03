'use client';

import { useEffect, useRef, useState } from 'react';
import {
  IconAlertCircle,
  IconBallFootball,
  IconBuildingStadium,
  IconBus,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconStar,
  IconTrophy,
} from '@tabler/icons-react';
import { useTranslations } from 'components/providers/LocaleProvider';
import type { DiscoverCategory, DiscoverTrip } from 'lib/discover';
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core';
import DiscoverTripCard from './DiscoverTripCard';
import classes from '../discover.module.css';

const CATEGORY_ICONS: Record<DiscoverCategory, typeof IconStar> = {
  top: IconStar,
  uefa: IconTrophy,
  lower: IconBuildingStadium,
  most: IconBallFootball,
  easy: IconBus,
};

const CATEGORY_LABEL_KEYS: Record<DiscoverCategory, string> = {
  top: 'catTop',
  uefa: 'catUefa',
  lower: 'catLower',
  most: 'catMost',
  easy: 'catEasy',
};

type Props = {
  loading: boolean;
  trips: DiscoverTrip[];
  category: DiscoverCategory;
  availableCategories: DiscoverCategory[];
  onCategoryChange: (c: DiscoverCategory) => void;
  selectedTripId: string | null;
  onSelectTrip: (id: string) => void;
  onViewTrip: (id: string) => void;
  topPickId: string | null;
  error: string | null;
  onEditSearch: () => void;
  /** Right details drawer open -> compact rail automatically. */
  detailsOpen: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

const CARD_STEP = 342; // regular card width + gap
const COMPACT_CARD_STEP = 292; // compact card width + gap

/**
 * One compact ranking switcher: content-sized options centered on desktop,
 * horizontally scrollable on narrow screens. SegmentedControl forces equal
 * segment widths, so a radio-group of buttons is used instead.
 */
function CategoryControl({
  available,
  category,
  onCategoryChange,
  iconOnly,
  t,
}: {
  available: DiscoverCategory[];
  category: DiscoverCategory;
  onCategoryChange: (c: DiscoverCategory) => void;
  iconOnly: boolean;
  t: (key: string) => string;
}) {
  return (
    <Group justify="center">
      <ScrollArea scrollbars="x" type="auto" className={classes.categoryScroll}>
        <Group
          gap={4}
          wrap="nowrap"
          role="radiogroup"
          aria-label={t('catTop')}
          justify="center"
          className={classes.categoryGroup}
        >
          {available.map((id) => {
            const Icon = CATEGORY_ICONS[id];
            const label = t(CATEGORY_LABEL_KEYS[id]);
            const active = id === category;
            return (
              <Button
                key={id}
                size={iconOnly ? 'xs' : 'sm'}
                radius="md"
                variant={active ? 'light' : 'subtle'}
                color={active ? 'blue' : 'gray'}
                role="radio"
                aria-checked={active}
                aria-label={label}
                title={label}
                data-testid={`discover-category-${id}`}
                leftSection={<Icon size={14} />}
                onClick={() => onCategoryChange(id)}
                style={{ flexShrink: 0 }}
              >
                {!iconOnly && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
              </Button>
            );
          })}
        </Group>
      </ScrollArea>
    </Group>
  );
}

function Rail({
  trips,
  variant,
  selectedTripId,
  onSelectTrip,
  onViewTrip,
  topPickId,
  label,
}: {
  trips: DiscoverTrip[];
  variant: 'regular' | 'compact';
  selectedTripId: string | null;
  onSelectTrip: (id: string) => void;
  onViewTrip: (id: string) => void;
  topPickId: string | null;
  label: string;
}) {
  const t = useTranslations('Discover');
  const viewportRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = () => {
    const vp = viewportRef.current;
    if (!vp) {
      return;
    }
    setCanPrev(vp.scrollLeft > 4);
    setCanNext(vp.scrollLeft + vp.clientWidth < vp.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    // Re-check after smooth scroll settles / layout changes variant.
    const id = window.setTimeout(updateArrows, 350);
    return () => window.clearTimeout(id);
  }, [trips.length, variant]);

  // Keep the selected card reachable when selection changes.
  useEffect(() => {
    if (!selectedTripId) {
      return;
    }
    cardRefs.current.get(selectedTripId)?.scrollIntoView({
      inline: 'nearest',
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [selectedTripId]);

  const scrollStep = variant === 'compact' ? COMPACT_CARD_STEP : CARD_STEP;
  const scrollBy = (dir: 1 | -1) => {
    viewportRef.current?.scrollBy({ left: dir * scrollStep, behavior: 'smooth' });
  };

  return (
    <div className={classes.dockRail} data-testid="discover-rail">
      <ScrollArea
        scrollbars="x"
        type="auto"
        viewportRef={viewportRef}
        onScrollPositionChange={updateArrows}
        data-testid="discover-rail-scroll"
      >
        <div
          className={classes.dockScrollInner}
          role="listbox"
          aria-label={label}
          data-testid="discover-trip-list"
        >
          {trips.map((trip) => (
            <div
              key={trip.id}
              ref={(el) => {
                if (el) {
                  cardRefs.current.set(trip.id, el);
                } else {
                  cardRefs.current.delete(trip.id);
                }
              }}
            >
              <DiscoverTripCard
                trip={trip}
                variant={variant}
                selected={trip.id === selectedTripId}
                isTopPick={trip.id === topPickId}
                onSelect={() => onSelectTrip(trip.id)}
                onView={() => onViewTrip(trip.id)}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
      {canPrev && (
        <ActionIcon
          className={`${classes.dockArrow} ${classes.dockArrowLeft}`}
          variant="default"
          radius="xl"
          size="lg"
          aria-label={t('previousTrips')}
          data-testid="discover-rail-prev"
          onClick={() => scrollBy(-1)}
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
      )}
      {canNext && (
        <ActionIcon
          className={`${classes.dockArrow} ${classes.dockArrowRight}`}
          variant="default"
          radius="xl"
          size="lg"
          aria-label={t('nextTrips')}
          data-testid="discover-rail-next"
          onClick={() => scrollBy(1)}
        >
          <IconChevronRight size={18} />
        </ActionIcon>
      )}
    </div>
  );
}

export default function DiscoverResultsDock({
  loading,
  trips,
  category,
  availableCategories,
  onCategoryChange,
  selectedTripId,
  onSelectTrip,
  onViewTrip,
  topPickId,
  error,
  onEditSearch,
  detailsOpen,
  collapsed,
  onToggleCollapsed,
}: Props) {
  const t = useTranslations('Discover');
  const compact = detailsOpen && !collapsed;

  if (collapsed) {
    return (
      <div className={classes.dockWrap} data-testid="discover-results-dock" data-dock="collapsed">
        <Paper radius="lg" shadow="md" px="sm" py={4}>
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" fw={600} truncate data-testid="discover-dock-count">
              {t('tripOptions', { count: trips.length })}
            </Text>
            <ActionIcon
              variant="subtle"
              radius="xl"
              aria-label={t('expandResults')}
              data-testid="discover-dock-expand"
              onClick={onToggleCollapsed}
            >
              <IconChevronUp size={18} />
            </ActionIcon>
          </Group>
        </Paper>
      </div>
    );
  }

  return (
    <div
      className={classes.dockWrap}
      data-testid="discover-results-dock"
      data-dock={compact ? 'compact' : 'regular'}
    >
      <Paper radius="lg" shadow="md" p={compact ? 'xs' : 'sm'}>
        {compact ? (
          <Stack gap={6}>
            <div className={classes.dockCompactBar}>
              <ActionIcon
                variant="subtle"
                radius="xl"
                aria-label={t('collapseResults')}
                data-testid="discover-dock-collapse"
                onClick={onToggleCollapsed}
              >
                <IconChevronDown size={18} />
              </ActionIcon>
              <Text
                size="sm"
                fw={600}
                truncate
                style={{ flex: 1 }}
                data-testid="discover-dock-count"
              >
                {t('tripOptions', { count: trips.length })}
              </Text>
              <CategoryControl
                available={availableCategories}
                category={category}
                onCategoryChange={onCategoryChange}
                iconOnly
                t={t}
              />
            </div>
            {renderBody()}
          </Stack>
        ) : (
          <Stack gap={8}>
            <CategoryControl
              available={availableCategories}
              category={category}
              onCategoryChange={onCategoryChange}
              iconOnly={false}
              t={t}
            />
            {renderBody()}
          </Stack>
        )}
      </Paper>
    </div>
  );

  function renderBody() {
    if (loading) {
      return (
        <Group justify="center" p="md" data-testid="discover-dock-loading">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            {t('searching')}
          </Text>
        </Group>
      );
    }
    if (error) {
      return (
        <Alert color="red" icon={<IconAlertCircle size={16} />} data-testid="discover-dock-error">
          {error}
        </Alert>
      );
    }
    if (trips.length === 0) {
      return (
        <Stack gap="xs" align="center" p="sm" data-testid="discover-dock-empty">
          <Text fw={600}>{t('emptyTitle')}</Text>
          <Text size="sm" c="dimmed">
            {t('emptyHint1')}
          </Text>
          <Text size="sm" c="dimmed">
            {t('emptyHint2')}
          </Text>
          <Text size="sm" c="dimmed">
            {t('emptyHint3')}
          </Text>
          <Text size="sm" c="dimmed">
            {t('emptyHint4')}
          </Text>
          <Button
            variant="light"
            size="xs"
            onClick={onEditSearch}
            data-testid="discover-dock-edit-search"
          >
            {t('editSearch')}
          </Button>
        </Stack>
      );
    }
    return (
      <Rail
        trips={trips}
        variant={compact ? 'compact' : 'regular'}
        selectedTripId={selectedTripId}
        onSelectTrip={onSelectTrip}
        onViewTrip={onViewTrip}
        topPickId={topPickId}
        label={t('catTop')}
      />
    );
  }
}
