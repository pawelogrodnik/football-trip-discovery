import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { geocode } from 'lib/geocode';
import { MantineProvider } from '@mantine/core';
import { AutocompleteLoading } from '../AutoComplete';

jest.mock('lib/geocode', () => ({ geocode: jest.fn() }));

const mockedGeocode = geocode as jest.MockedFunction<typeof geocode>;

describe('AutocompleteLoading', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedGeocode.mockResolvedValue([
      {
        id: '1',
        label: 'Milan, Lombardy, Italy',
        value: 'Milan, Lombardy, Italy - 1',
        lat: 45.46,
        lon: 9.19,
        city: 'Milan',
        country: 'Italy',
      },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('selects a suggestion through Mantine pointer interaction', async () => {
    const onLocationSelect = jest.fn();
    render(
      <MantineProvider>
        <LocaleProvider locale="en" messages={{ Form: {} }}>
          <AutocompleteLoading label="Destination" onLocationSelect={onLocationSelect} />
        </LocaleProvider>
      </MantineProvider>
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Milan' } });
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    await waitFor(() => expect(screen.getByRole('option', { hidden: true })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('option', { hidden: true }));

    expect(onLocationSelect).toHaveBeenCalledWith({
      label: 'Milan, Lombardy, Italy',
      lat: 45.46,
      lon: 9.19,
    });
  });
});
