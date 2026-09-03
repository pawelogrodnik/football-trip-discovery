import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer({
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
  async redirects() {
    return [
      {
        source: '/report-bug',
        destination: '/contact',
        permanent: true,
      },
      // Legacy trip route — canonical URL is /trip.
      // Query parameters (ids, lat, lon, label, radius, dates) are preserved.
      {
        source: '/matches',
        destination: '/trip',
        permanent: false,
      },
    ];
  },
});
