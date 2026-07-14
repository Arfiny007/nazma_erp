"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getTranslations } from "@/lib/i18n/translations";
import {
  LOCALE_STORAGE_KEY,
  parseLocale,
  setLocaleCookie,
} from "@/lib/i18n/locale-cookie";
import type { Locale, TranslationDictionary } from "@/types/locale";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

interface LanguageProviderProps {
  children: React.ReactNode;
  initialLocale: Locale;
}

export function LanguageProvider({
  children,
  initialLocale,
}: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const storedLocale = parseLocale(stored);

    if (stored === "en" || stored === "bn") {
      if (storedLocale !== initialLocale) {
        setLocaleState(storedLocale);
        setLocaleCookie(storedLocale);
      }
      return;
    }

    window.localStorage.setItem(LOCALE_STORAGE_KEY, initialLocale);
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const translations = useMemo<TranslationDictionary>(
    () => getTranslations(locale),
    [locale],
  );

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    setLocaleCookie(nextLocale);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[key] ?? key;
    },
    [translations],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }

  return context;
}
