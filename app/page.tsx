import type { Metadata } from 'next';
import DiscoverClient from './discover/components/DiscoverClient';

export const metadata: Metadata = {
  title: 'Football Trip Discovery',
  description:
    'Discover the best football trips based on when you can travel and the football you want to see.',
  keywords: ['football', 'journey', 'matches', 'trips', 'discover'],
  openGraph: {
    title: 'Football Trip Discovery',
    description:
      'Discover the best football trips based on when you can travel and the football you want to see.',
    url: 'https://football-trip-discovery.vercel.app/',
    siteName: 'Football Trip Discovery',
    images: [
      {
        url: 'https://football-trip-discovery.vercel.app/meta_img.png',
        width: 1200,
        height: 630,
        alt: 'Football trip discovery preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Football Trip Discovery',
    description:
      'Discover the best football trips based on when you can travel and the football you want to see.',
    images: ['https://football-trip-discovery.vercel.app/meta_img.png'],
  },
};

export default function Home() {
  return <DiscoverClient />;
}
