import { Suspense } from 'react';
import type { Metadata } from 'next';
import MatchesByIdsPage from '../components/matchesByIdsPage';

export const metadata: Metadata = {
  title: 'Football trip | Football Trip Discovery',
  description:
    'View your football trip: selected matches on an interactive map. Copy the link to share it.',
};

export default function MatchesPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading trip...</div>}>
      <MatchesByIdsPage />
    </Suspense>
  );
}
