export type NavRoute = {
  href: string;
  labelKey: string;
  match: (pathname: string) => boolean;
};

/**
 * Single source of truth for header navigation.
 * Order: Discover, Find matches, About, Contact.
 */
export const NAV_ROUTES: NavRoute[] = [
  { href: '/', labelKey: 'nav.discover', match: (p) => p === '/' || p === '/discover' },
  { href: '/find', labelKey: 'nav.findMatches', match: (p) => p === '/find' },
  { href: '/about', labelKey: 'nav.about', match: (p) => p === '/about' },
  { href: '/contact', labelKey: 'nav.contact', match: (p) => p === '/contact' },
];
