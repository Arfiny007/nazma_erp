/**
 * Enterprise Dashboard Foundation — public surface (PHASE_09A).
 *
 * Presentation-only dashboards consuming certified read engines.
 * Never duplicates due/balance/ledger calculations.
 *
 * @see ADR-042
 */

export {
  getSrDashboard,
  getManagerDashboard,
  getAccountsDashboard,
  getAdminDashboard,
  resolveDashboardForRole,
} from "./dashboard-service";

export {
  loadOperationalMetrics,
  aggregateInvoiceSales,
  aggregateCollections,
  findRecentActivity,
  type DashboardReadClient,
} from "./dashboard-query";

export {
  formatMoney,
  formatCount,
  buildDashboardPayload,
  buildDashboardSummary,
} from "./dashboard-mappers";

export {
  assertDashboardRole,
  assertScopedDashboardAccess,
  buildDashboardContext,
  resolveScopeKey,
  resolveTitleKey,
} from "./dashboard-validation";

export {
  DashboardError,
  EmptyTerritoryScopeError,
  UnsupportedDashboardRoleError,
} from "./dashboard-errors";

export type {
  DashboardPayload,
  DashboardSummary,
  DashboardKpi,
  DashboardRole,
  DashboardWidgets,
  DashboardTableWidget,
  DashboardActivityItem,
  DashboardStatusWidget,
  SrDashboardWidgets,
  ManagerDashboardWidgets,
  AccountsDashboardWidgets,
  AdminDashboardWidgets,
} from "./dashboard-types";
