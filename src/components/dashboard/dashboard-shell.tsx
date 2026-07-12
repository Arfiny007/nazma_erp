"use client";

import type { ReactNode } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AnalyticsPayloadDTO } from "@/types/analytics";
import type { DashboardPayloadDTO } from "@/types/dashboard";
import type { TerritoryMapPayloadDTO } from "@/types/maps";

import { DashboardChartsGrid } from "./charts";
import { DashboardEmptyState } from "./dashboard-empty-state";
import { DashboardHeader } from "./dashboard-header";
import { DashboardLoading } from "./dashboard-loading";
import { DashboardSummaryCards } from "./dashboard-summary-cards";
import { DashboardWidgetGrid } from "./dashboard-widget-grid";
import { TerritoryMapCard } from "./maps";

interface DashboardShellProps {
  payload: DashboardPayloadDTO | null;
  analytics: AnalyticsPayloadDTO | null;
  mapPayload: TerritoryMapPayloadDTO | null;
  errorKey: string | null;
  isLoading?: boolean;
}

export function DashboardShell({
  payload,
  analytics,
  mapPayload,
  errorKey,
  isLoading = false,
}: DashboardShellProps) {
  const { t } = useLanguage();

  if (isLoading) {
    return <DashboardLoading />;
  }

  if (errorKey) {
    return (
      <PageContainer title={t("dashboard.title")}>
        <DashboardEmptyState
          title={t("common.error.title")}
          description={t(errorKey)}
        />
      </PageContainer>
    );
  }

  if (!payload) {
    return (
      <PageContainer title={t("dashboard.title")}>
        <DashboardEmptyState
          title={t("dashboard.empty.noData")}
          description={t("dashboard.empty.noDataDescription")}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={t(payload.summary.titleKey)}
      description={t(payload.summary.scopeKey)}
    >
      <div className="space-y-6">
        <DashboardHeader
          generatedAt={payload.generatedAt}
          role={payload.summary.role}
        />
        <DashboardSummaryCards kpis={payload.summary.kpis} />
        {analytics ? (
          <DashboardSection title={t("dashboard.analytics.sectionTitle")}>
            <DashboardChartsGrid charts={analytics.charts} />
          </DashboardSection>
        ) : null}
        {mapPayload ? (
          <DashboardSection title={t("dashboard.map.overviewTitle")}>
            <TerritoryMapCard initialPayload={mapPayload} />
          </DashboardSection>
        ) : null}
        <DashboardWidgetGrid
          role={payload.summary.role}
          widgets={payload.widgets}
        />
      </div>
    </PageContainer>
  );
}

export function DashboardSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
        {title}
      </h2>
      {children}
    </section>
  );
}
