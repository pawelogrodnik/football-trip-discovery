import '@mantine/core/styles.css';
import 'leaflet/dist/leaflet.css';
import '@mantine/dates/styles.css';
import 'react-leaflet-markercluster/styles';
import './global.css';

import { ColorSchemeScript, mantineHtmlProps, MantineProvider } from '@mantine/core';
import { theme } from '../theme';

export const metadata = {
  title: 'Football trip discovery',
  description: 'Find your perfect match',
};

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <link rel="shortcut icon" href="/favicon-32x32.png" />
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
      </head>
      <body>
        <MantineProvider theme={theme}>{children}</MantineProvider>
      </body>
    </html>
  );
}
