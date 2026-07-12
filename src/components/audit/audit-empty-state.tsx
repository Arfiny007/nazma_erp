"use client";

import { Shield } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";

export function AuditEmptyState() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Shield aria-hidden="true" className="size-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {t("audit.empty.title")}
      </h3>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        {t("audit.empty.description")}
      </p>
    </div>
  );
}
