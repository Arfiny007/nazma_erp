/**
 * Centralized BDT money formatting for ERP display surfaces.
 *
 * Values are pre-formatted decimal strings from the server — this utility
 * performs locale-aware presentation only. Never use for calculations.
 */

export type AppLocale = "en" | "bn";

export function createMoneyFormatter(locale: AppLocale): Intl.NumberFormat {
  return new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
    style: "currency",
    currency: "BDT",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMoney(
  value: string,
  formatter: Intl.NumberFormat,
): string {
  return formatter.format(Number(value));
}

/** True when a server decimal string represents a non-zero monetary amount. */
export function hasMoneyValue(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  return !/^0+(\.0+)?$/.test(normalized);
}

export function createDocumentDateFormatter(locale: AppLocale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
