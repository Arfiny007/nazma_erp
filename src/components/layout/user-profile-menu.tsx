"use client";

import { ChevronDown, LogOut, User } from "lucide-react";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export interface UserProfileSummary {
  name: string;
  email: string;
}

interface UserProfileMenuProps {
  user: UserProfileSummary;
  className?: string;
}

export function UserProfileMenu({ user, className }: UserProfileMenuProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        close();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, close]);

  const handleSignOut = () => {
    close();
    void signOut({ callbackUrl: "/login" });
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("header.profile")}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 py-1.5 pl-1.5 pr-2 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <span className="inline-flex size-7 items-center justify-center rounded-md bg-white text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
          <User aria-hidden="true" className="size-4" />
        </span>
        <span className="hidden max-w-[120px] truncate text-xs font-medium sm:inline">
          {user.name}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {user.name}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {user.email}
            </p>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <LogOut aria-hidden="true" className="size-4" />
              {t("auth.signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
