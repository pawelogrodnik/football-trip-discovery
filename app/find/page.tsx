import { Suspense } from 'react';
import type { Metadata } from 'next';
import FindMatchesClient from './components/FindMatchesClient';

export const metadata: Metadata = {
  title: 'Find Football Matches Near Your Destination | Football Trip Discovery',
  description:
    'Find football matches around your destination, choose the games you want to see and build your own trip.',
};

export default function FindPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading search...</div>}>
      <FindMatchesClient />
    </Suspense>
  );
}
