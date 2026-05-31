"use client";

import { Bell, Menu, Moon, Search, Sun, User } from "lucide-react";

import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  className?: string;
}

export function Header({
  onMenuClick,
  sidebarCollapsed,
  onSidebarToggle,
  className,
}: HeaderProps) {
  const { t } = useLanguage();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = (): void => {
    if (theme === "light") {
      setTheme("dark");
      return;
    }

    if (theme === "dark") {
      setTheme("system");
      return;
    }

    setTheme("light");
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80 lg:px-6",
        className,
      )}
    >
      <button
        type="button"
        onClick={onMenuClick}
        aria-label={t("header.openMenu")}
        className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 md:hidden dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      <button
        type="button"
        onClick={onSidebarToggle}
        aria-label={t("header.toggleSidebar")}
        className="hidden size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 md:inline-flex dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      <div className="relative hidden min-w-0 flex-1 sm:block sm:max-w-md lg:max-w-lg">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          placeholder={t("header.searchPlaceholder")}
          className={cn(
            "h-9 w-full rounded-lg border border-slate-200/80 bg-slate-50/80 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400",
            "transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20",
            "dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-500 dark:focus:bg-slate-900",
          )}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitcher compact />

        <button
          type="button"
          onClick={cycleTheme}
          aria-label={t("theme.toggle")}
          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {resolvedTheme === "dark" ? (
            <Moon aria-hidden="true" className="size-4" />
          ) : (
            <Sun aria-hidden="true" className="size-4" />
          )}
        </button>

        <button
          type="button"
          aria-label={t("header.notifications")}
          className="relative inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <Bell aria-hidden="true" className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-brand-500" />
        </button>

        <button
          type="button"
          aria-label={t("header.profile")}
          className="inline-flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <User aria-hidden="true" className="size-4" />
        </button>
      </div>

      <span className="sr-only">
        {sidebarCollapsed ? "Sidebar collapsed" : "Sidebar expanded"}
      </span>
    </header>
  );
}
