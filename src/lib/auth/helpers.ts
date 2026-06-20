import { auth } from "../../../auth";
import type { UserRole } from "@prisma/client";
import type { AuthUser, AuthSession } from "@/types/auth";
import type { Permission } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";

/**
 * Returns the current authenticated session.
 * Returns null when called from an unauthenticated context.
 */
export async function getSession(): Promise<AuthSession | null> {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return session as AuthSession;
}

/**
 * Returns the current authenticated user.
 * Returns null when no session exists.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Returns the current user's role.
 * Returns null when no session exists.
 */
export async function getCurrentRole(): Promise<UserRole | null> {
  const user = await getCurrentUser();
  return user?.role ?? null;
}

/**
 * Asserts that a session exists and returns the authenticated user.
 * Throws when called without a valid session (use in protected server actions).
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized: authentication required");
  }

  return user;
}

/**
 * Asserts that the current user has one of the specified roles.
 * Throws when the user is missing or lacks the required role.
 */
export async function requireRole(...roles: UserRole[]): Promise<AuthUser> {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    throw new Error(`Forbidden: required role(s): ${roles.join(", ")}`);
  }

  return user;
}

/**
 * Asserts that the current user has the specified permission.
 * Throws when the user is missing or lacks the required permission.
 *
 * Delegates to the centralized RBAC layer.
 * Prefer `requirePermission` from `@/lib/rbac/guards` in new server actions
 * for richer error types (ForbiddenError with permission + role metadata).
 */
export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await requireUser();

  if (!hasPermission(user.role, permission)) {
    throw new Error(`Forbidden: required permission: ${permission}`);
  }

  return user;
}
