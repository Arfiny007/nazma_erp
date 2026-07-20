import { auth } from "./auth";
import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import {
  isMustChangePasswordAllowedPath,
  isPublicAuthRoute,
} from "@/lib/auth/auth-routing";
import type { Permission } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";

// ---------------------------------------------------------------------------
// Public routes — no authentication required
// ---------------------------------------------------------------------------

function isPublicRoute(pathname: string): boolean {
  return isPublicAuthRoute(pathname);
}

// ---------------------------------------------------------------------------
// Route → required permission mapping
//
// Order matters: more specific prefixes should come before general ones.
// The access-denied page itself must NOT be in this list — it is always
// accessible to authenticated users regardless of role.
// ---------------------------------------------------------------------------

const ROUTE_PERMISSIONS: ReadonlyArray<{
  prefix: string;
  permission: Permission;
}> = [
  // More specific dealer routes must come before the general /dealers prefix
  { prefix: "/dashboard/audit", permission: "audit:view" },
  { prefix: "/dashboard", permission: "dashboard:view" },
  { prefix: "/dealers/new", permission: "dealers:create" },
  // More specific product routes must come before the general /products prefix
  { prefix: "/products/new", permission: "products:create" },
  // More specific order routes must come before the general /orders prefix
  { prefix: "/orders/new", permission: "orders:create" },
  { prefix: "/delivery-challans/new", permission: "orders:create" },
  { prefix: "/invoices/issue", permission: "invoices:create" },
  { prefix: "/dealers", permission: "dealers:view" },
  { prefix: "/products", permission: "products:view" },
  { prefix: "/projects", permission: "projects:view" },
  { prefix: "/orders", permission: "orders:view" },
  { prefix: "/delivery-challans", permission: "orders:view" },
  { prefix: "/invoices", permission: "invoices:view" },
  { prefix: "/collections", permission: "collections:view" },
  { prefix: "/ledger", permission: "ledger:view" },
  // More specific report routes before general /reports
  {
    prefix: "/reports/sr-performance",
    permission: "reports:sr-performance:view",
  },
  { prefix: "/reports", permission: "reports:view" },
  { prefix: "/audit", permission: "audit:view" },
  { prefix: "/settings/notifications", permission: "notifications:view" },
  { prefix: "/settings/users", permission: "users:view" },
  { prefix: "/settings", permission: "settings:view" },
];

/**
 * Returns the permission required for the given pathname, or null if no
 * specific permission is required (e.g. the dashboard at "/").
 */
function getRequiredPermission(pathname: string): Permission | null {
  const match = ROUTE_PERMISSIONS.find(({ prefix }) =>
    pathname.startsWith(prefix),
  );
  return match?.permission ?? null;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // 1. Always allow public routes
  if (isPublicRoute(pathname)) {
    // Redirect already-authenticated users away from login when password change not required
    if (
      pathname === "/login" &&
      session?.user &&
      !session.user.mustChangePassword
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // 2. Require authentication for all protected routes
  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Enforce mandatory password change — only change-password + logout allowed
  if (session.user.mustChangePassword) {
    if (!isMustChangePasswordAllowedPath(pathname)) {
      return NextResponse.redirect(new URL("/auth/change-password", req.url));
    }
    return NextResponse.next();
  }

  // 4. The access-denied page is accessible to any authenticated user
  if (pathname === "/access-denied") {
    return NextResponse.next();
  }

  // 5. Check route-level permission
  const requiredPermission = getRequiredPermission(pathname);
  if (requiredPermission) {
    const role = session.user.role as UserRole;
    if (!hasPermission(role, requiredPermission)) {
      return NextResponse.redirect(new URL("/access-denied", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and metadata files.
     * `branding/` and `locales/` must stay public so login/auth pages can
     * load the company logo and locale dictionaries without a session.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|branding|locales).*)",
  ],
};
