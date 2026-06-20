/**
 * Server-side authorization guards for Nazma ERP.
 *
 * Use these in Server Actions and Server Components to enforce permissions.
 *
 * Usage in Server Actions:
 *   const user = await requirePermission("dealers:create");
 *   // user is guaranteed to be authenticated and authorized
 *
 * Usage in Server Components (page.tsx):
 *   await enforcePermission("ledger:view");
 *   // redirects to /access-denied if unauthorized
 *
 * Never use these in Client Components — call from Server Actions only.
 */

import { redirect } from "next/navigation";

import type { Permission } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";
import type { AuthUser } from "@/types/auth";
import { getCurrentUser, requireUser } from "@/lib/auth/helpers";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Thrown by `requirePermission()` when the user lacks the required permission.
 * Server Actions should catch this and return a structured error response.
 */
export class ForbiddenError extends Error {
  readonly permission: Permission;
  readonly userRole: UserRole | null;

  constructor(permission: Permission, userRole: UserRole | null = null) {
    super(`Forbidden: required permission "${permission}" not granted for role "${userRole ?? "unknown"}"`);
    this.name = "ForbiddenError";
    this.permission = permission;
    this.userRole = userRole;
  }
}

/**
 * Thrown by `requireUser()` when no authenticated session exists.
 * Re-exported here for convenience in Server Actions that import from rbac/guards.
 */
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized: authentication required");
    this.name = "UnauthorizedError";
  }
}

// ---------------------------------------------------------------------------
// Server Action guards (throw on failure — do NOT redirect)
// ---------------------------------------------------------------------------

/**
 * Asserts that the current user has the specified permission.
 *
 * @throws {UnauthorizedError} if the user is not authenticated.
 * @throws {ForbiddenError} if the user lacks the required permission.
 * @returns The authenticated, authorized user.
 */
export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await requireUser();

  if (!hasPermission(user.role, permission)) {
    throw new ForbiddenError(permission, user.role);
  }

  return user;
}

/**
 * Asserts that the current user has ALL of the specified permissions.
 *
 * @throws {UnauthorizedError} if the user is not authenticated.
 * @throws {ForbiddenError} if the user lacks any of the required permissions.
 * @returns The authenticated, authorized user.
 */
export async function requireAllPermissions(
  ...permissions: Permission[]
): Promise<AuthUser> {
  const user = await requireUser();

  for (const permission of permissions) {
    if (!hasPermission(user.role, permission)) {
      throw new ForbiddenError(permission, user.role);
    }
  }

  return user;
}

/**
 * Asserts that the current user has AT LEAST ONE of the specified permissions.
 *
 * @throws {UnauthorizedError} if the user is not authenticated.
 * @throws {ForbiddenError} if the user lacks all of the required permissions.
 * @returns The authenticated, authorized user.
 */
export async function requireAnyPermission(
  ...permissions: Permission[]
): Promise<AuthUser> {
  const user = await requireUser();

  const hasAny = permissions.some((p) => hasPermission(user.role, p));
  if (!hasAny) {
    throw new ForbiddenError(permissions[0], user.role);
  }

  return user;
}

// ---------------------------------------------------------------------------
// Server Component guards (redirect on failure)
// ---------------------------------------------------------------------------

/**
 * Redirects to `/access-denied` if the current user lacks the permission.
 * Use at the top of Server Component page files.
 *
 * @returns The authenticated, authorized user (never returns if unauthorized).
 */
export async function enforcePermission(permission: Permission): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user || !hasPermission(user.role, permission)) {
    redirect("/access-denied");
  }

  return user;
}

/**
 * Redirects to `/login` if the user is not authenticated, or to
 * `/access-denied` if they lack the required permission.
 * Use at the top of Server Component page files.
 *
 * @returns The authenticated, authorized user (never returns if unauthorized).
 */
export async function enforceAuth(permission?: Permission): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (permission && !hasPermission(user.role, permission)) {
    redirect("/access-denied");
  }

  return user;
}

// ---------------------------------------------------------------------------
// Passive checks (return boolean — for conditional rendering in Server Components)
// ---------------------------------------------------------------------------

/**
 * Returns true if the current user has the specified permission.
 * Returns false if unauthenticated or lacking the permission.
 * Safe to use in Server Components for conditional UI rendering.
 */
export async function checkPermission(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return hasPermission(user.role, permission);
}

/**
 * Returns the current user's role, or null if unauthenticated.
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const user = await getCurrentUser();
  return user?.role ?? null;
}
