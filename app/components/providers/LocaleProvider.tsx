'use client';

import { createContext, ReactNode, useContext, useMemo } from 'react';
import type { AppLocale, Messages } from 'lib/i18n/locales';

type LocaleContextValue = {
  locale: AppLocale;
  messages: Messages;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: AppLocale;
  messages: Messages;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function resolveMessage(messages: Messages, path: string) {
  return path.split('.').reduce<any>((acc, segment) => (acc ? acc[segment] : undefined), messages);
}

function interpolate(template: string, values?: Record<string, string | number>) {
  if (!values) {
    return template;
  }
  return Object.keys(values).reduce(
    (result, key) => result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(values[key])),
    template
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx.locale;
}

export function useTranslations(namespace?: string) {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useTranslations must be used within LocaleProvider');
  }
  return (key: string, values?: Record<string, string | number>) => {
    const path = namespace ? `${namespace}.${key}` : key;
    const message = resolveMessage(ctx.messages, path);
    if (typeof message === 'string') {
      return interpolate(message, values);
    }
    return '';
  };
}
