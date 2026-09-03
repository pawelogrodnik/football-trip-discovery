'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TRIP_PATH } from '../lib/tripUrls';

/**
 * Legacy trip route. All query parameters (ids, lat, lon, label, radius,
 * startDate, endDate) are preserved — the canonical trip now lives at /trip.
 * A server-level redirect in next.config.mjs handles this without JS;
 * this client replace is the fallback.
 */
function LegacyMatchesRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `${TRIP_PATH}?${qs}` : TRIP_PATH);
  }, [router, searchParams]);
  return <div className="p-6">Loading trip...</div>;
}

export default function MatchesPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading trip...</div>}>
      <LegacyMatchesRedirect />
    </Suspense>
  );
}
