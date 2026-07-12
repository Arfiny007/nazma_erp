/**
 * Dashboard transport types — PHASE_09A.
 */

import type {
  AccountsDashboardWidgets,
  DashboardActivityItem,
  DashboardKpi,
  DashboardPayload,
  DashboardRole,
  DashboardStatusWidget,
  DashboardSummary,
  DashboardTableWidget,
  AdminDashboardWidgets,
  ManagerDashboardWidgets,
  SrDashboardWidgets,
} from "@/lib/dashboard";

export type DashboardActionErrorCode =
  | "FORBIDDEN"
  | "EMPTY_SCOPE"
  | "UNSUPPORTED_ROLE"
  | "INTERNAL_ERROR";

export interface DashboardActionError {
  code: DashboardActionErrorCode;
  messageKey: string;
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: DashboardActionError };

export interface DashboardPayloadDTO {
  summary: DashboardSummary;
  widgets: DashboardPayload["widgets"];
  generatedAt: string;
}

export type {
  DashboardActivityItem,
  DashboardKpi,
  DashboardRole,
  DashboardStatusWidget,
  DashboardSummary,
  DashboardTableWidget,
  SrDashboardWidgets,
  ManagerDashboardWidgets,
  AccountsDashboardWidgets,
  AdminDashboardWidgets,
};
