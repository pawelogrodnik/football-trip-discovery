import { Suspense } from 'react';
import type { Metadata } from 'next';
import MatchesByIdsPage from '../components/matchesByIdsPage';

export const metadata: Metadata = {
  title: 'Saved matches | Football Trip Discovery',
  description: 'View hand-picked matches on an interactive map.',
};

export default function MatchesPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading saved matches...</div>}>
      <MatchesByIdsPage />
    </Suspense>
  );
}
