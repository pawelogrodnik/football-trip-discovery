import type { Metadata } from 'next';
import HomePage from './components/homepage';

export const metadata: Metadata = {
  title: 'Football Trip Discovery App',
  description: 'Discover football matches near you.',
  keywords: ['football', 'journey', 'matches'],
  openGraph: {
    title: 'Football Trip Discovery App',
    description: 'Find local matches wherever you go.',
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
    title: 'Football Trip Discovery App',
    description: 'Find local matches wherever you go.',
    images: ['https://football-trip-discovery.vercel.app/meta_img.png'],
  },
};

export default function Home() {
  return <HomePage />;
}
