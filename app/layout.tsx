import '@mantine/core/styles.css';
import 'leaflet/dist/leaflet.css';
import '@mantine/dates/styles.css';
import 'react-leaflet-markercluster/styles';
import './global.css';

import Header from 'components/header/Header';
import { ColorSchemeScript, mantineHtmlProps, MantineProvider } from '@mantine/core';
import { LocaleProvider } from 'components/providers/LocaleProvider';
import { detectLocale, loadMessages } from 'lib/i18n/server';
import { theme } from '../theme';

export const metadata = {
  title: 'Football trip discovery',
  description: 'Find your perfect match',
};

export default async function RootLayout({ children }: { children: any }) {
  const locale = await detectLocale();
  const messages = await loadMessages(locale);

  return (
    <html lang={locale} {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <link rel="shortcut icon" href="/favicon-32x32.png" />
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
      </head>
      <body>
        <MantineProvider theme={theme}>
          <LocaleProvider locale={locale} messages={messages}>
            <Header />
            <div className="app-body-wrapper">{children}</div>
          </LocaleProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
