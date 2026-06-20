# CURRENT_PHASE.md

Current Phase:

PHASE_AUTH_02_RBAC

Status:

COMPLETE

---

## Objectives

Implement production-grade Role Based Access Control for Nazma ERP.

* Centralized permission matrix (Resource × Action × Role)
* Composable permission helpers: canView, canCreate, canEdit, canDelete, canApprove
* Server action guards: requirePermission, requireAllPermissions, requireAnyPermission
* Server component guards: enforcePermission, enforceAuth
* Middleware route protection with permission-based redirects to /access-denied
* Sidebar and MobileNav are role-aware (already consuming hasPermission via NAV_SECTIONS)
* Dashboard layout reads real session and passes userRole to DashboardShell
* 403 Access Denied page — responsive, bilingual (EN/BN), role-aware
* Localization keys added: rbac.* in both locales
* Strict TypeScript — 0 errors
* ESLint — 0 errors

---

## Deliverables

src/lib/permissions.ts (updated) — Full permission matrix, granular CRUD permissions, Resource/Action/Permission types, ROLE_PERMISSIONS record, hasPermission(), getPermissionsForRole()

src/lib/rbac/index.ts (new) — canView(), canCreate(), canEdit(), canDelete(), canApprove(), canWrite(), getCapabilities(), buildPermissionContext(), ResourceCapabilities, PermissionCheckContext

src/lib/rbac/guards.ts (new) — ForbiddenError, UnauthorizedError, requirePermission(), requireAllPermissions(), requireAnyPermission(), enforcePermission(), enforceAuth(), checkPermission(), getCurrentUserRole()

src/lib/auth/helpers.ts (updated) — requirePermission() added (wraps RBAC layer); existing requireUser() / requireRole() unchanged

middleware.ts (updated) — ROUTE_PERMISSIONS map, getRequiredPermission(), permission-based redirect to /access-denied for unauthorized routes

src/app/(dashboard)/layout.tsx (updated) — Reads getCurrentUser() and passes real userRole to DashboardShell

src/app/(dashboard)/access-denied/page.tsx (new) — 403 page, responsive, bilingual, shows user's current role

public/locales/en/common.json (updated) — rbac.* translation keys
public/locales/bn/common.json (updated) — rbac.* Bengali translation keys

---

## Permission Matrix Implemented

| Resource    | Super_Admin | Manager     | Accounts    | SR          |
|-------------|-------------|-------------|-------------|-------------|
| Dealers     | Full        | Full        | Read        | Create/Edit |
| Products    | Full        | Full        | Read        | Read        |
| Projects    | Full        | Full        | Read        | Create/Edit |
| Orders      | Full        | Approve     | Read        | Create      |
| Invoices    | Full        | Read        | Full        | Read        |
| Collections | Full        | Read        | Full        | Read        |
| Ledger      | Full        | Read        | Full        | Read        |
| Due Reports | Full        | Read        | Full        | Read        |
| Audit Logs  | Yes         | No          | No          | No          |
| Users       | Yes         | No          | No          | No          |
| Settings    | Yes         | No          | No          | No          |

---

## Architecture

### Permission Layer (src/lib/permissions.ts)
- Single source of truth for all role→permission assignments
- No permission logic exists outside this file
- `hasPermission(role, permission)` — edge-runtime safe, pure object lookup
- Used by: middleware, sidebar, mobile-nav, rbac guards

### RBAC Helpers (src/lib/rbac/index.ts)
- Resource-oriented: `canView(role, resource)` — no magic strings at call sites
- `getCapabilities(role, resource)` — returns all 5 capability booleans at once
- `buildPermissionContext()` — audit-ready, emits full context for future AuditLog

### Guards (src/lib/rbac/guards.ts)
- **Server Actions** — `requirePermission()`, throws ForbiddenError (structured, catchable)
- **Server Components** — `enforcePermission()`, redirects to /access-denied
- **Passive checks** — `checkPermission()`, returns boolean for conditional rendering

### Sidebar / MobileNav
- Already consume `hasPermission(userRole, item.permission)` from NAV_SECTIONS
- `userRole` now flows from a real session (dashboard layout reads getCurrentUser())

### Middleware
- Route → permission mapping in ROUTE_PERMISSIONS array
- Unauthenticated → redirect /login
- Authenticated but no permission → redirect /access-denied
- access-denied page always accessible to authenticated users

---

## Implementation Notes

* `import type { UserRole }` used in permissions.ts — no Prisma runtime in permission layer
* ForbiddenError carries `.permission` and `.userRole` metadata for future logging
* PermissionCheckContext has `checkedAt` field ready for AuditLog integration
* DashboardShell defaults to "SR" (most restrictive) as defensive fallback
* No changes to dealer or product server actions (not required)
* NAV_SECTIONS already has `projects`, `orders`, `invoices`, `collections`, `ledger`, `reports`, `audit`, `users`, `settings` entries
* Sidebar filtering is fully working as it was wired in Phase AUTH_01

---

## Completion Criteria

* Roles are centralized: ✓
* Permissions are centralized: ✓
* Sidebar is role-aware: ✓
* Unauthorized access is blocked: ✓ (middleware + page guards)
* Access denied page exists: ✓
* TypeScript passes: ✓ (tsc --noEmit exits 0)
* ESLint passes: ✓ (0 errors)
* Governance files updated: ✓

---

## Next Phase

PHASE_03C_PRODUCT_FORMS

---

---

# Previous Phases

---

# PHASE_AUTH_01_FOUNDATION

Status: COMPLETE

## Objectives

Implement production-grade authentication for Nazma ERP using Auth.js v5 (next-auth@beta).

* Credentials-based login (email + password)
* bcrypt password hashing
* JWT session management
* Middleware route protection (dashboard, dealers, products)
* Super Admin seed (admin@nazma.local / Admin123!)
* Inactive user blocking (isActive check)
* Reusable auth helpers for future RBAC phase
* Strict TypeScript, Zod validation, no any

---

## Deliverables

auth.ts (project root) — Auth.js v5 NextAuth configuration

middleware.ts (project root) — JWT-based route protection

src/types/auth.ts — AuthUser, AuthSession type definitions

src/types/next-auth.d.ts — Module augmentation for Session, User, JWT

src/lib/auth/helpers.ts — getSession, getCurrentUser, getCurrentRole, requireUser, requireRole

src/lib/actions/auth/login.ts — loginAction server action (Zod + signIn)

src/app/(auth)/layout.tsx — Auth shell layout (no sidebar)

src/app/(auth)/login/page.tsx — Login page (Server Component)

src/components/auth/login-form.tsx — Login form (Client Component, RHF + Zod)

src/components/providers/session-provider.tsx — NextAuth SessionProvider wrapper

src/app/api/auth/[...nextauth]/route.ts — Auth.js route handler

prisma/seeds/admin-user.ts — Idempotent Super Admin seed (bcrypt hashed)

prisma/seed.ts (updated) — Includes admin user seed

src/app/layout.tsx (updated) — Wraps app with SessionProvider

public/locales/en/common.json (updated) — auth.* translation keys

public/locales/bn/common.json (updated) — auth.* translation keys (Bengali)

---

## Next Phase

PHASE_AUTH_02_RBAC

---

# PHASE_03B_PRODUCT_LIST_UI

Status: COMPLETE

## Objectives

Create a read-only Product List module matching the visual quality and UX pattern of the Dealer List module.

## Deliverables

src/app/(dashboard)/products/page.tsx

src/components/products/product-table.tsx

src/components/products/product-search.tsx

src/components/products/product-status-badge.tsx

src/components/products/product-empty-state.tsx

public/locales/en/common.json (product translation keys)

public/locales/bn/common.json (product translation keys)

## Next Phase

PHASE_03C_PRODUCT_FORMS
