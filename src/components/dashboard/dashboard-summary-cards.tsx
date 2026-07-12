"use client";

import Link from "next/link";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { DashboardKpi } from "@/types/dashboard";

import { DashboardKpiCard } from "./dashboard-kpi-card";

interface DashboardSummaryCardsProps {
  kpis: DashboardKpi[];
}

export function DashboardSummaryCards({ kpis }: DashboardSummaryCardsProps) {
  const { t } = useLanguage();

  if (kpis.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={t("dashboard.summary.sectionLabel")}
      className={cn(
        "grid gap-4",
        kpis.length >= 5
          ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          : "sm:grid-cols-2 xl:grid-cols-4",
      )}
    >
      {kpis.map((kpi) =>
        kpi.href ? (
          <Link key={kpi.id} href={kpi.href} className="block">
            <DashboardKpiCard kpi={kpi} />
          </Link>
        ) : (
          <DashboardKpiCard key={kpi.id} kpi={kpi} />
        ),
      )}
    </section>
  );
}
