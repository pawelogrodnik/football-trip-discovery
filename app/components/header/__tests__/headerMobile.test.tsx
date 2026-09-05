import { render, screen } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { MantineProvider } from '@mantine/core';
import Header from '../Header';

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
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

describe('Header mobile navigation', () => {
  it('burger exposes an accessible name', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
  });

  it('mobile menu contains canonical links (Discover / Find / About / Contact)', () => {
    renderHeader();
    expect(screen.getAllByRole('link', { name: 'Discover' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Find matches' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'About' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Contact' }).length).toBeGreaterThan(0);
  });

  it('logo links home and language selector stays labelled', () => {
    const { container } = renderHeader();
    expect(screen.getByRole('link', { name: 'Football Trip Discovery' })).toHaveAttribute(
      'href',
      '/'
    );
    expect(container.querySelector('input[aria-label="Language"]')).not.toBeNull();
  });
});
