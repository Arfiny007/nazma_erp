"use client";

import Link from "next/link";

import { GeographyHierarchy } from "@/components/geography/geography-hierarchy";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";

export function GeographyPageClient() {
  const { t } = useLanguage();

  return (
    <PageContainer
      title={t("geography.page.title")}
      description={t("geography.page.subtitle")}
      actions={
        <Link
          href="/settings/territories"
          className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
        >
          {t("geography.page.viewTerritories")}
        </Link>
      }
    >
      <GeographyHierarchy />
    </PageContainer>
  );
}
