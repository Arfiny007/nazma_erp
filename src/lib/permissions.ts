/**
 * Centralized RBAC permission definitions for Nazma ERP.
 *
 * ALL permission logic flows through this file.
 * Never scatter role checks throughout the application.
 *
 * Future AuditLog integration: consume `getPermissionContext()` from
 * src/lib/rbac/index.ts to log every permission check with role, resource,
 * action, and outcome.
 */

import type { UserRole } from "@prisma/client";

// ---------------------------------------------------------------------------
// Resource taxonomy
// ---------------------------------------------------------------------------

export type Resource =
  | "dashboard"
  | "dealers"
  | "products"
  | "projects"
  | "orders"
  | "invoices"
  | "collections"
  | "ledger"
  | "reports"
  | "audit"
  | "settings"
  | "users";

// ---------------------------------------------------------------------------
// Action taxonomy
// ---------------------------------------------------------------------------

export type Action = "view" | "create" | "edit" | "delete" | "approve";

// ---------------------------------------------------------------------------
// Permissions — every valid resource:action pair
// ---------------------------------------------------------------------------

export type Permission =
  // Dashboard
  | "dashboard:view"
  // Dealers
  | "dealers:view"
  | "dealers:create"
  | "dealers:edit"
  | "dealers:delete"
  // Products
  | "products:view"
  | "products:create"
  | "products:edit"
  | "products:delete"
  // Projects
  | "projects:view"
  | "projects:create"
  | "projects:edit"
  | "projects:delete"
  // Orders
  | "orders:view"
  | "orders:create"
  | "orders:edit"
  | "orders:delete"
  | "orders:approve"
  // Invoices
  | "invoices:view"
  | "invoices:create"
  | "invoices:edit"
  | "invoices:delete"
  // Collections
  | "collections:view"
  | "collections:create"
  | "collections:edit"
  | "collections:delete"
  // Ledger (read-only per business rules)
  | "ledger:view"
  // Due Reports
  | "reports:view"
  // Administration
  | "audit:view"
  | "settings:view"
  | "users:manage";

// ---------------------------------------------------------------------------
// Permission matrix
//
// Dealers      Super_Admin=Full  Manager=Full     Accounts=Read   SR=Create/Edit
// Products     Super_Admin=Full  Manager=Full     Accounts=Read   SR=Read
// Projects     Super_Admin=Full  Manager=Full     Accounts=Read   SR=Create/Edit
// Orders       Super_Admin=Full  Manager=Create/Edit/Approve  Accounts=Read  SR=Create
// Invoices     Super_Admin=Full  Manager=Read     Accounts=Full   SR=Read
// Collections  Super_Admin=Full  Manager=Read     Accounts=Full   SR=Read
// Ledger       Super_Admin=Full  Manager=Read     Accounts=Full   SR=Read
// Due Reports  Super_Admin=Full  Manager=Read     Accounts=Full   SR=Read
// ---------------------------------------------------------------------------

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  Super_Admin: [
    "dashboard:view",
    // Dealers — Full
    "dealers:view",
    "dealers:create",
    "dealers:edit",
    "dealers:delete",
    // Products — Full
    "products:view",
    "products:create",
    "products:edit",
    "products:delete",
    // Projects — Full
    "projects:view",
    "projects:create",
    "projects:edit",
    "projects:delete",
    // Orders — Full
    "orders:view",
    "orders:create",
    "orders:edit",
    "orders:delete",
    "orders:approve",
    // Invoices — Full
    "invoices:view",
    "invoices:create",
    "invoices:edit",
    "invoices:delete",
    // Collections — Full
    "collections:view",
    "collections:create",
    "collections:edit",
    "collections:delete",
    // Ledger — Full (view for now; write ops added when module is built)
    "ledger:view",
    // Reports — Full
    "reports:view",
    // Administration — Full
    "audit:view",
    "settings:view",
    "users:manage",
  ],

  Manager: [
    "dashboard:view",
    // Dealers — Full
    "dealers:view",
    "dealers:create",
    "dealers:edit",
    "dealers:delete",
    // Products — Full
    "products:view",
    "products:create",
    "products:edit",
    "products:delete",
    // Projects — Full
    "projects:view",
    "projects:create",
    "projects:edit",
    "projects:delete",
    // Orders — Create / Edit / Approve (no hard delete)
    "orders:view",
    "orders:create",
    "orders:edit",
    "orders:approve",
    // Invoices — Read
    "invoices:view",
    // Collections — Read
    "collections:view",
    // Ledger — Read
    "ledger:view",
    // Reports — Read
    "reports:view",
  ],

  Accounts: [
    "dashboard:view",
    // Dealers — Read
    "dealers:view",
    // Products — Read
    "products:view",
    // Projects — Read
    "projects:view",
    // Orders — Read
    "orders:view",
    // Invoices — Full
    "invoices:view",
    "invoices:create",
    "invoices:edit",
    "invoices:delete",
    // Collections — Full
    "collections:view",
    "collections:create",
    "collections:edit",
    "collections:delete",
    // Ledger — Full (view for now)
    "ledger:view",
    // Reports — Full
    "reports:view",
  ],

  SR: [
    "dashboard:view",
    // Dealers — Create/Edit (no delete)
    "dealers:view",
    "dealers:create",
    "dealers:edit",
    // Products — Read
    "products:view",
    // Projects — Create/Edit (no delete)
    "projects:view",
    "projects:create",
    "projects:edit",
    // Orders — Create (no edit/delete/approve)
    "orders:view",
    "orders:create",
    // Invoices — Read
    "invoices:view",
    // Collections — Read
    "collections:view",
    // Ledger — Read
    "ledger:view",
    // Reports — Read
    "reports:view",
  ],
} as const;

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Returns true if the given role includes the specified permission.
 * Edge-runtime safe: pure object lookup, no async I/O.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission);
}

/**
 * Returns the full permission set for a role.
 * Used by audit helpers and debugging tools.
 */
export function getPermissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
