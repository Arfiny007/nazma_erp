"use client";

import {
  ArrowUpRight,
  Receipt,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  href: string;
}

function StatCard({ label, value, change, icon, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200",
        "hover:border-brand-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-800",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {value}
          </p>
          <p className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <TrendingUp aria-hidden="true" className="size-3" />
            {change}
          </p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100 dark:bg-brand-950/60 dark:text-brand-400 dark:group-hover:bg-brand-950">
          {icon}
        </div>
      </div>
      <ArrowUpRight
        aria-hidden="true"
        className="absolute bottom-4 right-4 size-4 text-slate-300 opacity-0 transition-all group-hover:opacity-100 dark:text-slate-600"
      />
    </Link>
  );
}

export default function DashboardPage() {
  const { t, isLoading } = useLanguage();

  const stats: StatCardProps[] = [
    {
      label: t("dashboard.totalDealers"),
      value: "—",
      change: "+0%",
      icon: <Store aria-hidden="true" className="size-5" />,
      href: "/dealers",
    },
    {
      label: t("dashboard.pendingOrders"),
      value: "—",
      change: "+0%",
      icon: <Receipt aria-hidden="true" className="size-5" />,
      href: "/orders",
    },
    {
      label: t("dashboard.totalDue"),
      value: "—",
      change: "+0%",
      icon: <Wallet aria-hidden="true" className="size-5" />,
      href: "/reports/due",
    },
    {
      label: t("dashboard.collectionsToday"),
      value: "—",
      change: "+0%",
      icon: <TrendingUp aria-hidden="true" className="size-5" />,
      href: "/collections",
    },
  ];

  if (isLoading) {
    return (
      <PageContainer
        title={t("dashboard.title")}
        description={t("common.loading")}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800/80"
            />
          ))}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={t("dashboard.title")}
      description={t("dashboard.subtitle")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={t("status.approved")} variant="approved" />
          <StatusBadge label={t("status.pending")} variant="pending" />
          <StatusBadge label={t("status.overdue")} variant="overdue" />
        </div>
      }
    >
      <section aria-labelledby="dashboard-stats" className="mb-8">
        <h2 id="dashboard-stats" className="sr-only">
          {t("dashboard.title")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </section>

      <section aria-labelledby="recent-activity-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="recent-activity-heading"
            className="text-sm font-semibold text-slate-900 dark:text-slate-50"
          >
            {t("dashboard.recentActivity")}
          </h2>
        </div>

        <EmptyState
          title={t("dashboard.noActivity")}
          description={t("dashboard.noActivityDescription")}
        />
      </section>
    </PageContainer>
  );
}
