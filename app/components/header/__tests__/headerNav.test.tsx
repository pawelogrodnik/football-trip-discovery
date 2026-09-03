import { render, screen } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { MantineProvider } from '@mantine/core';
import Header from '../Header';

const mockPathname = jest.fn(() => '/');

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ refresh: jest.fn() }),
}));

const messages = {
  Header: {
    nav: {
      discover: 'Discover',
      findMatches: 'Find matches',
      about: 'About',
      contact: 'Contact',
    },
    language: 'Language',
    menu: 'Menu',
  },
};

function renderHeader() {
  return render(
    <MantineProvider>
      <LocaleProvider locale="en" messages={messages}>
        <Header />
      </LocaleProvider>
    </MantineProvider>
  );
}

describe('Header navigation', () => {
  beforeEach(() => mockPathname.mockReturnValue('/'));

  it('contains Discover, Find matches, About, Contact', () => {
    renderHeader();
    // desktop + mobile drawer copies
    expect(screen.getAllByRole('link', { name: 'Discover' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Find matches' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'About' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Contact' }).length).toBeGreaterThan(0);
  });

  it('does not contain Home, Suggested Trips or Report a bug', () => {
    renderHeader();
    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Suggested Trips' })).toBeNull();
    expect(screen.queryByRole('link', { name: /bug/i })).toBeNull();
  });

  it('marks Discover active on / with aria-current', () => {
    renderHeader();
    const active = screen.getAllByRole('link', { name: 'Discover' });
    expect(active[0]).toHaveAttribute('aria-current', 'page');
    const find = screen.getAllByRole('link', { name: 'Find matches' });
    expect(find[0]).not.toHaveAttribute('aria-current');
  });

  it('marks Find matches active on /find', () => {
    mockPathname.mockReturnValue('/find');
    renderHeader();
    const find = screen.getAllByRole('link', { name: 'Find matches' });
    expect(find[0]).toHaveAttribute('aria-current', 'page');
  });
});
