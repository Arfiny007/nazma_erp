import type { UserRole } from "@prisma/client";

import type { TerritoryScope } from "@/lib/rbac/territory";

import {
  EmptyAuditScopeError,
  UnsupportedAuditRoleError,
} from "./audit-errors";
import type {
  AuditCategory,
  AuditContext,
  AuditFilters,
  AuditRole,
} from "./audit-types";

const AUDIT_ROLES: readonly AuditRole[] = [
  "Super_Admin",
  "Accounts",
  "Manager",
  "SR",
];

export const DEFAULT_AUDIT_PAGE_SIZE = 25;
export const MAX_AUDIT_PAGE_SIZE = 100;

export const FINANCIAL_AUDIT_ACTIONS = [
  "INVOICE_CREATED",
  "COLLECTION_CREATED",
  "COLLECTION_CONFIRMED",
  "COLLECTION_ALLOCATED",
  "COLLECTION_DEALLOCATED",
  "COLLECTION_REVERSED",
  "COLLECTION_REVERSED_MISALLOCATION",
  "DEALER_BALANCE_UPDATED",
  "DEALER_BALANCE_DECREASED",
  "DEALER_OPENING_BALANCE_POSTED",
] as const;

export const DEALER_AUDIT_ACTIONS = [
  "DEALER_CREATED",
  "DEALER_UPDATED",
  "DEALER_TERRITORY_TRANSFERRED",
  "DEALER_OWNERSHIP_ASSIGNED",
] as const;

export const SECURITY_AUDIT_ACTIONS = [
  "LOGIN",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_ACTIVATED",
  "USER_DEACTIVATED",
  "USER_ROLE_CHANGED",
  "TERRITORY_ASSIGNMENT_CREATED",
  "TERRITORY_ASSIGNMENT_REVOKED",
  "PERMISSION_DENIED",
] as const;

export const INTEGRITY_AUDIT_ACTIONS = [
  "FINANCIAL_INTEGRITY_SCAN",
  "RECONCILIATION_RUN",
  "LEDGER_BACKFILL_RUN",
  "LEDGER_REPLAY_RUN",
] as const;

export const OPERATIONAL_AUDIT_ACTIONS = [
  "CREATE",
  "SUBMIT",
  "UPDATE",
  "APPROVE",
  "REJECT",
  "CANCEL",
  "DELIVERY_CHALLAN_CREATED",
  "DELIVERY_CHALLAN_UPDATED",
  "DELIVERY_CHALLAN_CONFIRMED",
  "DELIVERY_CHALLAN_CANCELLED",
] as const;

const ACCOUNTS_ALLOWED_CATEGORIES: readonly AuditCategory[] = [
  "financial",
  "integrity",
];

export function assertAuditRole(role: UserRole): AuditRole {
  if (!AUDIT_ROLES.includes(role as AuditRole)) {
    throw new UnsupportedAuditRoleError(role);
  }
  return role as AuditRole;
}

export function assertScopedAuditAccess(scope: TerritoryScope): void {
  if (scope.mode === "NONE") {
    throw new EmptyAuditScopeError();
  }
  if (scope.mode === "TERRITORIES" && scope.territoryIds.length === 0) {
    throw new EmptyAuditScopeError();
  }
}

export function buildAuditContext(userId: string, role: UserRole): AuditContext {
  return {
    userId,
    role: assertAuditRole(role),
  };
}

export function normalizeAuditFilters(
  filters: AuditFilters,
  options?: { maxPageSize?: number },
): AuditFilters {
  const page = Number.isFinite(filters.page) && filters.page > 0 ? filters.page : 1;
  const requestedSize =
    Number.isFinite(filters.pageSize) && filters.pageSize > 0
      ? filters.pageSize
      : DEFAULT_AUDIT_PAGE_SIZE;
  const maxPageSize = options?.maxPageSize ?? MAX_AUDIT_PAGE_SIZE;

  return {
    ...filters,
    page,
    pageSize: Math.min(requestedSize, maxPageSize),
    search: filters.search?.trim() || undefined,
    action: filters.action?.trim() || undefined,
    entityType: filters.entityType?.trim() || undefined,
    role: filters.role?.trim() || undefined,
  };
}

export function classifyAuditAction(action: string, entityType: string): AuditCategory {
  if ((FINANCIAL_AUDIT_ACTIONS as readonly string[]).includes(action)) {
    return "financial";
  }
  if ((INTEGRITY_AUDIT_ACTIONS as readonly string[]).includes(action)) {
    return "integrity";
  }
  if ((SECURITY_AUDIT_ACTIONS as readonly string[]).includes(action)) {
    return "security";
  }
  if (
    (DEALER_AUDIT_ACTIONS as readonly string[]).includes(action) ||
    entityType === "Dealer"
  ) {
    return "dealer";
  }
  if ((OPERATIONAL_AUDIT_ACTIONS as readonly string[]).includes(action)) {
    return "operational";
  }
  if (entityType === "SalesOrder" || entityType === "DeliveryChallan") {
    return "operational";
  }
  return "operational";
}

export function isIntegrityCategory(category: AuditCategory): boolean {
  return category === "integrity";
}

export function resolveAllowedCategories(role: AuditRole): AuditCategory[] | "ALL" {
  switch (role) {
    case "Super_Admin":
    case "Manager":
    case "SR":
      return "ALL";
    case "Accounts":
      return [...ACCOUNTS_ALLOWED_CATEGORIES];
    default:
      return "ALL";
  }
}

export function categoryMatchesRole(
  role: AuditRole,
  action: string,
  entityType: string,
): boolean {
  const allowed = resolveAllowedCategories(role);
  if (allowed === "ALL") {
    return true;
  }
  const category = classifyAuditAction(action, entityType);
  if (category === "integrity") {
    return allowed.includes("integrity");
  }
  return allowed.includes(category);
}

export function parseAuditDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}
