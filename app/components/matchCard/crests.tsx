'use client';

import { useState } from 'react';
import { Box, Text } from '@mantine/core';
import { getCompetitionEmblem } from '../../lib/getCompetitionEmblem';
import { initials } from '../../lib/initials';

export function TeamCrest({
  name,
  crest,
  size = 28,
}: {
  name: string;
  crest?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(crest) && !failed;
  return (
    <Box
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 8,
        background: 'var(--mantine-color-gray-0)',
        border: '1px solid var(--mantine-color-gray-2)',
        overflow: 'hidden',
      }}
    >
      {showImg ? (
        <img
          src={crest as string}
          alt={`${name} crest`}
          width={size - 6}
          height={size - 6}
          loading="lazy"
          style={{ objectFit: 'contain', display: 'block' }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text size="xs" fw={700} c="blue" aria-label={`${name} crest`}>
          {initials(name)}
        </Text>
      )}
    </Box>
  );
}

export function CompetitionLogo({ name, boxSize = 26 }: { name: string; boxSize?: number }) {
  const [failed, setFailed] = useState(false);
  const logo = getCompetitionEmblem(name);
  if (!logo || failed) {
    return null;
  }
  const imgSize = boxSize - 6;
  return (
    <Box
      style={{
        width: boxSize,
        height: boxSize,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 6,
        background: 'var(--mantine-color-gray-0)',
        border: '1px solid var(--mantine-color-gray-2)',
        overflow: 'hidden',
      }}
    >
      <img
        src={logo}
        alt={`${name} logo`}
        width={imgSize}
        height={imgSize}
        loading="lazy"
        style={{ objectFit: 'contain', display: 'block' }}
        onError={() => setFailed(true)}
      />
    </Box>
  );
}
