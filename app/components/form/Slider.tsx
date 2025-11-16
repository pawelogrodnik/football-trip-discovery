'use client';

import { useState } from 'react';
import { Slider, Text } from '@mantine/core';
import { useTranslations } from 'components/providers/LocaleProvider';
import { DEFAULT_RADIUS, RADIUS_MULTIPLIER } from '../consts';

export function SliderInput({ onRadiusChange }: { onRadiusChange: (radius: number) => void }) {
  const t = useTranslations('Form');
  const [value, setValue] = useState(DEFAULT_RADIUS);
  const onChangeEnd = (val: number) => {
    setValue(val);
    onRadiusChange(val * RADIUS_MULTIPLIER);
  };
  const formatDistance = (distanceKm: number) => t('distanceWithUnit', { value: distanceKm });
  return (
    <div className="slider-wrapper form-element">
      <Text size="sm" mt="xl" fw={500} style={{ margin: 0 }}>
        {t('radiusLabel')}
      </Text>
      <Slider
        value={value}
        onChangeEnd={onChangeEnd}
        onChange={setValue}
        label={(label) => formatDistance(label * RADIUS_MULTIPLIER)}
        marks={[
          { value: 0, label: formatDistance(0) },
          { value: 50, label: formatDistance(RADIUS_MULTIPLIER * 50) },
          { value: 100, label: formatDistance(RADIUS_MULTIPLIER * 100) },
        ]}
      />
    </div>
  );
}
