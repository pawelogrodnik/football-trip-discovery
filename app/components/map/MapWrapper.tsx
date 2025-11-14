'use client';

import { memo } from 'react';
import dynamic from 'next/dynamic';

const LeafletMap = dynamic(() => import('./Map'), { ssr: false });

function MapClient(props: React.ComponentProps<typeof LeafletMap> & any) {
  return <LeafletMap {...props} />;
}

export default memo(MapClient);
