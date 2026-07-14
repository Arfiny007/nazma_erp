import type { Locale } from "@/types/locale";
import { DEFAULT_LOCALE } from "@/types/locale";

export const LOCALE_COOKIE_NAME = "nazma-locale";
export const LOCALE_STORAGE_KEY = "nazma-locale";

export function parseLocale(value: string | undefined | null): Locale {
  if (value === "en" || value === "bn") {
    return value;
  }

  return DEFAULT_LOCALE;
}

export function setLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;max-age=31536000;SameSite=Lax`;
}
