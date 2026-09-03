import { render, screen, waitFor } from '@testing-library/react';
import MatchesPage from '../page';

const replace = jest.fn();
const query =
  'ids=abc,def&lat=50.06&lon=19.94&label=Kraków&radius=50&startDate=2026-09-07&endDate=2026-09-20';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(query),
}));

describe('legacy /matches route', () => {
  test('redirects to /trip preserving every query parameter', async () => {
    render(<MatchesPage />);
    expect(screen.getByText(/Loading trip/i)).toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    const target = replace.mock.calls[0][0] as string;
    expect(target.startsWith('/trip?')).toBe(true);
    const q = new URLSearchParams(target.split('?')[1]);
    expect(q.get('ids')).toBe('abc,def');
    expect(q.get('lat')).toBe('50.06');
    expect(q.get('lon')).toBe('19.94');
    expect(q.get('label')).toBe('Kraków');
    expect(q.get('radius')).toBe('50');
    expect(q.get('startDate')).toBe('2026-09-07');
    expect(q.get('endDate')).toBe('2026-09-20');
  });
});
