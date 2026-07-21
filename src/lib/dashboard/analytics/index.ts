/**
 * Enterprise Dashboard Analytics — public surface (PHASE_09B).
 *
 * Read-only BI layer consuming certified engines. Never duplicates balance logic.
 *
 * @see ADR-044
 */

export {
  getSrAnalytics,
  getManagerAnalytics,
  getAccountsAnalytics,
  getAdminAnalytics,
  resolveAnalyticsForRole,
} from "./analytics-service";

export {
  buildMonthlySalesTrend,
  buildMonthlyCollectionTrend,
  type AnalyticsReadClient,
} from "./analytics-query";

export {
  mapDecimalTrendToChart,
  mapIntegrityOverviewChart,
  decimalToChartValue,
  mapTopProductsByQuantityChart,
} from "./analytics-mappers";

export {
  assertAnalyticsRole,
  assertAnalyticsScope,
  buildAnalyticsContext,
  isValidDashboardChart,
  isValidChartPoint,
} from "./analytics-validation";

export {
  AnalyticsError,
  EmptyAnalyticsScopeError,
  UnsupportedAnalyticsRoleError,
} from "./analytics-errors";

export type {
  AnalyticsPayload,
  SrAnalyticsPayload,
  ManagerAnalyticsPayload,
  AccountsAnalyticsPayload,
  AdminAnalyticsPayload,
  DashboardChart,
  ChartPoint,
  DashboardChartType,
  TerritoryHeatmapPoint,
  AnalyticsRole,
} from "./analytics-types";
