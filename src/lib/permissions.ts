import { UserRole } from "@prisma/client";

export type Permission =
  | "dashboard:view"
  | "dealers:view"
  | "dealers:manage"
  | "products:view"
  | "products:manage"
  | "orders:view"
  | "orders:manage"
  | "invoices:view"
  | "invoices:manage"
  | "collections:view"
  | "collections:manage"
  | "ledger:view"
  | "reports:view"
  | "audit:view"
  | "settings:view"
  | "users:manage";

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  Super_Admin: [
    "dashboard:view",
    "dealers:view",
    "dealers:manage",
    "products:view",
    "products:manage",
    "orders:view",
    "orders:manage",
    "invoices:view",
    "invoices:manage",
    "collections:view",
    "collections:manage",
    "ledger:view",
    "reports:view",
    "audit:view",
    "settings:view",
    "users:manage",
  ],
  Manager: [
    "dashboard:view",
    "dealers:view",
    "dealers:manage",
    "products:view",
    "orders:view",
    "orders:manage",
    "invoices:view",
    "collections:view",
    "ledger:view",
    "reports:view",
  ],
  Accounts: [
    "dashboard:view",
    "dealers:view",
    "invoices:view",
    "invoices:manage",
    "collections:view",
    "collections:manage",
    "ledger:view",
    "reports:view",
  ],
  SR: [
    "dashboard:view",
    "dealers:view",
    "orders:view",
    "orders:manage",
    "collections:view",
  ],
} as const;

export function hasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function getPermissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
