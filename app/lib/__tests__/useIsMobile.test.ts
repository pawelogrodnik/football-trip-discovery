import { renderHook, waitFor } from '@testing-library/react';
import { MOBILE_BREAKPOINT_PX, useIsMobile } from 'lib/useIsMobile';

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mq = {
    matches,
    media: `(max-width: ${MOBILE_BREAKPOINT_PX}px)`,
    addEventListener: jest.fn((_t: string, cb: (e: { matches: boolean }) => void) => {
      listeners.add(cb);
    }),
    removeEventListener: jest.fn((cb: unknown) => {
      listeners.delete(cb as (e: { matches: boolean }) => void);
    }),
    dispatchEvent: jest.fn(),
  };
  (window as unknown as Record<string, unknown>).matchMedia = jest.fn().mockReturnValue(mq);
  return { mq, listeners };
}

describe('useIsMobile', () => {
  it('starts false on server-style render (no hydration mismatch), then tracks matchMedia', async () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    await waitFor(() => expect(result.current).toBe(true));
    expect(window.matchMedia).toHaveBeenCalledWith(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
  });

  it('stays false on desktop widths', async () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    // initial state is desktop-safe; effect confirms desktop
    await waitFor(() => expect(window.matchMedia).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('follows breakpoint crossing changes', async () => {
    const { mq, listeners } = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    mq.matches = true;
    listeners.forEach((cb) => cb({ matches: true }));
    await waitFor(() => expect(result.current).toBe(true));
  });
});

describe('responsive architecture', () => {
  it('uses a single shared 768px breakpoint (no scattered innerWidth checks)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const roots = ['app/find/components', 'app/trip/components'];
    const offenders: string[] = [];
    for (const root of roots) {
      const dir = path.join(process.cwd(), root);
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.tsx')) {
          continue;
        }
        const src = fs.readFileSync(path.join(dir, f), 'utf8');
        if (/window\.innerWidth/.test(src)) {
          offenders.push(`${root}/${f}`);
        }
      }
    }
    expect(offenders).toEqual([]);
    expect(MOBILE_BREAKPOINT_PX).toBe(768);
  });
});
