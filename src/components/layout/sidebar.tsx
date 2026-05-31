"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { AppLogo } from "@/components/shared/app-logo";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "@/lib/navigation";
import { hasPermission } from "@/lib/permissions";
import { UserRole } from "@prisma/client";

import { SidebarItem } from "./sidebar-item";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  userRole?: UserRole;
  className?: string;
}

export function Sidebar({
  collapsed,
  onToggle,
  userRole = UserRole.Super_Admin,
  className,
}: SidebarProps) {
  const { t } = useLanguage();

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      hasPermission(userRole, item.permission),
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-slate-200/80 bg-white transition-[width] duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950 md:flex",
        collapsed ? "w-[72px]" : "w-64",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-slate-200/80 px-4 dark:border-slate-800",
          collapsed ? "justify-center px-2" : "justify-between",
        )}
      >
        <AppLogo collapsed={collapsed} />
      </div>

      <nav
        aria-label="Main navigation"
        className="flex-1 space-y-6 overflow-y-auto px-3 py-4"
      >
        {visibleSections.map((section) => (
          <div key={section.id}>
            {section.labelKey && !collapsed && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t(section.labelKey)}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.id}>
                  <SidebarItem item={item} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200/80 p-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors",
            "hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
            collapsed && "justify-center px-2",
          )}
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" className="size-4" />
          ) : (
            <>
              <ChevronLeft aria-hidden="true" className="size-4" />
              <span>{t("sidebar.collapse")}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
