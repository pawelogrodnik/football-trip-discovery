import { formatShortRange } from '../format';

describe('Discover localized dates', () => {
  it('formats range in the active locale (Polish, not English)', () => {
    const pl = formatShortRange('2026-09-05', '2026-09-18', 'pl', true);
    // Polish short month for September, never the English form
    expect(pl).toMatch(/wrz/i);
    expect(pl).not.toContain('Sep');
  });

  it('keeps English formatting for English locale', () => {
    const en = formatShortRange('2026-09-05', '2026-09-18', 'en', true);
    expect(en).toContain('Sep');
  });

  it('handles cross-year ranges with year disambiguation', () => {
    const pl = formatShortRange('2026-12-28', '2027-01-05', 'pl', true);
    expect(pl).toContain('2027');
  });
});
