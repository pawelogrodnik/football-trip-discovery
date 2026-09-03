'use client';

export function formatShortRange(
  startISO: string | null,
  endISO: string | null,
  locale: string,
  withYear = false
): string {
  if (!startISO || !endISO) {
    return '';
  }
  const fmt = (iso: string, year: boolean) =>
    new Date(iso.length === 10 ? `${iso}T12:00:00.000Z` : iso).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      ...(year ? { year: 'numeric' as const } : {}),
    });
  const s = new Date(startISO.length === 10 ? `${startISO}T12:00:00.000Z` : startISO);
  const e = new Date(endISO.length === 10 ? `${endISO}T12:00:00.000Z` : endISO);
  const year = withYear || s.getUTCFullYear() !== e.getUTCFullYear();
  return `${fmt(startISO, false)}–${fmt(endISO, year)}`;
}

export function formatTripDayLabel(dateTime: string | undefined, locale: string): string {
  if (!dateTime) {
    return '';
  }
  return new Date(dateTime).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatKickoff(dateTime: string | undefined, locale: string): string {
  if (!dateTime) {
    return '';
  }
  return new Date(dateTime).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function matchIdOf(m: { _id?: unknown; id?: unknown }): string {
  return String((m as { _id?: unknown })._id ?? (m as { id?: unknown }).id ?? '');
}

/**
 * Mantine DatePickerInput may hand back native Dates, ISO strings or
 * dayjs-like objects (no DatesProvider configured). Normalize to Date.
 */
export function coerceToDate(v: unknown): Date | null {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v;
  }
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (v !== null && typeof v === 'object') {
    const o = v as { toDate?: unknown; valueOf?: unknown };
    if (typeof o.toDate === 'function') {
      try {
        const d = (o.toDate as () => unknown)();
        if (d instanceof Date && !Number.isNaN(d.getTime())) {
          return d;
        }
      } catch {
        return null;
      }
    }
    if (typeof o.valueOf === 'function') {
      try {
        const ms = (o.valueOf as () => unknown)();
        if (typeof ms === 'number' && Number.isFinite(ms)) {
          const d = new Date(ms);
          if (!Number.isNaN(d.getTime())) {
            return d;
          }
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}
