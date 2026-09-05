'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'components/providers/LocaleProvider';
import { geocode } from 'lib/geocode';
import { Autocomplete, Loader } from '@mantine/core';

type Suggestion = {
  label: string;
  value: string;
  lat: number;
  lon: number;
};

const mapSuggestionLabels = (suggestions: Suggestion[]) => suggestions.map(({ label }) => label);

export function AutocompleteLoading({
  onLocationSelect,
  initialValue,
  label,
  placeholder,
}: {
  onLocationSelect: (val: { label: string; lat: number; lon: number }) => void;
  initialValue?: string;
  label?: string;
  placeholder?: string;
}) {
  const t = useTranslations('Form');
  const [query, setQuery] = useState(initialValue ?? '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setQuery(initialValue ?? '');
  }, [initialValue]);

  const handleChoose = (s: Suggestion) => {
    const loc = { label: s.label, lat: s.lat, lon: s.lon };
    setQuery(s.label);
    onLocationSelect(loc);
  };

  useEffect(() => {
    if (mapSuggestionLabels(suggestions).includes(query)) {
      return;
    }
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        setLoading(true);
        const data = await geocode(query);
        setLoading(false);
        setSuggestions(data as Suggestion[]);
      } catch {
        setLoading(false);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="form-element">
      <Autocomplete
        value={query}
        data={suggestions}
        onChange={setQuery}
        onOptionSubmit={(value) => {
          const suggestion = suggestions.find((item) => item.value === value);
          if (suggestion) {
            handleChoose(suggestion);
          }
        }}
        filter={({ options }) => options}
        label={label ?? t('locationLabel')}
        placeholder={placeholder ?? t('locationPlaceholder')}
        rightSection={isLoading ? <Loader size="xs" /> : null}
        comboboxProps={{
          withinPortal: true,
          zIndex: 5000,
          position: 'bottom-start',
        }}
        renderOption={({ option }) => (
          <div className="custom-option">
            {suggestions.find((item) => item.value === option.value)?.label ?? option.value}
          </div>
        )}
      />
    </div>
  );
}
