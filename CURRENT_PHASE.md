# CURRENT_PHASE.md

Current Phase:

PHASE_05A1_DELIVERY_CHALLAN_SCHEMA

Status:

COMPLETE

---

## Roadmap — Fulfillment & Invoicing

| Phase | Description | Status |
|-------|-------------|--------|
| PHASE_04A_ORDER_BACKEND | Sales Order backend | ✅ COMPLETE |
| PHASE_04B_ORDER_UI | Sales Order UI | ✅ COMPLETE |
| PHASE_04C_ORDER_COMBOBOX_DIAGNOSTICS | DealerCombobox fix | ✅ COMPLETE |
| PHASE_05A_DELIVERY_CHALLAN_BACKEND | Delivery Challan backend (validators, DTOs, workflow guards) | ✅ COMPLETE (foundation) |
| **PHASE_05A1_DELIVERY_CHALLAN_SCHEMA** | Delivery Challan Prisma schema + migration | **✅ COMPLETE** |
| PHASE_05A2_DELIVERY_CHALLAN_ACTIONS | Server actions, challan number generator, order integration | PLANNED |
| PHASE_05B_DELIVERY_CHALLAN_UI | Delivery Challan UI (create from order, list, detail, dispatch) | PLANNED |
| PHASE_05C_INVOICE_ENGINE | Invoice generation from challan (+ required InvoiceItem) | PLANNED |
| PHASE_05D_INVOICE_UI_PDF | Invoice UI, issue workflow, printable PDF | PLANNED |

---

# PHASE_05A1_DELIVERY_CHALLAN_SCHEMA

Status: COMPLETE

## Objectives

Apply the ADR-012 Delivery Challan schema to Prisma and migrate the database.
**Database only** — no server actions, UI, or invoice logic.

* `DeliveryChallanStatus` enum (Draft, Confirmed, Cancelled)
* `DeliveryChallan` model with logistics fields, audit FKs, indexes
* `DeliveryChallanItem` model with `Decimal(18,2)` quantity
* `SalesOrder.deliveryChallans` one-to-many back-relation
* `Invoice.deliveryChallanId` nullable one-to-one prep for PHASE_05C
* Also applied deferred migrations: `OrderStatus.Cancelled`, `Invoice.orderId` non-unique + index

### Out of Scope (this sub-phase)

* Server actions, DTO changes, validators, UI
* Invoice Engine, Collection, Ledger, Reporting
* Logistics field removal from `Invoice` (PHASE_05C)

### Completion Criteria

* Prisma schema updated per ADR-012: ✓
* `npx prisma format` + `npx prisma generate`: ✓
* Migration `add_delivery_challan` applied (Docker Postgres): ✓
* `npx tsc --noEmit` — 0 errors: ✓
* Governance docs updated: ✓

---

# PHASE_05A_DELIVERY_CHALLAN_BACKEND

Status: COMPLETE (foundation — validators, DTOs, workflow guards, ADR-012)

## Objectives

Build the Delivery Challan **backend foundation** — the non-financial fulfillment
layer between Sales Orders and Invoices. No UI, no Invoice engine.

* Propose `DeliveryChallan` + `DeliveryChallanItem` schema (documented in ADR-012)
* DTO layer — Challan Summary, Challan Detail, Challan Item, Order Fulfillment Progress
* Zod validators — create / confirm / list / identify
* Workflow guards — over-delivery prevention, order eligibility, completion detection
* Quantity reconciliation strategy — derived `deliveredQuantity` / `remainingQuantity`
* Order immutability guard — lines locked after first confirmed challan
* ADR-012 documents implementation decisions

### Out of Scope (foundation sub-phase)

* Server actions (`createChallan`, `confirmChallan`, etc.)
* Prisma schema changes / migrations (deferred to PHASE_05A1)
* Invoice Engine, UI, Collections, Ledger, Due Reports

### Completion Criteria (foundation)

* Schema additions proposed in ADR-012: ✓
* `src/types/delivery-challan.ts` created: ✓
* `src/lib/validators/delivery-challan.schema.ts` created: ✓
* `src/lib/delivery/workflow.ts` created: ✓
* ADR-012 created: ✓
* Governance docs updated: ✓

---

# PHASE_04C_ORDER_COMBOBOX_DIAGNOSTICS

Status: COMPLETE

---

## Objectives (PHASE_04C)

Fix the `DealerCombobox` on Create Order so dealers are visible and selectable,
and harden the transport / error boundary.

* Remove `overflow-hidden` from `OrderFormSection` (dropdown was clipped)
* Elevate Dealer & Project section stacking (`relative z-20`) so the list paints above the next card
* Wrap the `listDealers` call in `try/catch`
* Replace the `results` + `loading` pair with a `loading | ready | error` state machine
* Distinguish empty result vs transport / permission / session / stale-action failures
* Never coerce a failure into `[]`
* Render meaningful, localized error states with a Retry / Refresh action
* ADR-010 documents both defects and decisions

### Root Cause

1. **Visibility** — `OrderFormSection.overflow-hidden` clipped the absolutely positioned dropdown; rows existed in DOM/state but were not visible.
2. **Transport** — Stale Server Action references could throw; missing error handling masked failures as empty.

### Completion Criteria

* Section overflow no longer clips dealer dropdown: ✓
* Dealer section stacks above Order Items card when open: ✓
* `try/catch` around dealer loading: ✓
* Failure classes distinguished (empty / action / network / permission / session / stale): ✓
* Failures never collapse to `[]`: ✓
* Localized error UI + Retry/Refresh: ✓
* EN + BN keys added: ✓
* `npx tsc --noEmit` — 0 errors: ✓
* `npx eslint` — 0 errors (3 pre-existing warnings): ✓
* ADR-010 created: ✓
* Product Form (`product-form-section.tsx`) untouched: ✓
* No Invoice / Collection / Ledger work; schema unchanged: ✓

---

# PHASE_04B_ORDER_UI

Status: COMPLETE

## Objectives

Build the complete Sales Order **UI** on top of the existing backend. Reuse the
existing DTOs, validators, server actions, RBAC, and financial calculator — no
duplicated business logic.

* Order List `/orders` — search, status / dealer / date-range filters, sorting, pagination
* Create Order `/orders/new` — dealer selector, project (existing or inline), product line grid (add/remove rows, per-line price override)
* Live Financial Summary — Subtotal, Discount %, Discount Amount, Grand Total (server calculator, no client math)
* Order Detail `/orders/[id]` — order info, dealer, project, items, financial summary, approval status, audit timeline
* Edit Order `/orders/[id]/edit` — status-aware submit, workflow-respecting; approved orders editable by Manager / Super_Admin
* Approval UI — Approve / Reject / Cancel, visible only when state + role permit, calling existing actions
* Enterprise status badges (Draft, Pending_Approval, Approved, Rejected, Cancelled)
* Centralized RBAC (middleware + page guard + conditional rendering); no inline role checks
* EN + BN localization for all strings; loading / error / empty states; responsive; keyboard-friendly
* ADR-009 documents UI architecture, approval-workflow UX, pricing-override rationale

---

## UI-Support Backend (additive, no business logic duplicated)

| Piece | Purpose |
|-------|---------|
| `previewOrderTotals` action | Runs existing `calculateOrderTotals` for the live summary; converts order-level discount % → per-line amounts server-side |
| `listDealerProjects` action | Read-only list of a dealer's active projects for the "existing project" selector |
| `OrderSummaryDTO.createdByName` | Additive display field for the list's "Created By" column |

No schema changes. No tables/columns/indexes altered.

---

## RBAC (Orders UI)

| Action | Permission | Roles |
|--------|------------|-------|
| View / List | `orders:view` | All roles |
| Create | `orders:create` | SR, Manager, Super_Admin |
| Edit | `orders:edit` | Manager, Super_Admin |
| Approve / Reject | `orders:approve` | Manager, Super_Admin |
| Cancel | `orders:edit` | Manager, Super_Admin |

Middleware: `/orders/new → orders:create` added as a more-specific route.

---

## Completion Criteria

* Order List (search/filters/sort/pagination/badges): ✓
* Create Order (dealer, project existing+inline, line grid, price override): ✓
* Live Financial Summary via server calculator (no client math): ✓
* Order Detail (info/dealer/project/items/summary/approval/audit): ✓
* Edit Order (status-aware, workflow-respecting): ✓
* Approval UI (Approve/Reject/Cancel, role+state gated): ✓
* Centralized RBAC (middleware + page + render); no inline checks: ✓
* EN + BN localization; loading/error/empty states; responsive: ✓
* ADR-009 created: ✓
* `npx tsc --noEmit` — 0 errors: ✓
* `npx eslint` — 0 errors (3 pre-existing `useReactTable` warnings only): ✓
* No Invoice / Collection / Ledger built; schema unchanged: ✓

---

## Next Phase (superseded)

~~PHASE_05_INVOICE_ENGINE~~ — postponed. Fulfillment layer (ADR-011) requires
Delivery Challan backend + UI before Invoice Engine.

---

---

# Previous Phases

---

# PHASE_04A_ORDER_BACKEND

Status: COMPLETE

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

### Schema Changes

| Model | Before | After |
|-------|--------|-------|
| OrderStatus (enum) | Draft, Pending_Approval, Approved, Rejected, Delivered | + **Cancelled** (additive) |

Only an additive enum value was needed. No tables, columns, or indexes changed.

### RBAC (Orders)

| Action | Permission | Roles |
|--------|------------|-------|
| Create | `orders:create` | SR, Manager, Super_Admin |
| Update | `orders:edit` | Manager, Super_Admin |
| Approve | `orders:approve` | Manager, Super_Admin |
| Reject | `orders:approve` | Manager, Super_Admin |
| Cancel | `orders:edit` | Manager, Super_Admin |
| View / List | `orders:view` | All roles |

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
