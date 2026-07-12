import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import {
  DashboardError,
  EmptyTerritoryScopeError,
  UnsupportedDashboardRoleError,
} from "@/lib/dashboard";
import {
  AnalyticsError,
  EmptyAnalyticsScopeError,
  UnsupportedAnalyticsRoleError,
} from "@/lib/dashboard/analytics";
import {
  EmptyMapScopeError,
  MapError,
  UnsupportedMapRoleError,
} from "@/lib/dashboard/maps";
import type {
  ActionResult,
  DashboardActionErrorCode,
} from "@/types/dashboard";

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: DashboardActionErrorCode,
  messageKey: string,
): ActionResult<T> {
  return { success: false, error: { code, messageKey } };
}

export function fromZodError<T>(error: ZodError): ActionResult<T> {
  void error;
  return fail<T>("INTERNAL_ERROR", "validation.failed");
}

export function fromDashboardError<T>(error: unknown): ActionResult<T> {
  if (error instanceof EmptyTerritoryScopeError) {
    return fail<T>("EMPTY_SCOPE", "dashboard.error.emptyScope");
  }
  if (error instanceof UnsupportedDashboardRoleError) {
    return fail<T>("UNSUPPORTED_ROLE", "dashboard.error.unsupportedRole");
  }
  if (error instanceof EmptyAnalyticsScopeError) {
    return fail<T>("EMPTY_SCOPE", "dashboard.error.emptyScope");
  }
  if (error instanceof UnsupportedAnalyticsRoleError) {
    return fail<T>("UNSUPPORTED_ROLE", "dashboard.error.unsupportedRole");
  }
  if (error instanceof EmptyMapScopeError) {
    return fail<T>("EMPTY_SCOPE", "dashboard.error.emptyScope");
  }
  if (error instanceof UnsupportedMapRoleError) {
    return fail<T>("UNSUPPORTED_ROLE", "dashboard.error.unsupportedRole");
  }
  if (
    error instanceof DashboardError ||
    error instanceof AnalyticsError ||
    error instanceof MapError
  ) {
    return fail<T>("INTERNAL_ERROR", "dashboard.error.generic");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
  }
  return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
}

export function toDashboardPayloadDTO(
  payload: import("@/lib/dashboard").DashboardPayload,
): import("@/types/dashboard").DashboardPayloadDTO {
  return {
    summary: payload.summary,
    widgets: payload.widgets,
    generatedAt: payload.generatedAt,
  };
}
