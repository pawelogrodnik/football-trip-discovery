import { formatKickoff, formatTripDayLabel } from '../format';

describe('Discover itinerary date formatting', () => {
  it('keeps the day label and kickoff time separate', () => {
    const dateTime = '2026-09-09T16:30:00.000Z';
    const day = formatTripDayLabel(dateTime, 'en-GB');
    const kickoff = formatKickoff(dateTime, 'en-GB');

    expect(day).toMatch(/9/);
    expect(kickoff).toMatch(/^\d{2}:\d{2}$/);
    expect(kickoff).not.toMatch(/Sep|2026|9/);
  });
});
