"use client";

import { Languages } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { LOCALES, type Locale } from "@/types/locale";

interface LanguageSwitcherProps {
  className?: string;
  compact?: boolean;
}

export function LanguageSwitcher({
  className,
  compact = false,
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useLanguage();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setLocale(event.target.value as Locale);
  };

  return (
    <div className={cn("relative", className)}>
      <label className="sr-only" htmlFor="language-switcher">
        {t("language.switch")}
      </label>
      <Languages
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
      />
      <select
        id="language-switcher"
        value={locale}
        onChange={handleChange}
        className={cn(
          "h-9 appearance-none rounded-lg border border-slate-200/80 bg-white pl-8 pr-8 text-sm font-medium text-slate-700 shadow-sm transition-colors",
          "hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20",
          "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600",
          compact ? "w-[108px]" : "w-[128px]",
        )}
      >
        {LOCALES.map((item) => (
          <option key={item.code} value={item.code}>
            {t(item.labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
