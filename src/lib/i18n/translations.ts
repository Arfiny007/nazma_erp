import bnCommon from "../../../public/locales/bn/common.json";
import enCommon from "../../../public/locales/en/common.json";

import type { Locale, TranslationDictionary } from "@/types/locale";
import { DEFAULT_LOCALE } from "@/types/locale";

const TRANSLATIONS: Record<Locale, TranslationDictionary> = {
  en: enCommon,
  bn: bnCommon,
};

export function getTranslations(locale: Locale): TranslationDictionary {
  return TRANSLATIONS[locale] ?? TRANSLATIONS[DEFAULT_LOCALE];
}
