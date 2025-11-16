export const SUPPORTED_LOCALES = ['en', 'pl', 'de'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'en';
export type Messages = Record<string, any>;
