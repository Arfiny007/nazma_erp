"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

import { AppLogo } from "@/components/shared/app-logo";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "@/lib/navigation";
import { hasPermission } from "@/lib/permissions";
import { UserRole } from "@prisma/client";

import { SidebarItem } from "./sidebar-item";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  userRole?: UserRole;
}

export function MobileNav({
  open,
  onClose,
  userRole = UserRole.Super_Admin,
}: MobileNavProps) {
  const { t } = useLanguage();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      hasPermission(userRole, item.permission),
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <>
      <div
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <aside
        aria-hidden={!open}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(88vw,320px)] flex-col border-r border-slate-200/80 bg-white shadow-2xl transition-transform duration-300 ease-in-out md:hidden dark:border-slate-800 dark:bg-slate-950",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800">
          <AppLogo />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <nav
          aria-label="Mobile navigation"
          className="flex-1 space-y-6 overflow-y-auto px-3 py-4"
        >
          {visibleSections.map((section) => (
            <div key={section.id}>
              {section.labelKey && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t(section.labelKey)}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <SidebarItem
                      item={item}
                      onNavigate={onClose}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
