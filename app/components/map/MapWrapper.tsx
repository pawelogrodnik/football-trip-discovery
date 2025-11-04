'use client';

import dynamic from 'next/dynamic';

const LeafletMap = dynamic(() => import('./Map'), { ssr: false });

export default function MapClient(props: React.ComponentProps<typeof LeafletMap> & any) {
  return <LeafletMap {...props} />;
}
