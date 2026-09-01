"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createTranslator, type Dictionary, type Translator } from "./dictionary";
import { LOCALE_COOKIE, type Locale } from "./locale";
import vi from "./dictionaries/vi";
import en from "./dictionaries/en";

const DICTIONARIES: Record<Locale, Dictionary> = { vi, en };

interface I18nContextValue {
  locale: Locale;
  t: Translator;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}

/**
 * Receives the locale + already-resolved dictionary computed server-side
 * (in the root layout, from the `locale` cookie) and makes them available to
 * client components via useI18n(). Server Components don't need this at all
 * — they call getLocale()/createTranslator(getDictionary(locale)) directly.
 */
export function I18nProvider({ locale: initialLocale, dict: initialDict, children }: I18nProviderProps) {
  const router = useRouter();
  const [locale, setLocaleState] = useState(initialLocale);

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      setLocaleState(next);
      router.refresh();
    },
    [router],
  );

  // Both locale dictionaries are tiny (a few hundred short strings) and
  // bundled statically — simpler and more reliable than a runtime dynamic
  // import keyed by a template-literal path, and the size cost is trivial.
  const dict = locale === initialLocale ? initialDict : DICTIONARIES[locale];
  const t = useMemo(() => createTranslator(dict), [dict]);

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n() must be used within an I18nProvider");
  return ctx;
}
