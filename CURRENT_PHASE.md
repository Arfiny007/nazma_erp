# CURRENT_PHASE.md

Current Phase:

PHASE_04A_ORDER_BACKEND

Status:

COMPLETE

---

## Objectives

Build the complete Sales Order **backend** layer (no UI, no Invoice engine).

* Production-grade Zod validators — create / update / approve / reject / cancel / list / identify
* DTO layer — Order Summary, Order Detail, Order Item, Approval History
* Server actions — `createOrder`, `updateOrder`, `approveOrder`, `rejectOrder`, `cancelOrder`, `getOrder`, `getOrders` (`listOrders`)
* Transaction safety — order + items + totals created in a single Prisma transaction
* Decimal-safe financial calculation engine (no float math; VAT already in price → vat = 0.00)
* Order status workflow guards (Draft → Pending_Approval → Approved / Rejected / Cancelled)
* Approval audit via existing `createdById` / `approvedById` / `approvedAt` + `AuditLog`
* Inline project support (reference existing OR create inline)
* Search backend — order number, dealer, project, status, date range
* Index review (existing indexes sufficient; no new indexes added)
* Centralized RBAC on every mutating action; no inline role checks
* ADR-008 documents workflow / approval / multi-invoice / RBAC decisions

---

## Schema Changes

| Model | Before | After |
|-------|--------|-------|
| OrderStatus (enum) | Draft, Pending_Approval, Approved, Rejected, Delivered | + **Cancelled** (additive) |

Only an additive enum value was needed. No tables, columns, or indexes changed.

---

## Workflow

| Transition | Rule |
|-----------|------|
| Approve | Blocked from `Cancelled` (and no-op on `Approved`); Super_Admin may override a `Rejected` order |
| Reject | Blocked from `Approved` (cannot reject approved) |
| Cancel | Blocked when the order has ≥ 1 invoice (cannot cancel invoiced) |
| Edit | Allowed on `Approved` (Manager / Super_Admin); blocked only on `Cancelled` |

---

## RBAC (Orders)

| Action | Permission | Roles |
|--------|------------|-------|
| Create | `orders:create` | SR, Manager, Super_Admin |
| Update | `orders:edit` | Manager, Super_Admin |
| Approve | `orders:approve` | Manager, Super_Admin |
| Reject | `orders:approve` | Manager, Super_Admin |
| Cancel | `orders:edit` | Manager, Super_Admin |
| View / List | `orders:view` | All roles |

Matrix updated: **Manager** gained `orders:create` and `orders:edit`.

---

## Completion Criteria

* Order validators (create/update/approve/reject/cancel/list/identify): ✓
* DTO layer (Summary / Detail / Item / Approval History): ✓
* Server actions (create/update/approve/reject/cancel/get/list): ✓
* Order creation in a single transaction (order + items + totals): ✓
* Decimal-safe calculation engine; VAT = 0.00: ✓
* Status workflow guards (approve/reject/cancel rules): ✓
* Approval audit via existing fields + AuditLog: ✓
* Inline project support (existing or inline): ✓
* Search backend (number/dealer/project/status/date range): ✓
* Index review — no unnecessary schema changes: ✓
* RBAC enforced on all actions (centralized): ✓
* ADR-008 created: ✓
* `npx prisma generate` succeeds: ✓
* `npx tsc --noEmit` — 0 errors: ✓
* `npx eslint` — 0 errors: ✓
* No UI / Invoice / Collection / Ledger built: ✓

---

## Next Phase

PHASE_04B_ORDER_UI

---

---

# Previous Phases

---

# PHASE_00C_INVOICE_RELATION_CORRECTION

Status: COMPLETE

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

### Schema Changes

| Model | Before | After |
|-------|--------|-------|
| Invoice | `orderId String @unique` | `orderId String` |
| Invoice | (implicit unique index) | `@@index([orderId])` |
| SalesOrder | `invoice Invoice?` | `invoices Invoice[]` |

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
