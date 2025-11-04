'use client';

import { useState } from 'react';
import { DatePickerInput } from '@mantine/dates';

export function DateRange({
  onDatesChange,
}: {
  onDatesChange: (dates: [string | null, string | null]) => void;
}) {
  const [value, setValue] = useState<[string | null, string | null]>([null, null]);
  const handleChange = (dates: [string | null, string | null]) => {
    setValue(dates);
    if (typeof dates[0] === 'string' && typeof dates[1] === 'string') {
      onDatesChange(dates);
    }
  };
  return (
    <div className="form-element">
      <DatePickerInput
        type="range"
        label="How long are you gonna stay?"
        placeholder="Pick dates"
        value={value}
        onChange={handleChange}
        popoverProps={{
          withinPortal: true,
          zIndex: 10000,
          position: 'bottom-start',
        }}
      />
    </div>
  );
}
