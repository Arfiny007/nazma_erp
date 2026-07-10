"use client";

import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { TerritoryAssignmentsPanel } from "@/components/settings/territory-assignments-panel";
import { useLanguage } from "@/contexts/LanguageContext";

export function TerritoryAssignmentsPageClient() {
  const { t } = useLanguage();

  return (
    <PageContainer
      title={t("territoryAssignment.page.title")}
      description={t("territoryAssignment.page.subtitle")}
      actions={
        <Link
          href="/settings"
          className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300"
        >
          {t("territoryAssignment.page.backToSettings")}
        </Link>
      }
    >
      <TerritoryAssignmentsPanel />
    </PageContainer>
  );
}
