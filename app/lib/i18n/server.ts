import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, AppLocale, Messages } from './locales';

export async function loadMessages(locale: AppLocale): Promise<Messages> {
  switch (locale) {
    case 'es':
      return (await import('../../../messages/es.json')).default;
    case 'fr':
      return (await import('../../../messages/fr.json')).default;
    case 'it':
      return (await import('../../../messages/it.json')).default;
    case 'pl':
      return (await import('../../../messages/pl.json')).default;
    case 'de':
      return (await import('../../../messages/de.json')).default;
    case 'en':
    default:
      return (await import('../../../messages/en.json')).default;
  }
}

export async function detectLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as AppLocale)) {
    return cookieLocale as AppLocale;
  }

  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language');
  if (acceptLanguage) {
    for (const part of acceptLanguage.split(',')) {
      const code = part.trim().slice(0, 2).toLowerCase();
      if (SUPPORTED_LOCALES.includes(code as AppLocale)) {
        return code as AppLocale;
      }
    }
  }

  return DEFAULT_LOCALE;
}
