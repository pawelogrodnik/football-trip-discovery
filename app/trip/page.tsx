import { Suspense } from 'react';
import type { Metadata } from 'next';
import TripClient from './components/TripClient';

export const metadata: Metadata = {
  title: 'Football trip | Football Trip Discovery',
  description: 'View and share your selected football matches on an interactive trip map.',
};

export default function TripPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading trip...</div>}>
      <TripClient />
    </Suspense>
  );
}
