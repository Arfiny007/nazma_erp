"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  DEFAULT_LOCALE,
  type Locale,
  type TranslationDictionary,
} from "@/types/locale";

const LOCALE_STORAGE_KEY = "nazma-locale";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

async function loadTranslations(locale: Locale): Promise<TranslationDictionary> {
  const response = await fetch(`/locales/${locale}/common.json`);

  if (!response.ok) {
    throw new Error(`Failed to load translations for locale: ${locale}`);
  }

  return response.json() as Promise<TranslationDictionary>;
}

function getStoredLocale(): Locale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);

  if (stored === "en" || stored === "bn") {
    return stored;
  }

  return DEFAULT_LOCALE;
}

interface LanguageProviderProps {
  children: React.ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => getStoredLocale());
  const [translations, setTranslations] = useState<TranslationDictionary>({});
  const [loadedLocale, setLoadedLocale] = useState<Locale | null>(null);
  const isLoading = loadedLocale !== locale;

  useEffect(() => {
    let cancelled = false;

    async function fetchTranslations() {
      try {
        const dictionary = await loadTranslations(locale);

        if (!cancelled) {
          setTranslations(dictionary);
          setLoadedLocale(locale);
        }
      } catch {
        if (cancelled) {
          return;
        }

        if (locale !== DEFAULT_LOCALE) {
          try {
            const fallback = await loadTranslations(DEFAULT_LOCALE);
            if (!cancelled) {
              setTranslations(fallback);
            }
          } catch {
            // Keep previous translations when fallback loading fails.
          }
        }

        if (!cancelled) {
          setLoadedLocale(locale);
        }
      }
    }

    void fetchTranslations();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
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
      isLoading,
    }),
    [locale, setLocale, t, isLoading],
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
