'use client';

import { useEffect, useState } from 'react';

/** Mobile breakpoint shared by Find/Trip/Discover compositions. */
export const MOBILE_BREAKPOINT_PX = 768;

/**
 * SSR-safe viewport-mode flag. Initial `false` (desktop composition) to
 * avoid hydration mismatch; CSS handles first paint, JS enhances after
 * mount. Never use `window.innerWidth` checks scattered in components.
 */
export function useIsMobile(breakpointPx: number = MOBILE_BREAKPOINT_PX): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
      return;
    }
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpointPx]);

  return isMobile;
}
