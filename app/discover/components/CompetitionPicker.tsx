'use client';

import { useTranslations } from 'components/providers/LocaleProvider';
import {
  Accordion,
  Button,
  Checkbox,
  Chip,
  Drawer,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

export type LeagueGroup = { country: string; leagues: { name: string; country: string }[] };

type Props = {
  opened: boolean;
  onClose: () => void;
  groups: LeagueGroup[];
  selectedLeagues: string[];
  onToggleLeague: (name: string, checked: boolean) => void;
  onToggleCountry: (country: string, checked: boolean) => void;
  onClear: () => void;
};

export default function CompetitionPicker({
  opened,
  onClose,
  groups,
  selectedLeagues,
  onToggleLeague,
  onToggleCountry,
  onClear,
}: Props) {
  const t = useTranslations('Discover');
  const isMobile = useMediaQuery('(max-width: 768px)');

  const body = (
    <Stack gap="sm" data-testid="discover-competition-picker-body">
      {selectedLeagues.length > 0 && (
        <div data-testid="discover-picker-selected">
          <Group justify="space-between" mb={4}>
            <Text size="sm" fw={500}>
              {t('pickerSelected', { count: selectedLeagues.length })}
            </Text>
            <Button
              size="xs"
              variant="subtle"
              onClick={onClear}
              data-testid="discover-picker-clear-all"
            >
              {t('clearAll')}
            </Button>
          </Group>
          <Group gap={6}>
            {selectedLeagues.slice(0, 12).map((n) => (
              <Chip
                key={n}
                checked
                size="xs"
                variant="filled"
                onChange={() => onToggleLeague(n, false)}
              >
                {n}
              </Chip>
            ))}
            {selectedLeagues.length > 12 && (
              <Text size="xs" c="dimmed">
                +{selectedLeagues.length - 12}
              </Text>
            )}
          </Group>
        </div>
      )}
      <ScrollArea.Autosize mah={isMobile ? '60vh' : 420}>
        <Accordion variant="separated" data-testid="discover-picker-groups">
          {groups.map((g) => {
            const total = g.leagues.length;
            const selected = g.leagues.filter((l) => selectedLeagues.includes(l.name)).length;
            return (
              <Accordion.Item
                key={g.country}
                value={g.country}
                data-testid={`discover-picker-country-${g.country}`}
              >
                <Accordion.Control>
                  <Checkbox
                    label={`${g.country} (${total})`}
                    checked={selected === total && total > 0}
                    indeterminate={selected > 0 && selected < total}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleCountry(g.country, e.currentTarget.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={g.country}
                  />
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap={4}>
                    {g.leagues.map((l) => (
                      <Checkbox
                        key={l.name}
                        label={l.name}
                        checked={selectedLeagues.includes(l.name)}
                        onChange={(e) => onToggleLeague(l.name, e.currentTarget.checked)}
                      />
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      </ScrollArea.Autosize>
      <Button onClick={onClose} data-testid="discover-picker-close">
        {t('close')}
      </Button>
    </Stack>
  );

  if (isMobile) {
    return (
      <Drawer
        opened={opened}
        onClose={onClose}
        position="bottom"
        size="85vh"
        title={t('pickerTitle')}
        zIndex={1300}
        data-testid="discover-competition-picker"
      >
        {body}
      </Drawer>
    );
  }
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('pickerTitle')}
      size="lg"
      centered
      zIndex={1300}
      data-testid="discover-competition-picker"
    >
      {body}
    </Modal>
  );
}
