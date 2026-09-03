import { NAV_ROUTES } from 'lib/navigation';

describe('header navigation source of truth', () => {
  it('orders Discover, Find matches, About, Contact', () => {
    expect(NAV_ROUTES.map((r) => r.href)).toEqual(['/', '/find', '/about', '/contact']);
    expect(NAV_ROUTES.map((r) => r.labelKey)).toEqual([
      'nav.discover',
      'nav.findMatches',
      'nav.about',
      'nav.contact',
    ]);
  });

  it('contains no Home, Suggested Trips or Report a bug entries', () => {
    const keys = NAV_ROUTES.map((r) => r.labelKey).join(' ');
    const hrefs = NAV_ROUTES.map((r) => r.href).join(' ');
    expect(keys).not.toMatch(/home/i);
    expect(keys).not.toMatch(/suggested/i);
    expect(hrefs).not.toMatch(/report/);
    expect(hrefs).not.toMatch(/bug/);
  });

  it('marks Discover active for / and /discover, Find active for /find', () => {
    const discover = NAV_ROUTES[0];
    const find = NAV_ROUTES[1];
    expect(discover.match('/')).toBe(true);
    expect(discover.match('/discover')).toBe(true);
    expect(discover.match('/find')).toBe(false);
    expect(find.match('/find')).toBe(true);
    expect(find.match('/')).toBe(false);
  });
});
