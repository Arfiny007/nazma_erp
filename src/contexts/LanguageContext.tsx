"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import { getTranslations } from "@/lib/i18n/translations";
import {
  resolveClientLocale,
  subscribeLocaleStore,
  syncLocaleExternalStore,
  writeLocalePreference,
} from "@/lib/i18n/locale-store";
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
  const getServerSnapshot = useCallback(() => initialLocale, [initialLocale]);
  const getClientSnapshot = useCallback(
    () => resolveClientLocale(initialLocale),
    [initialLocale],
  );

  const locale = useSyncExternalStore(
    subscribeLocaleStore,
    getClientSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    syncLocaleExternalStore(initialLocale);
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    writeLocalePreference(nextLocale);
  }, []);

  const translations = useMemo<TranslationDictionary>(
    () => getTranslations(locale),
    [locale],
  );

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
