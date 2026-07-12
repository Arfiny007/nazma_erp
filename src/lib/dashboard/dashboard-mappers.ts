import type { Prisma } from "@prisma/client";

import type { CompanyDueSummary } from "@/lib/reports/due";
import type { FinancialIntegrityScanRecord } from "@/lib/ledger/monitor";
import type { ReconciliationSummary } from "@/lib/ledger/reconciliation";

import type {
  DashboardActivityItem,
  DashboardKpi,
  DashboardKpiTone,
  DashboardPayload,
  DashboardRole,
  DashboardStatusWidget,
  DashboardSummary,
  DashboardTableRow,
  DashboardTableWidget,
} from "./dashboard-types";
import type { RecentActivityRecord } from "./dashboard-query";
import { resolveScopeKey, resolveTitleKey } from "./dashboard-validation";

const MONEY_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

export function formatMoney(value: Prisma.Decimal | string): string {
  const numeric =
    typeof value === "string" ? Number.parseFloat(value) : value.toNumber();
  if (Number.isNaN(numeric)) {
    return typeof value === "string" ? value : value.toFixed(2);
  }
  return numeric.toLocaleString(undefined, MONEY_OPTIONS);
}

export function formatCount(value: number): string {
  return value.toLocaleString();
}

export function buildKpi(
  id: string,
  labelKey: string,
  value: string,
  options?: { href?: string; tone?: DashboardKpiTone },
): DashboardKpi {
  return {
    id,
    labelKey,
    value,
    href: options?.href,
    tone: options?.tone,
  };
}

export function mapDueSummaryToKpis(
  dueSummary: CompanyDueSummary,
  options: {
    includeDealerCount?: boolean;
    includeCollections?: string;
    includeSales?: { today?: string; monthly?: string };
    extra?: DashboardKpi[];
  } = {},
): DashboardKpi[] {
  const kpis: DashboardKpi[] = [];

  if (options.includeSales?.today) {
    kpis.push(
      buildKpi("todaySales", "dashboard.kpi.todaySales", options.includeSales.today, {
        href: "/invoices",
      }),
    );
  }
  if (options.includeSales?.monthly) {
    kpis.push(
      buildKpi(
        "monthlySales",
        "dashboard.kpi.monthlySales",
        options.includeSales.monthly,
        { href: "/invoices" },
      ),
    );
  }

  if (options.includeCollections) {
    kpis.push(
      buildKpi(
        "monthlyCollections",
        "dashboard.kpi.collectionsThisMonth",
        options.includeCollections,
        { href: "/collections" },
      ),
    );
  }

  kpis.push(
    buildKpi(
      "outstandingDue",
      "dashboard.kpi.outstandingDue",
      formatMoney(dueSummary.totalDue),
      { href: "/reports/due", tone: dueSummary.totalDue.gt(0) ? "warning" : "default" },
    ),
  );

  if (options.includeDealerCount) {
    kpis.push(
      buildKpi(
        "dealerCount",
        "dashboard.kpi.dealerCount",
        formatCount(dueSummary.totalDealers),
        { href: "/dealers" },
      ),
    );
  }

  if (options.extra) {
    kpis.push(...options.extra);
  }

  return kpis;
}

export function mapDueRowsToTable(
  id: string,
  titleKey: string,
  columns: DashboardTableWidget["columns"],
  rows: Array<{
    id: string;
    cells: Record<string, string>;
    href?: string;
  }>,
  emptyKey: string,
): DashboardTableWidget {
  return {
    id,
    titleKey,
    columns,
    rows,
    emptyKey,
  };
}

export function mapRecentActivity(
  records: RecentActivityRecord[],
): DashboardActivityItem[] {
  return records.map((record) => ({
    id: record.id,
    type: record.type,
    labelKey: `dashboard.activity.${record.type}`,
    reference: record.reference,
    amount: record.amount ? formatMoney(record.amount) : null,
    occurredAt: record.occurredAt.toISOString(),
    href: record.href,
  }));
}

export function mapIntegrityStatusWidget(
  scan: FinancialIntegrityScanRecord | null,
  reconciliation: ReconciliationSummary,
): DashboardStatusWidget {
  const issueCount =
    reconciliation.driftedDealers +
    reconciliation.missingLedgerDealers +
    reconciliation.corruptedDealers;

  const healthy = issueCount === 0;
  const scanAge = scan
    ? `${new Date(scan.completedAt).toLocaleString()}`
    : "—";

  return {
    id: "reconciliationStatus",
    titleKey: "dashboard.widgets.reconciliationStatus",
    statusKey: healthy
      ? "dashboard.status.healthy"
      : "dashboard.status.attentionRequired",
    statusTone: healthy ? "success" : "warning",
    details: [
      buildKpi(
        "consistent",
        "integrityConsole.cards.consistent",
        formatCount(reconciliation.consistentDealers),
      ),
      buildKpi(
        "drifted",
        "integrityConsole.cards.drifted",
        formatCount(reconciliation.driftedDealers),
        { tone: reconciliation.driftedDealers > 0 ? "warning" : "default" },
      ),
      buildKpi(
        "missing",
        "integrityConsole.cards.missingLedger",
        formatCount(reconciliation.missingLedgerDealers),
        {
          tone: reconciliation.missingLedgerDealers > 0 ? "danger" : "default",
        },
      ),
      buildKpi("lastScan", "dashboard.kpi.lastScan", scanAge),
    ],
  };
}

export function mapFinancialHealthWidget(
  dueSummary: CompanyDueSummary,
): DashboardStatusWidget {
  const hasIssues = dueSummary.integrityIssues > 0;
  const overdueTotal = dueSummary.aging.days90Plus
    .plus(dueSummary.aging.days90)
    .plus(dueSummary.aging.days60);

  return {
    id: "financialHealth",
    titleKey: "dashboard.widgets.financialHealth",
    statusKey: hasIssues
      ? "dashboard.status.attentionRequired"
      : "dashboard.status.healthy",
    statusTone: hasIssues ? "warning" : "success",
    details: [
      buildKpi(
        "netReceivable",
        "dashboard.kpi.netReceivable",
        formatMoney(dueSummary.netReceivable),
        { href: "/reports/due" },
      ),
      buildKpi(
        "dealersWithDue",
        "dashboard.kpi.dealersWithDue",
        formatCount(dueSummary.dealersWithDue),
      ),
      buildKpi(
        "overdueExposure",
        "dashboard.kpi.overdueExposure",
        formatMoney(overdueTotal),
        { tone: overdueTotal.gt(0) ? "warning" : "default" },
      ),
      buildKpi(
        "integrityIssues",
        "dashboard.kpi.integrityIssues",
        formatCount(dueSummary.integrityIssues),
        {
          tone: dueSummary.integrityIssues > 0 ? "danger" : "default",
          href: "/ledger/integrity",
        },
      ),
    ],
  };
}

export function mapSystemHealthWidget(
  scan: FinancialIntegrityScanRecord | null,
): DashboardStatusWidget {
  if (!scan) {
    return {
      id: "systemHealth",
      titleKey: "dashboard.widgets.systemHealth",
      statusKey: "dashboard.status.noScan",
      statusTone: "warning",
      details: [
        buildKpi(
          "scanStatus",
          "dashboard.kpi.scanStatus",
          "—",
          { href: "/ledger/integrity" },
        ),
      ],
    };
  }

  const issues =
    scan.driftedDealers + scan.missingLedgerDealers + scan.corruptedDealers;
  const healthy = issues === 0;

  return {
    id: "systemHealth",
    titleKey: "dashboard.widgets.systemHealth",
    statusKey: healthy
      ? "dashboard.status.healthy"
      : "dashboard.status.attentionRequired",
    statusTone: healthy ? "success" : "danger",
    details: [
      buildKpi(
        "totalDealers",
        "integrityConsole.cards.totalDealers",
        formatCount(scan.totalDealers),
      ),
      buildKpi(
        "issues",
        "dashboard.kpi.integrityIssues",
        formatCount(issues),
        { tone: issues > 0 ? "danger" : "success" },
      ),
      buildKpi(
        "duration",
        "dashboard.kpi.scanDuration",
        `${scan.durationMs}ms`,
      ),
    ],
  };
}

export function buildDashboardSummary(
  role: DashboardRole,
  kpis: DashboardKpi[],
): DashboardSummary {
  return {
    role,
    scopeKey: resolveScopeKey(role),
    titleKey: resolveTitleKey(role),
    kpis,
  };
}

export function buildDashboardPayload(
  summary: DashboardSummary,
  widgets: DashboardPayload["widgets"],
  generatedAt: Date,
): DashboardPayload {
  return {
    summary,
    widgets,
    generatedAt: generatedAt.toISOString(),
  };
}

export function mapSrGroupsToRows(
  groups: Array<{
    srId: string | null;
    srName: string | null;
    dealerCount: number;
    totalDue: Prisma.Decimal;
    netBalance: Prisma.Decimal;
  }>,
): DashboardTableRow[] {
  return groups.map((group, index) => ({
    id: group.srId ?? `unassigned-${index}`,
    cells: {
      sr: group.srName ?? "—",
      dealers: formatCount(group.dealerCount),
      totalDue: formatMoney(group.totalDue),
      netBalance: formatMoney(group.netBalance),
    },
  }));
}

export function mapTerritoryGroupsToRows(
  groups: Array<{
    groupId: string;
    groupName: string;
    dealerCount: number;
    totalDue: Prisma.Decimal;
    netBalance: Prisma.Decimal;
  }>,
): DashboardTableRow[] {
  return groups.map((group) => ({
    id: group.groupId,
    cells: {
      territory: group.groupName,
      dealers: formatCount(group.dealerCount),
      totalDue: formatMoney(group.totalDue),
      netBalance: formatMoney(group.netBalance),
    },
  }));
}

export function mapDueReportRowsToTable(
  rows: Array<{
    dealerCode: string;
    dealerName: string;
    territoryName: string | null;
    currentBalance: Prisma.Decimal;
  }>,
): DashboardTableRow[] {
  return rows.map((row) => ({
    id: row.dealerCode,
    cells: {
      dealer: row.dealerName,
      territory: row.territoryName ?? "—",
      due: formatMoney(row.currentBalance),
    },
    href: `/dealers/${row.dealerCode}`,
  }));
}

export function mapPendingAllocationRows(
  rows: Array<{
    id: string;
    collectionNo: string;
    dealerCode: string;
    dealer: { companyName: string };
    unallocatedAmount: Prisma.Decimal;
    collectionDate: Date;
  }>,
): DashboardTableRow[] {
  return rows.map((row) => ({
    id: row.id,
    cells: {
      collection: row.collectionNo,
      dealer: row.dealer.companyName,
      amount: formatMoney(row.unallocatedAmount),
      date: row.collectionDate.toLocaleDateString(),
    },
    href: `/collections/${row.id}/allocate`,
  }));
}
