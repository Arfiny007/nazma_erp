"use client";

import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";

export function DashboardLoading() {
  const { t } = useLanguage();

  return (
    <PageContainer
      title={t("dashboard.title")}
      description={t("common.loading")}
    >
      <div className="space-y-6">
        <div className="h-16 animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800/80" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800/80"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800/80" />
      </div>
    </PageContainer>
  );
}
