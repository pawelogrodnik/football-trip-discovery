'use client';

import { useState } from 'react';
import { DatePickerInput } from '@mantine/dates';
import { useTranslations } from 'components/providers/LocaleProvider';

export function DateRange({
  onDatesChange,
}: {
  onDatesChange: (dates: [string | null, string | null]) => void;
}) {
  const t = useTranslations('Form');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
        label={t('dateLabel')}
        placeholder={t('datePlaceholder')}
        value={value}
        onChange={handleChange}
        minDate={today}
        popoverProps={{
          withinPortal: true,
          zIndex: 10000,
          position: 'bottom-start',
        }}
      />
    </div>
  );
}
