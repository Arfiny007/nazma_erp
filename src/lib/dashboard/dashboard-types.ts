import type { UserRole } from "@prisma/client";

/**
 * Enterprise Dashboard types — PHASE_09A.
 *
 * Presentation-layer contracts only. Financial values originate from certified
 * read engines (due reports, integrity monitor, reconciliation).
 *
 * @see ADR-042
 */

export type DashboardRole = Extract<
  UserRole,
  "SR" | "Manager" | "Accounts" | "Super_Admin"
>;

export type DashboardKpiTone = "default" | "success" | "warning" | "danger";

export interface DashboardKpi {
  id: string;
  labelKey: string;
  value: string;
  href?: string;
  tone?: DashboardKpiTone;
}

export interface DashboardTableColumn {
  key: string;
  labelKey: string;
  align?: "left" | "right";
}

export interface DashboardTableRow {
  id: string;
  cells: Record<string, string>;
  href?: string;
}

export interface DashboardTableWidget {
  id: string;
  titleKey: string;
  columns: DashboardTableColumn[];
  rows: DashboardTableRow[];
  emptyKey: string;
}

export interface DashboardActivityItem {
  id: string;
  type: "invoice" | "collection" | "order";
  labelKey: string;
  reference: string;
  amount: string | null;
  occurredAt: string;
  href: string;
}

export interface DashboardStatusWidget {
  id: string;
  titleKey: string;
  statusKey: string;
  statusTone: DashboardKpiTone;
  details: DashboardKpi[];
}

export interface DashboardSummary {
  role: DashboardRole;
  scopeKey: string;
  titleKey: string;
  kpis: DashboardKpi[];
}

export interface SrDashboardWidgets {
  myDealers: DashboardTableWidget;
  recentActivity: DashboardActivityItem[];
}

export interface ManagerDashboardWidgets {
  srLeaderboard: DashboardTableWidget;
  riskDealers: DashboardTableWidget;
  territoryComparison: DashboardTableWidget;
}

export interface AccountsDashboardWidgets {
  financialHealth: DashboardStatusWidget;
  reconciliationStatus: DashboardStatusWidget;
  pendingAllocations: DashboardTableWidget;
}

export interface AdminDashboardWidgets {
  systemHealth: DashboardStatusWidget;
  financialIntegrity: DashboardStatusWidget;
  dealerGrowth: DashboardKpi[];
}

export type DashboardWidgets =
  | SrDashboardWidgets
  | ManagerDashboardWidgets
  | AccountsDashboardWidgets
  | AdminDashboardWidgets;

export interface DashboardPayload {
  summary: DashboardSummary;
  widgets: DashboardWidgets;
  generatedAt: string;
}

export interface DashboardContext {
  userId: string;
  role: DashboardRole;
}

export interface DashboardSalesMetrics {
  todaySales: string;
  monthlySales: string;
}

export interface DashboardCollectionMetrics {
  todayCollections: string;
  monthlyCollections: string;
}

export interface DashboardCountMetrics {
  dealerCount: number;
  pendingInvoices: number;
  pendingAllocations: number;
  territoryCount: number;
  userCount: number;
  newDealersThisMonth: number;
  newDealersLastMonth: number;
}
