'use client';

import { useState } from 'react';
import { Slider, Text } from '@mantine/core';
import { DEFAULT_RADIUS, RADIUS_MULTIPLIER } from '../consts';

export function SliderInput({ onRadiusChange }: { onRadiusChange: (radius: number) => void }) {
  const [value, setValue] = useState(DEFAULT_RADIUS);
  const onChangeEnd = (val: number) => {
    setValue(val);
    onRadiusChange(val * RADIUS_MULTIPLIER);
  };
  return (
    <div className="slider-wrapper form-element">
      <Text size="sm" mt="xl" fw={500} style={{ margin: 0 }}>
        How far are you willing to travel for a match?
      </Text>
      <Slider
        value={value}
        onChangeEnd={onChangeEnd}
        onChange={setValue}
        label={(label) => `${label * RADIUS_MULTIPLIER} km`}
        marks={[
          { value: 0, label: '0 km' },
          { value: 50, label: `${RADIUS_MULTIPLIER * 50} km` },
          { value: 100, label: `${RADIUS_MULTIPLIER * 100} km` },
        ]}
      />
    </div>
  );
}
