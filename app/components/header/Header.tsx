'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Group, Select } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'components/providers/LocaleProvider';
import { SUPPORTED_LOCALES, AppLocale } from 'lib/i18n/locales';

import './header.css';

const Header = () => {
  const t = useTranslations('Header');
  const router = useRouter();
  const locale = useLocale();
  const [selectedLocale, setSelectedLocale] = useState<AppLocale>(locale);

  useEffect(() => setSelectedLocale(locale), [locale]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const cookieExists = document.cookie.includes('NEXT_LOCALE=');
    if (cookieExists) {
      return;
    }
    const browserLocales = [
      ...(navigator.languages ?? []),
      navigator.language,
      navigator?.language?.slice(0, 2),
    ]
      .filter(Boolean)
      .map((code) => code!.slice(0, 2).toLowerCase());

    const matched = browserLocales.find((code) =>
      SUPPORTED_LOCALES.includes(code as AppLocale)
    ) as AppLocale | undefined;

    if (matched && matched !== locale) {
      document.cookie = `NEXT_LOCALE=${matched}; path=/; max-age=31536000`;
      router.refresh();
    }
  }, [locale, router]);

  const flagForLocale = (localeCode: AppLocale) => {
    switch (localeCode) {
      case 'pl':
        return '🇵🇱';
      case 'de':
        return '🇩🇪';
      case 'es':
        return '🇪🇸';
      case 'fr':
        return '🇫🇷';
      case 'it':
        return '🇮🇹';
      case 'en':
      default:
        return '🇬🇧';
    }
  };

  const languageOptions = useMemo(
    () =>
      SUPPORTED_LOCALES.map((value) => ({
        value,
        label: flagForLocale(value),
      })),
    []
  );

  const handleLanguageChange = (nextLocale: string | null) => {
    if (
      !nextLocale ||
      nextLocale === locale ||
      !SUPPORTED_LOCALES.includes(nextLocale as AppLocale)
    ) {
      return;
    }
    const normalized = nextLocale as AppLocale;
    document.cookie = `NEXT_LOCALE=${normalized}; path=/; max-age=31536000`;
    setSelectedLocale(normalized);
    router.refresh();
  };

  return (
    <div className="header-wrapper">
      <div className="header-inner">
        <div className="header__logo">
          <Link href="/">
            <div className="logo-wrapper">
              <img src="/logo.png" alt="" width={150} />
            </div>
          </Link>
        </div>
        <div className="header__navigation">
          <Group h="100%" gap={0}>
            <Link href="/contact" className="link">
              {t('nav.contact')}
            </Link>
            <Link href="/report-bug" className="link">
              {t('nav.reportBug')}
            </Link>
          </Group>
        </div>
        <div className="header__language">
          <Select
            aria-label={t('language')}
            data={languageOptions}
            value={selectedLocale}
            onChange={handleLanguageChange}
            styles={{ input: { width: 80, textAlign: 'center', fontSize: '1.2rem' } }}
            comboboxProps={{
              withinPortal: true,
              zIndex: 5000,
              position: 'bottom-start',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(Header);
