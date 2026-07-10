"use client";

import { ShieldAlert } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";

export function IntegrityConsoleEmptyState() {
  const { t } = useLanguage();

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900/40"
      role="status"
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <ShieldAlert
          aria-hidden="true"
          className="size-5 text-slate-400 dark:text-slate-500"
        />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
        {t("integrityConsole.empty.title")}
      </h3>
      <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
        {t("integrityConsole.empty.description")}
      </p>
    </div>
  );
}
