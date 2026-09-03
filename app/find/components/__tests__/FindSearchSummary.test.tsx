import { render, screen } from '@testing-library/react';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { MantineProvider } from '@mantine/core';
import FindSearchSummary from '../FindSearchSummary';

const messages = {
  FindMatches: {
    editSearch: 'Edit search',
    customizingBadge: 'Customizing suggested trip',
  },
};

function renderSummary(props?: Record<string, unknown>) {
  return render(
    <MantineProvider>
      <LocaleProvider locale="en" messages={messages}>
        <FindSearchSummary
          criteria={
            (props?.criteria as never) ?? {
              location: {
                label: 'Kraków, województwo małopolskie, Polska',
                lat: 50.06,
                lon: 19.94,
              },
              startDate: new Date('2026-09-07T12:00:00.000Z'),
              endDate: new Date('2026-09-20T12:00:00.000Z'),
              radiusKm: 50,
            }
          }
          customizeMode={(props?.customizeMode as boolean) ?? false}
          onEdit={jest.fn()}
          centerShiftPx={(props?.centerShiftPx as number) ?? 0}
          maxWidth={props?.maxWidth as string | undefined}
        />
      </LocaleProvider>
    </MantineProvider>
  );
}

describe('FindSearchSummary', () => {
  test('location, dates, radius and Edit share one nowrap row', () => {
    const { container } = renderSummary();
    const bar = screen.getByTestId('find-search-summary');
    expect(bar).toBeInTheDocument();
    // the layout row never wraps on desktop (Mantine Group --group-wrap var)
    const row = bar.querySelector('.mantine-Group-root') as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(row?.style.getPropertyValue('--group-wrap')).toBe('nowrap');
    expect(screen.getByTestId('find-summary-location')).toBeInTheDocument();
    expect(screen.getByTestId('find-summary-dates')).toBeInTheDocument();
    expect(screen.getByTestId('find-summary-radius')).toBeInTheDocument();
    expect(screen.getByTestId('find-summary-edit')).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  test('long location truncates with full label as tooltip; CTA stays visible', () => {
    renderSummary();
    const location = screen.getByTestId('find-summary-location');
    expect(location).toHaveAttribute('title', 'Kraków, województwo małopolskie, Polska');
    expect(location.textContent).toContain('Kraków');
    expect(screen.getByTestId('find-summary-edit')).toBeVisible();
  });

  test('dates use compact localized range, radius in km', () => {
    renderSummary();
    expect(screen.getByTestId('find-summary-radius').textContent).toBe('50 km');
    // compact "Sep 7–Sep 20" style range, never raw ISO datetimes
    expect(screen.getByTestId('find-summary-dates').textContent).not.toContain('2026-');
  });

  test('panel-aware maxWidth + centering shift are applied', () => {
    renderSummary({ centerShiftPx: 200, maxWidth: 'min(800px, calc(100vw - 500px))' });
    const bar = screen.getByTestId('find-search-summary');
    expect(bar).toHaveStyle({ marginLeft: '-200px' });
    expect(bar.style.maxWidth).toContain('800px');
  });
});
