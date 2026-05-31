"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/navigation";

interface SidebarItemProps {
  item: NavItem;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarItem({
  item,
  collapsed = false,
  onNavigate,
}: SidebarItemProps) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const isActive =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const Icon = item.icon;
  const label = t(item.labelKey);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        isActive
          ? "bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-950/60 dark:text-brand-300"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-[18px] shrink-0 transition-colors",
          isActive
            ? "text-brand-600 dark:text-brand-400"
            : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300",
        )}
      />
      {!collapsed && <span className="truncate">{label}</span>}
      {isActive && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-600 dark:bg-brand-400",
            collapsed && "hidden",
          )}
        />
      )}
    </Link>
  );
}
