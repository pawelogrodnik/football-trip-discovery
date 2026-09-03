import { render, screen, waitFor } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { MantineProvider } from '@mantine/core';
import DiscoverClient from '../DiscoverClient';

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const messages = {
  Discover: {
    title: 'Discover your next football trip',
    subtitle: 'Pick when you are free.',
    availability: 'When can you travel?',
    availabilityPlaceholder: 'Pick dates',
    tripLength: 'Trip length',
    daysOption: '{{count}} days',
    daysShort: 'days',
    competitions: 'What do you want to watch?',
    uefaPreset: 'UEFA competitions',
    italyPreset: 'Italy',
    englandPreset: 'England',
    spainPreset: 'Spain',
    polandPreset: 'Poland',
    chooseCompetitions: 'Choose competitions',
    distance: 'Maximum distance between venues',
    destination: 'Destination',
    anywhere: 'Anywhere',
    aroundCity: 'Around a city',
    radius: 'Radius',
    advanced: 'Advanced options',
    useMyLocation: 'Use my location',
    clear: 'Clear',
    geoError: 'Geolocation failed',
    pickTripLength: 'Select at least one trip length.',
    selectLeague: 'Select at least one league',
    selectDates: 'Select date range',
    dateRangeError: 'Date range must be 0-30 days',
    errorFallback: 'Something went wrong. Try again.',
    discover: 'Discover trips',
    searching: 'Discovering trips…',
    editSearch: 'Edit search',
    cancel: 'Cancel',
    editingNotice: 'Editing your search.',
    alreadyKnowDestination: 'Already know where you are going?',
    findMatchesLink: 'Find matches near your destination',
    customizeTrip: 'Customize trip',
  },
};

describe('DiscoverClient initial render', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ leagues: [] }),
    }) as unknown as typeof fetch;
  });

  it('shows the search form over the map on first load', async () => {
    render(
      <MantineProvider>
        <LocaleProvider locale="en" messages={messages}>
          <DiscoverClient />
        </LocaleProvider>
      </MantineProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('discover-search')).toBeInTheDocument();
    });
    expect(screen.getByTestId('discover-search-paper')).toBeInTheDocument();
    expect(screen.getByTestId('discover-submit')).toBeInTheDocument();
    expect(screen.getByTestId('discover-find-link')).toBeInTheDocument();
  });
});
