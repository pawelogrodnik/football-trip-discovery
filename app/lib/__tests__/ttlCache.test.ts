import { TtlCache } from 'lib/ttlCache';

describe('TtlCache', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns cached value within TTL', async () => {
    const cache = new TtlCache<string, number>(1_000);
    let calls = 0;
    const loader = jest.fn(() => ++calls);

    const first = await cache.get('key', loader);
    const second = await cache.get('key', loader);

    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('refreshes value after TTL expires', async () => {
    const cache = new TtlCache<string, number>(1_000);
    let calls = 0;

    const loader = jest.fn(() => ++calls);

    await cache.get('key', loader);
    jest.advanceTimersByTime(1_001);
    const refreshed = await cache.get('key', loader);

    expect(refreshed).toBe(2);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
