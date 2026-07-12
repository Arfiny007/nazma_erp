/**
 * Post-login redirect resolver — extracted for testability (PHASE_10C).
 */
export function resolvePostLoginRedirect(mustChangePassword: boolean): string {
  return mustChangePassword ? "/auth/change-password" : "/";
}

/**
 * Routes accessible when mustChangePassword is enforced.
 */
export const MUST_CHANGE_PASSWORD_ALLOWED_PREFIXES = [
  "/auth/change-password",
  "/api/auth",
] as const;

export function isMustChangePasswordAllowedPath(pathname: string): boolean {
  return MUST_CHANGE_PASSWORD_ALLOWED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

/**
 * Public auth routes that do not require a session.
 */
export const PUBLIC_AUTH_ROUTES = [
  "/login",
  "/auth/activate",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/api/auth",
] as const;

export function isPublicAuthRoute(pathname: string): boolean {
  return PUBLIC_AUTH_ROUTES.some((route) => pathname.startsWith(route));
}
