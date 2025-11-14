/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
'use client';

import { useEffect, useRef, useState } from 'react';
import { geocode } from 'lib/geocode';
import { Autocomplete, Loader } from '@mantine/core';

const mapSuggestionLabels = (suggestions: any[]) =>
  suggestions.map(({ label }: { label: string }) => label);

export function AutocompleteLoading({
  onLocationSelect,
}: {
  onLocationSelect: (val: { label: string; lat: number; lon: number }) => void;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<[]>([]);
  const [isLoading, setLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const handleChoose = (s: any) => {
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
        setSuggestions(data);
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
        filter={({ options }) => options}
        label="Where are you going?"
        placeholder="Milan / Barcelona / Paris ..."
        rightSection={isLoading ? <Loader size="xs" /> : null}
        comboboxProps={{
          withinPortal: true,
          zIndex: 5000,
          position: 'bottom-start',
        }}
        renderOption={(props) => {
          return (
            <div className="custom-option" onClick={() => handleChoose(props.option)}>
              {props.option.value}
            </div>
          );
        }}
      />
    </div>
  );
}
