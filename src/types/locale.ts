export type Locale = "en" | "bn";

export interface LocaleConfig {
  code: Locale;
  labelKey: string;
  dir: "ltr" | "rtl";
}

export const LOCALES: LocaleConfig[] = [
  { code: "en", labelKey: "language.english", dir: "ltr" },
  { code: "bn", labelKey: "language.bengali", dir: "ltr" },
];

export const DEFAULT_LOCALE: Locale = "en";

export type TranslationDictionary = Record<string, string>;
