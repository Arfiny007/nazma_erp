"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useLanguage } from "@/contexts/LanguageContext";
import type {
  DashboardActivityItem,
  DashboardKpi,
  DashboardPayloadDTO,
  DashboardRole,
  DashboardStatusWidget,
  DashboardTableWidget,
  AccountsDashboardWidgets,
  AdminDashboardWidgets,
  ManagerDashboardWidgets,
  SrDashboardWidgets,
} from "@/types/dashboard";

import { DashboardEmptyState } from "./dashboard-empty-state";
import { DashboardKpiCard } from "./dashboard-kpi-card";

interface DashboardWidgetGridProps {
  role: DashboardRole;
  widgets: DashboardPayloadDTO["widgets"];
}

function DashboardTable({ widget }: { widget: DashboardTableWidget }) {
  const { t } = useLanguage();
  const router = useRouter();

  if (widget.rows.length === 0) {
    return (
      <DashboardEmptyState
        title={t(widget.emptyKey)}
        description={t("dashboard.empty.tableDescription")}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-950/40">
          <tr>
            {widget.columns.map((column) => (
              <th
                key={column.key}
                className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${
                  column.align === "right" ? "text-right" : ""
                }`}
              >
                {t(column.labelKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {widget.rows.map((row) => (
            <tr
              key={row.id}
              className={
                row.href
                  ? "cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  : undefined
              }
              onClick={
                row.href
                  ? () => {
                      router.push(row.href!);
                    }
                  : undefined
              }
            >
              {widget.columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 ${
                    column.align === "right" ? "text-right tabular-nums" : ""
                  }`}
                >
                  {row.cells[column.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardStatusPanel({ widget }: { widget: DashboardStatusWidget }) {
  const { t } = useLanguage();

  return (
    <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t(widget.titleKey)}
        </h3>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {t(widget.statusKey)}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {widget.details.map((detail) => (
          <DashboardKpiCard key={detail.id} kpi={detail} />
        ))}
      </div>
    </article>
  );
}

function SrWidgets({ widgets }: { widgets: SrDashboardWidgets }) {
  const { t } = useLanguage();

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t(widgets.myDealers.titleKey)}
        </h3>
        <DashboardTable widget={widgets.myDealers} />
      </section>
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t("dashboard.widgets.recentActivity")}
        </h3>
        {widgets.recentActivity.length === 0 ? (
          <DashboardEmptyState
            title={t("dashboard.noActivity")}
            description={t("dashboard.noActivityDescription")}
          />
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200/80 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {widgets.recentActivity.map((item: DashboardActivityItem) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
                      {item.reference}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t(item.labelKey)}
                    </p>
                  </div>
                  <div className="text-right">
                    {item.amount ? (
                      <p className="text-sm tabular-nums text-slate-700 dark:text-slate-200">
                        {item.amount}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(item.occurredAt).toLocaleString()}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ManagerWidgets({ widgets }: { widgets: ManagerDashboardWidgets }) {
  const { t } = useLanguage();

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {(
        [
          widgets.srLeaderboard,
          widgets.riskDealers,
          widgets.territoryComparison,
        ] as DashboardTableWidget[]
      ).map((widget) => (
        <section key={widget.id} className={widget.id === "territoryComparison" ? "xl:col-span-2" : ""}>
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t(widget.titleKey)}
          </h3>
          <DashboardTable widget={widget} />
        </section>
      ))}
    </div>
  );
}

function AccountsWidgets({ widgets }: { widgets: AccountsDashboardWidgets }) {
  const { t } = useLanguage();

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <DashboardStatusPanel widget={widgets.financialHealth} />
      <DashboardStatusPanel widget={widgets.reconciliationStatus} />
      <section className="xl:col-span-2">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t(widgets.pendingAllocations.titleKey)}
        </h3>
        <DashboardTable widget={widgets.pendingAllocations} />
      </section>
    </div>
  );
}

function AdminWidgets({ widgets }: { widgets: AdminDashboardWidgets }) {
  const { t } = useLanguage();

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <DashboardStatusPanel widget={widgets.systemHealth} />
      <DashboardStatusPanel widget={widgets.financialIntegrity} />
      <section className="xl:col-span-2">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t("dashboard.widgets.dealerGrowth")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {widgets.dealerGrowth.map((kpi: DashboardKpi) => (
            <DashboardKpiCard key={kpi.id} kpi={kpi} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function DashboardWidgetGrid({ role, widgets }: DashboardWidgetGridProps) {
  switch (role) {
    case "SR":
      return <SrWidgets widgets={widgets as SrDashboardWidgets} />;
    case "Manager":
      return <ManagerWidgets widgets={widgets as ManagerDashboardWidgets} />;
    case "Accounts":
      return <AccountsWidgets widgets={widgets as AccountsDashboardWidgets} />;
    case "Super_Admin":
      return <AdminWidgets widgets={widgets as AdminDashboardWidgets} />;
    default:
      return null;
  }
}
