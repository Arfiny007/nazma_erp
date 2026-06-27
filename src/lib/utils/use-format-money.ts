"use client";

import { useCallback, useMemo } from "react";

import {
  createMoneyFormatter,
  formatMoney,
  type AppLocale,
} from "@/lib/utils/format-money";

/** Locale-aware money formatter for invoice UI surfaces — display only. */
export function useFormatMoney(locale: AppLocale) {
  const formatter = useMemo(() => createMoneyFormatter(locale), [locale]);
  return useCallback((value: string) => formatMoney(value, formatter), [formatter]);
}
