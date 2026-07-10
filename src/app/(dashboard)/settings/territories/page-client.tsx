"use client";

import Link from "next/link";

import { TerritoryTable } from "@/components/geography/territory-table";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";

export function TerritoriesPageClient() {
  const { t } = useLanguage();

  return (
    <PageContainer
      title={t("geography.territories.title")}
      description={t("geography.territories.subtitle")}
      actions={
        <Link
          href="/settings/geography"
          className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
        >
          {t("geography.territories.viewGeography")}
        </Link>
      }
    >
      <TerritoryTable />
    </PageContainer>
  );
}
