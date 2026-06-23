# CURRENT_PHASE.md

Current Phase:

PHASE_00C_INVOICE_RELATION_CORRECTION

Status:

COMPLETE

---

## Objectives

Correct the `Invoice` ↔ `SalesOrder` relationship to support the business rule:
**One SalesOrder may generate multiple Invoices.**

* Remove `@unique` from `Invoice.orderId` (keep the column and the relation)
* Add `@@index([orderId])` to `Invoice` (preserve FK lookup performance)
* Change `SalesOrder.invoice Invoice?` → `invoices Invoice[]`
* No other schema redesign — `Collection`, `LedgerEntry`, `DueReport`, `Dealer`, `Product`, `Project` untouched
* ADR-007 documents the One Order → Many Invoices decision
* Verified with `npx prisma format` + `npx prisma generate`
* Migration intentionally deferred; Orders module not built in this phase

---

## Schema Changes

| Model | Before | After |
|-------|--------|-------|
| Invoice | `orderId String @unique` | `orderId String` |
| Invoice | (implicit unique index) | `@@index([orderId])` |
| SalesOrder | `invoice Invoice?` | `invoices Invoice[]` |

---

## Completion Criteria

* `@unique` removed from `Invoice.orderId`, relation preserved: ✓
* `@@index([orderId])` added to `Invoice`: ✓
* `SalesOrder.invoices Invoice[]` one-to-many back-relation: ✓
* No other models modified: ✓
* ADR-007 created: ✓
* `npx prisma format` passes (relation valid): ✓
* `npx prisma generate` succeeds: ✓
* Schema supports One Order → Many Invoices: ✓
* No migration run, no Orders code built: ✓

---

## Next Phase

PHASE_04_SALES_ORDERS

---

---

# Previous Phases

---

# PHASE_03C_PRODUCT_FORMS

Status: COMPLETE

## Objectives

Build production-grade Create, Edit, and Deactivate workflows for the Product module.

* Shared `ProductForm` component (create + edit modes)
* `/products/new` — New Product page (Server Component + RBAC guard)
* `/products/[id]/edit` — Edit Product page (Server Component + RBAC guard)
* Soft-delete deactivation via `DeactivateProductDialog` (isActive = false)
* Live category select from database (no hardcoded options)
* Three-layer RBAC: middleware + server component guard + server action guard
* Enterprise UX: loading skeleton, error state, unsaved changes indicator, success feedback
* EN + BN localization — 60+ new translation keys
* TypeScript strict — 0 errors
* ESLint — 0 errors

---

## Deliverables

src/lib/actions/products/list-categories.ts (new) — listActiveCategories() server action

src/components/products/product-form-section.tsx (new) — Section card wrapper for form groups

src/components/products/product-form.tsx (new) — Shared ProductForm (create/edit modes, money input, toggle, category select)

src/components/products/deactivate-product-dialog.tsx (new) — Accessible modal for soft-delete confirmation

src/app/(dashboard)/products/new/page.tsx (new) — Server Component shell; enforces products:create

src/app/(dashboard)/products/new/page-client.tsx (new) — Client Component; translated page header + ProductForm

src/app/(dashboard)/products/[id]/edit/page.tsx (new) — Server Component shell; enforces products:edit; fetches product + categories

src/app/(dashboard)/products/[id]/edit/page-client.tsx (new) — Client Component; edit page rendering, deactivate trigger, error state

src/lib/actions/products/create-product.ts (updated) — requirePermission("products:create") guard added

src/lib/actions/products/update-product.ts (updated) — requirePermission("products:edit") guard added

src/components/products/product-table.tsx (updated) — Edit link column (canEdit-aware), useSession for role check

src/app/(dashboard)/products/page.tsx (updated) — New Product button (canCreate-aware)

middleware.ts (updated) — /products/new and /dealers/new added as more-specific routes

public/locales/en/common.json (updated) — products.form.*, products.deactivate.*, validation.* keys

public/locales/bn/common.json (updated) — Bengali translations for all new keys

docs/ADR/ADR-004-product-forms.md (new) — Architecture decisions documented

---

## RBAC Architecture

### Three-Layer Defense

| Layer | Location | Mechanism |
|-------|----------|-----------|
| Middleware | middleware.ts | `/products/new` → `products:create` prefix match |
| Server Component | page.tsx | `enforcePermission()` → redirects to /access-denied |
| Server Action | create-product.ts, update-product.ts | `requirePermission()` → returns INTERNAL_ERROR result |

### Role Access Matrix (Products)

| Role | View | Create | Edit | Deactivate |
|------|------|--------|------|------------|
| Super_Admin | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ✅ |
| Accounts | ✅ | ❌ | ❌ | ❌ |
| SR | ✅ | ❌ | ❌ | ❌ |

---

## Completion Criteria

* Create Product works (form, validation, success redirect): ✓
* Edit Product works (prefill, update, success redirect): ✓
* Deactivate sets isActive = false (soft-delete, no hard delete): ✓
* Deactivate confirmation dialog shown before action: ✓
* RBAC enforced — unauthorized users cannot reach create/edit pages: ✓
* Server actions reject unauthorized calls: ✓
* Category select uses live database data: ✓
* Unsaved changes indicator present: ✓
* Error states for load failure (edit page not found): ✓
* Success feedback with auto-redirect: ✓
* TypeScript strict — tsc --noEmit exits 0: ✓
* ESLint — 0 errors: ✓
* English + Bengali localization: ✓
* ADR-004 created: ✓

---

# PHASE_AUTH_02_RBAC

Status: COMPLETE

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

## Next Phase

PHASE_03C_PRODUCT_FORMS

---

# PHASE_AUTH_01_FOUNDATION

Status: COMPLETE

## Objectives

Implement production-grade authentication for Nazma ERP using Auth.js v5 (next-auth@beta).

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
