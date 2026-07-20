import type { Locale } from "@/types/locale";

import { LOCALE_STORAGE_KEY, parseLocale, setLocaleCookie } from "./locale-cookie";

/** Same-tab locale updates (storage event only fires across tabs). */
export const LOCALE_CHANGE_EVENT = "nazma-locale-change";

export function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === "en" || stored === "bn") {
    return stored;
  }

  return null;
}

export function resolveClientLocale(initialLocale: Locale): Locale {
  return readStoredLocale() ?? initialLocale;
}

export function subscribeLocaleStore(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (): void => {
    onStoreChange();
  };

  window.addEventListener("storage", handler);
  window.addEventListener(LOCALE_CHANGE_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(LOCALE_CHANGE_EVENT, handler);
  };
}

export function writeLocalePreference(locale: Locale): void {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  setLocaleCookie(locale);
  window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
}

/**
 * External-store seeding only — writes localStorage / cookie, never React state.
 * Prefer stored locale over the cookie-derived initial when both exist.
 */
export function syncLocaleExternalStore(initialLocale: Locale): void {
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);

  if (stored === "en" || stored === "bn") {
    const storedLocale = parseLocale(stored);
    if (storedLocale !== initialLocale) {
      setLocaleCookie(storedLocale);
    }
    return;
  }

  window.localStorage.setItem(LOCALE_STORAGE_KEY, initialLocale);
}
