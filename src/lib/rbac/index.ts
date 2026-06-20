/**
 * RBAC helper functions for Nazma ERP.
 *
 * Provides composable, resource-oriented permission helpers that wrap the
 * flat permission list in `src/lib/permissions.ts`.
 *
 * Design principle: no permission logic lives outside this directory or
 * permissions.ts. Consumers call `canView()`, `canCreate()`, etc.
 *
 * Audit-readiness: every function returns or accepts a `PermissionCheckContext`
 * so that a future AuditLog service can record every access decision without
 * changing call sites — just pass `{ onCheck }` to the context variant.
 */

import type { UserRole } from "@prisma/client";

import type { Permission, Resource } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";

// ---------------------------------------------------------------------------
// Audit context (ready for AuditLog integration)
// ---------------------------------------------------------------------------

export interface PermissionCheckContext {
  /** The role that was evaluated. */
  readonly role: UserRole;
  /** The resource being accessed. */
  readonly resource: Resource;
  /** The action being attempted. */
  readonly action: string;
  /** Whether the permission was granted. */
  readonly granted: boolean;
  /** ISO timestamp of the check (populate in AuditLog integration). */
  readonly checkedAt?: string;
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the role can view the resource.
 */
export function canView(role: UserRole, resource: Resource): boolean {
  return hasPermission(role, `${resource}:view` as Permission);
}

/**
 * Returns true if the role can create records for the resource.
 */
export function canCreate(role: UserRole, resource: Resource): boolean {
  return hasPermission(role, `${resource}:create` as Permission);
}

/**
 * Returns true if the role can edit records for the resource.
 */
export function canEdit(role: UserRole, resource: Resource): boolean {
  return hasPermission(role, `${resource}:edit` as Permission);
}

/**
 * Returns true if the role can delete records for the resource.
 */
export function canDelete(role: UserRole, resource: Resource): boolean {
  return hasPermission(role, `${resource}:delete` as Permission);
}

/**
 * Returns true if the role can approve records for the resource.
 * Currently used for Order approval (Manager role).
 */
export function canApprove(role: UserRole, resource: Resource): boolean {
  return hasPermission(role, `${resource}:approve` as Permission);
}

// ---------------------------------------------------------------------------
// Composite helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the role has any write access to the resource
 * (create OR edit OR delete).
 */
export function canWrite(role: UserRole, resource: Resource): boolean {
  return canCreate(role, resource) || canEdit(role, resource) || canDelete(role, resource);
}

/**
 * Returns a full capability summary for the role × resource pair.
 * Useful for rendering action buttons conditionally.
 */
export interface ResourceCapabilities {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
}

export function getCapabilities(
  role: UserRole,
  resource: Resource,
): ResourceCapabilities {
  return {
    view: canView(role, resource),
    create: canCreate(role, resource),
    edit: canEdit(role, resource),
    delete: canDelete(role, resource),
    approve: canApprove(role, resource),
  };
}

// ---------------------------------------------------------------------------
// Audit-ready context builder
// ---------------------------------------------------------------------------

/**
 * Builds an audit context record for a permission check.
 * Call this inside AuditLog integration when it is implemented.
 *
 * @example
 * const ctx = buildPermissionContext(user.role, "orders", "approve");
 * if (!ctx.granted) throw new ForbiddenError("orders:approve");
 * auditLog.record(ctx); // future integration point
 */
export function buildPermissionContext(
  role: UserRole,
  resource: Resource,
  action: string,
): PermissionCheckContext {
  const permission = `${resource}:${action}` as Permission;
  return {
    role,
    resource,
    action,
    granted: hasPermission(role, permission),
    checkedAt: new Date().toISOString(),
  };
}
