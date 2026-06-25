# IMPLEMENTATION STATUS

Last updated: 2026-06-25 (HOTFIX — OrderStatus enum migration)

---

## Hotfix — OrderStatus Enum Migration (2026-06-25)

| Criterion | Status |
|-----------|--------|
| Root cause identified — migration file present, DB not applied | ✅ |
| Migration `20250625110000_add_partially_delivered_status` applied (Docker) | ✅ |
| `prisma migrate status` — 3/3 migrations, schema up to date | ✅ |
| `prisma generate` — Prisma Client regenerated | ✅ |
| PostgreSQL `OrderStatus` includes `Partially_Delivered` | ✅ |
| Eligible-order query (`Approved` + `Partially_Delivered`) succeeds | ✅ |
| `/reports`, `/ledger` 404 — nav placeholders for unbuilt modules | ✅ (not a challan bug) |
| No new features; no Invoice Engine | ✅ |

### Cause

PHASE_05A2 added `Partially_Delivered` to `schema.prisma` and committed migration SQL, but `prisma migrate deploy` was not run against the Docker database after `20250625100000_add_delivery_challan`. Queries filtering by `Partially_Delivered` failed at the PostgreSQL enum layer.

### Files Modified — HOTFIX

```
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| PHASE_01_FOUNDATION | Project scaffold, layout, localization | ✅ COMPLETE |
| PHASE_02A_DEALER_BACKEND | Dealer domain: types, validators, CRUD | ✅ COMPLETE |
| PHASE_02B_DEALER_LIST_UI | Dealer list with table, search, pagination | ✅ COMPLETE |
| PHASE_02C_DEALER_FORMS | New/Edit dealer forms | ✅ COMPLETE |
| PHASE_03A_PRODUCT_BACKEND | Product domain: Category + Product models, CRUD | ✅ COMPLETE |
| PHASE_03A_REVIEW_PRODUCT_SEEDS | Product category seeds (12 categories, 20 products) | ✅ COMPLETE |
| PHASE_03B_PRODUCT_LIST_UI | Product list with table, search, pagination | ✅ COMPLETE |
| PHASE_03C_PRODUCT_FORMS | Product create/edit forms, deactivate workflow | ✅ COMPLETE |
| PHASE_00B_SCHEMA_HARDENING | Full Prisma schema with all domain models | ✅ COMPLETE |
| PHASE_AUTH_01_FOUNDATION | Auth.js v5 Credentials, login page, middleware, seed | ✅ COMPLETE |
| PHASE_AUTH_02_RBAC | Role-Based Access Control, permission matrix, guards, 403 page | ✅ COMPLETE |
| PHASE_00C_INVOICE_RELATION_CORRECTION | Invoice ↔ SalesOrder corrected to one-to-many | ✅ COMPLETE |
| PHASE_04A_ORDER_BACKEND | Sales Order backend: validators, DTOs, actions, calc engine, workflow, audit | ✅ COMPLETE |
| PHASE_04B_ORDER_UI | Sales Order UI: list, create/edit forms, detail, live summary, approval workflow | ✅ COMPLETE |
| PHASE_04C_ORDER_COMBOBOX_DIAGNOSTICS | DealerCombobox: transport error boundary + OrderFormSection overflow/stacking visibility fix | ✅ COMPLETE |
| PHASE_05A_DELIVERY_CHALLAN_BACKEND | Delivery Challan foundation: DTOs, validators, workflow guards, ADR-012 | ✅ COMPLETE |
| PHASE_05A1_DELIVERY_CHALLAN_SCHEMA | Delivery Challan Prisma models + migration | ✅ COMPLETE |
| PHASE_05A2_DELIVERY_CHALLAN_ACTIONS | Server actions, challan number generator, order integration, tests | ✅ COMPLETE |
| **PHASE_05B_DELIVERY_CHALLAN_UI** | Delivery Challan UI: list, create/edit, detail, fulfillment viz, workflow | **✅ COMPLETE** |

---

## Delivery Challan UI — Verification (PHASE_05B)

| Criterion | Status |
|-----------|--------|
| List: search / status / dealer / date filters | ✅ |
| List: sorting + pagination + status badges + Created By | ✅ |
| Create: eligible order picker (Approved / Partially_Delivered) | ✅ |
| Create: line grid with ordered / delivered / remaining / allocatable cap | ✅ |
| Create: live fulfillment summary sidebar | ✅ |
| Create: Save Draft + Confirm Dispatch | ✅ |
| Detail: header / dealer / order / logistics / items / audit | ✅ |
| Detail: per-line + order fulfillment progress bars | ✅ |
| Detail: Confirm / Cancel workflow (Draft only) | ✅ |
| Edit: Draft only; Confirmed redirects to detail | ✅ |
| Print support on detail page | ✅ |
| RBAC: middleware + page guard + conditional render (`orders:*`) | ✅ |
| EN + BN localization (`challan.*`) | ✅ |
| No Prisma schema change | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors (1 pre-existing useReactTable warning) | ✅ |
| ADR-013 created | ✅ |

### Files Created — PHASE_05B

```
src/lib/delivery/quantity-client.ts
src/lib/actions/delivery-challans/get-order-challan-context.ts
src/lib/actions/delivery-challans/get-challan-detail-lines.ts
src/components/delivery-challans/challan-table.tsx
src/components/delivery-challans/challan-form.tsx
src/components/delivery-challans/challan-detail-view.tsx
src/components/delivery-challans/challan-status-badge.tsx
src/components/delivery-challans/challan-empty-state.tsx
src/components/delivery-challans/challan-line-editor.tsx
src/components/delivery-challans/challan-fulfillment-summary.tsx
src/components/delivery-challans/fulfillment-progress-bar.tsx
src/components/delivery-challans/challan-workflow-actions.tsx
src/components/delivery-challans/challan-history-timeline.tsx
src/components/delivery-challans/eligible-order-combobox.tsx
src/app/(dashboard)/delivery-challans/page.tsx
src/app/(dashboard)/delivery-challans/new/page.tsx
src/app/(dashboard)/delivery-challans/new/page-client.tsx
src/app/(dashboard)/delivery-challans/[id]/page.tsx
src/app/(dashboard)/delivery-challans/[id]/page-client.tsx
src/app/(dashboard)/delivery-challans/[id]/edit/page.tsx
src/app/(dashboard)/delivery-challans/[id]/edit/page-client.tsx
docs/ADR/ADR-013-delivery-challan-ui.md
```

### Files Modified — PHASE_05B

```
src/types/delivery-challan.ts
src/lib/actions/delivery-challans/helpers.ts
src/lib/actions/delivery-challans/get-delivery-challan.ts
src/lib/actions/delivery-challans/create-delivery-challan.ts
src/lib/actions/delivery-challans/update-delivery-challan.ts
src/lib/actions/delivery-challans/confirm-delivery-challan.ts
src/lib/actions/delivery-challans/cancel-delivery-challan.ts
middleware.ts
src/lib/navigation.ts
public/locales/en/common.json
public/locales/bn/common.json
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Delivery Challan Actions — Verification (PHASE_05A2)

| Criterion | Status |
|-----------|--------|
| Six server actions with RBAC + transactions | ✅ |
| `CHL-NNNNNN` generator | ✅ |
| Workflow guards + quantity reconciliation (ADR-012) | ✅ |
| Order status sync (Partially_Delivered) | ✅ |
| Order integration (get / update / cancel) | ✅ |
| Audit events | ✅ |
| Non-financial boundary | ✅ |
| `npm test` — 9 pass | ✅ |

### Files Created — PHASE_05A2

```
src/lib/utils/challan-number.ts
src/lib/actions/delivery-challans/helpers.ts
src/lib/actions/delivery-challans/create-delivery-challan.ts
src/lib/actions/delivery-challans/update-delivery-challan.ts
src/lib/actions/delivery-challans/confirm-delivery-challan.ts
src/lib/actions/delivery-challans/cancel-delivery-challan.ts
src/lib/actions/delivery-challans/get-delivery-challan.ts
src/lib/actions/delivery-challans/list-delivery-challans.ts
src/lib/delivery/workflow.test.ts
vitest.config.ts
prisma/migrations/20250625110000_add_partially_delivered_status/migration.sql
```

---

## Delivery Challan Schema — Verification (PHASE_05A1)

| Criterion | Status |
|-----------|--------|
| `DeliveryChallanStatus` enum (Draft, Confirmed, Cancelled) | ✅ |
| `DeliveryChallan` model with all required fields + relations | ✅ |
| `DeliveryChallanItem` model with `Decimal(18,2)` quantity | ✅ |
| `SalesOrder.deliveryChallans` one-to-many back-relation | ✅ |
| `Invoice.deliveryChallanId` nullable one-to-one prep | ✅ |
| Deferred `OrderStatus.Cancelled` enum value applied | ✅ |
| Deferred `Invoice.orderId` non-unique + `@@index([orderId])` applied | ✅ |
| Indexes on challan header + line items per ADR-012 | ✅ |
| `npx prisma format` — succeeds | ✅ |
| `npx prisma generate` — succeeds | ✅ |
| Migration `20250625100000_add_delivery_challan` applied (Docker) | ✅ |
| `prisma migrate status` — database schema up to date | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| No server actions / UI / invoice logic added | ✅ |

### Schema Changes — PHASE_05A1

| Model / Enum | Change |
|--------------|--------|
| `DeliveryChallanStatus` (enum) | **New** — Draft, Confirmed, Cancelled |
| `DeliveryChallan` | **New** — logistics document with `challanNo`, `orderId`, `dealerCode`, `status`, `deliveryMode`, `vehicleNo`, `driverName`, `remarks`, `dispatchedAt`, `createdById`, `confirmedById` |
| `DeliveryChallanItem` | **New** — `challanId`, `orderItemId`, `productId`, `quantity Decimal(18,2)` |
| `SalesOrder` | + `deliveryChallans DeliveryChallan[]` |
| `Invoice` | + `deliveryChallanId String? @unique`, + `deliveryChallan` relation |
| `OrderStatus` | + `Cancelled` (deferred from PHASE_04A) |
| `Invoice.orderId` | `@unique` removed, `@@index([orderId])` added (deferred from PHASE_00C) |
| `User` | + `challansCreated`, `challansConfirmed` relations |
| `Dealer` | + `deliveryChallans` relation |
| `SalesOrderItem` | + `deliveryChallanItems` relation |
| `Product` | + `deliveryChallanItems` relation |

### Files Modified — PHASE_05A1

```
prisma/schema.prisma
prisma/migrations/20250625000000_init/migration.sql
prisma/migrations/20250625100000_add_delivery_challan/migration.sql
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## DealerCombobox — Verification

| Criterion | Status |
|-----------|--------|
| Dropdown visible on `/orders/new` (not clipped by section) | ✅ |
| Dealer rows selectable after open | ✅ |
| Dealer section paints above Order Items card (`z-20`) | ✅ |
| `try/catch` around dealer loading | ✅ |
| Distinguishes empty / action / network / permission / session / stale | ✅ |
| Failures never silently coerced to `[]` | ✅ |
| Localized error UI + Retry / Refresh | ✅ |
| Empty / error / stale states work | ✅ |
| EN + BN localization | ✅ |
| Product Form sections untouched (`product-form-section.tsx`) | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors (3 pre-existing warnings) | ✅ |
| ADR-010 created | ✅ |
| No Invoice / Collection / Ledger built; schema unchanged | ✅ |

---

## Order UI Module — Verification

| Criterion | Status |
|-----------|--------|
| Order List: search / status / dealer / date-range filters | ✅ |
| Order List: sorting + pagination + status badges + Created By | ✅ |
| Create Order: dealer selector, project (existing + inline) | ✅ |
| Create Order: product grid (Product/SKU/Category/Qty/Unit Price/Line Total) | ✅ |
| Create Order: add / remove rows; per-line price override | ✅ |
| Live Financial Summary (Subtotal / Discount % / Discount Amt / Grand Total) | ✅ |
| Live summary uses server calculator — no duplicated client math | ✅ |
| Order Detail: info / dealer / project / items / summary / approval / audit | ✅ |
| Edit Order: status-aware, workflow-respecting | ✅ |
| Approved orders editable only by Manager / Super_Admin | ✅ |
| Approval UI (Approve / Reject / Cancel) shown only when allowed | ✅ |
| VAT not shown, not calculated | ✅ |
| Centralized RBAC (middleware + page guard + render); no inline checks | ✅ |
| EN + BN localization; loading / error / empty states; responsive | ✅ |
| No schema change | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors (3 pre-existing useReactTable warnings) | ✅ |
| ADR-009 created | ✅ |
| No Invoice / Collection / Ledger built | ✅ |

### Files Created — PHASE_04B_ORDER_UI

```
src/lib/actions/orders/preview-order-totals.ts
src/lib/actions/orders/list-dealer-projects.ts
src/components/orders/order-status-badge.tsx
src/components/orders/order-empty-state.tsx
src/components/orders/order-form-section.tsx
src/components/orders/dealer-combobox.tsx
src/components/orders/product-line-editor.tsx
src/components/orders/order-financial-summary.tsx
src/components/orders/order-form.tsx
src/components/orders/approval-actions.tsx
src/components/orders/order-history-timeline.tsx
src/components/orders/order-detail-view.tsx
src/components/orders/order-table.tsx
src/app/(dashboard)/orders/page.tsx
src/app/(dashboard)/orders/new/page.tsx
src/app/(dashboard)/orders/new/page-client.tsx
src/app/(dashboard)/orders/[id]/page.tsx
src/app/(dashboard)/orders/[id]/page-client.tsx
src/app/(dashboard)/orders/[id]/edit/page.tsx
src/app/(dashboard)/orders/[id]/edit/page-client.tsx
docs/ADR/ADR-009-order-ui.md
```

### Files Modified — PHASE_04B_ORDER_UI

```
src/types/order.ts                       (createdByName, preview DTOs)
src/lib/actions/orders/helpers.ts        (include createdBy; populate createdByName)
src/lib/validators/order.schema.ts       (previewOrderTotalsSchema, dealerProjectsSchema)
middleware.ts                            (/orders/new → orders:create)
public/locales/en/common.json            (Order UI keys)
public/locales/bn/common.json            (Order UI keys)
```

---

## Order Backend Module — Verification

| Criterion | Status |
|-----------|--------|
| Order validators (create/update/approve/reject/cancel/list/identify) | ✅ |
| DTO layer (Summary / Detail / Item / Approval History) | ✅ |
| Server actions (create/update/approve/reject/cancel/get/list) | ✅ |
| Order creation in a single Prisma transaction (order + items + totals) | ✅ |
| Decimal-safe calculation engine; no float math | ✅ |
| VAT not calculated (already in price) → vat = 0.00 | ✅ |
| Workflow: cannot approve cancelled order | ✅ |
| Workflow: cannot reject approved order | ✅ |
| Workflow: cannot cancel invoiced order | ✅ |
| Approved orders editable (Manager / Super_Admin) | ✅ |
| Approval audit via createdById / approvedById / approvedAt + AuditLog | ✅ |
| Inline project support (existing OR inline) | ✅ |
| Search backend (order no / dealer / project / status / date range) | ✅ |
| Index review — existing indexes sufficient, none added | ✅ |
| Only additive schema change (OrderStatus + Cancelled) | ✅ |
| RBAC enforced on all actions (centralized, no inline checks) | ✅ |
| Manager granted orders:create + orders:edit | ✅ |
| `npx prisma generate` succeeds | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors | ✅ |
| ADR-008 created | ✅ |
| No UI / Invoice / Collection / Ledger built | ✅ |

### Files Created — PHASE_04A_ORDER_BACKEND

```
src/types/order.ts
src/lib/validators/order.schema.ts
src/lib/utils/order-calculator.ts
src/lib/utils/order-number.ts
src/lib/utils/project-code.ts
src/lib/orders/workflow.ts
src/lib/actions/orders/helpers.ts
src/lib/actions/orders/create-order.ts
src/lib/actions/orders/update-order.ts
src/lib/actions/orders/approve-order.ts
src/lib/actions/orders/reject-order.ts
src/lib/actions/orders/cancel-order.ts
src/lib/actions/orders/get-order.ts
src/lib/actions/orders/list-orders.ts
docs/ADR/ADR-008-order-backend.md
```

### Files Modified — PHASE_04A_ORDER_BACKEND

```
prisma/schema.prisma          (OrderStatus + Cancelled)
src/lib/permissions.ts        (Manager: orders:create, orders:edit)
CURRENT_PHASE.md
CHANGELOG.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
```

---

## Invoice Relation Correction — Verification

| Criterion | Status |
|-----------|--------|
| `@unique` removed from `Invoice.orderId` (column + relation preserved) | ✅ |
| `@@index([orderId])` added to `Invoice` | ✅ |
| `SalesOrder.invoices Invoice[]` one-to-many back-relation | ✅ |
| `Collection` / `LedgerEntry` / `DueReport` / `Dealer` / `Product` / `Project` untouched | ✅ |
| `npx prisma format` — relation valid | ✅ |
| `npx prisma generate` — succeeds | ✅ |
| Schema supports One Order → Many Invoices | ✅ |
| ADR-007 created | ✅ |
| No migration run, no Orders code built | ✅ |

### Files Modified — PHASE_00C_INVOICE_RELATION_CORRECTION

```
prisma/schema.prisma
docs/ADR/ADR-007-order-multi-invoice.md (new)
CURRENT_PHASE.md
CHANGELOG.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
```

---

## Product Forms Module — Verification

| Criterion | Status |
|-----------|--------|
| Create Product page at /products/new | ✅ |
| Edit Product page at /products/[id]/edit | ✅ |
| Category select populated from live database | ✅ |
| Deactivate (soft-delete) with confirmation dialog | ✅ |
| Form prefill on edit mode | ✅ |
| Success feedback + auto-redirect to /products | ✅ |
| Unsaved changes indicator | ✅ |
| Error state for product not found (edit) | ✅ |
| RBAC: enforcePermission in server component pages | ✅ |
| RBAC: requirePermission in server actions | ✅ |
| RBAC: role-aware New Product button | ✅ |
| RBAC: role-aware Edit links in product table | ✅ |
| Middleware: /products/new → products:create | ✅ |
| Money input (Decimal-safe, no floating-point) | ✅ |
| EN + BN translations (60+ keys) | ✅ |
| TypeScript strict — tsc --noEmit exits 0 | ✅ |
| ESLint — 0 errors | ✅ |
| ADR-004 created | ✅ |

---

## Files Created — PHASE_03C_PRODUCT_FORMS

```
src/lib/actions/products/list-categories.ts
src/components/products/product-form-section.tsx
src/components/products/product-form.tsx
src/components/products/deactivate-product-dialog.tsx
src/app/(dashboard)/products/new/page.tsx
src/app/(dashboard)/products/new/page-client.tsx
src/app/(dashboard)/products/[id]/edit/page.tsx
src/app/(dashboard)/products/[id]/edit/page-client.tsx
docs/ADR/ADR-004-product-forms.md
```

## Files Modified — PHASE_03C_PRODUCT_FORMS

```
src/lib/actions/products/create-product.ts
src/lib/actions/products/update-product.ts
src/components/products/product-table.tsx
src/app/(dashboard)/products/page.tsx
middleware.ts
public/locales/en/common.json
public/locales/bn/common.json
CURRENT_PHASE.md
CHANGELOG.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
```

---

## RBAC Module — Verification

| Criterion | Status |
|-----------|--------|
| Permission matrix centralized in permissions.ts | ✅ |
| Granular permissions (view/create/edit/delete/approve per resource) | ✅ |
| ROLE_PERMISSIONS correct for all 4 roles per matrix | ✅ |
| canView / canCreate / canEdit / canDelete / canApprove helpers | ✅ |
| requirePermission() for server actions (throws ForbiddenError) | ✅ |
| enforcePermission() for server components (redirects) | ✅ |
| checkPermission() for passive boolean checks | ✅ |
| Middleware protects 11 route prefixes with permission checks | ✅ |
| Unauthorized routes redirect to /access-denied | ✅ |
| 403 Access Denied page — bilingual, responsive, shows user role | ✅ |
| Dashboard layout reads real session, passes actual userRole | ✅ |
| Sidebar filters nav items by role (was already wired, now gets real role) | ✅ |
| MobileNav filters nav items by role (same) | ✅ |
| Audit-ready: PermissionCheckContext with checkedAt field | ✅ |
| TypeScript strict — tsc --noEmit exits 0 | ✅ |
| ESLint — 0 errors on RBAC files | ✅ |
| English + Bengali localization for rbac.* keys | ✅ |

---

## Files Created — PHASE_AUTH_02_RBAC

```
src/lib/rbac/index.ts
src/lib/rbac/guards.ts
src/app/(dashboard)/access-denied/page.tsx
```

## Files Modified — PHASE_AUTH_02_RBAC

```
src/lib/permissions.ts
src/lib/auth/helpers.ts
middleware.ts
src/app/(dashboard)/layout.tsx
public/locales/en/common.json
public/locales/bn/common.json
CURRENT_PHASE.md
CHANGELOG.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
```

---

## Authentication Module — Verification

| Criterion | Status |
|-----------|--------|
| Login page exists at /login | ✅ |
| Email + password validation (Zod) | ✅ |
| bcrypt password hashing (12 rounds) | ✅ |
| JWT session strategy | ✅ |
| Middleware protects / /dealers /products routes | ✅ |
| Unauthenticated users redirected to /login | ✅ |
| Authenticated users redirected away from /login | ✅ |
| Inactive users (isActive=false) cannot login | ✅ |
| Super Admin seed (admin@nazma.local) | ✅ |
| Auth helpers (getSession, getCurrentUser, getCurrentRole) | ✅ |
| requireUser / requireRole for protected actions | ✅ |
| TypeScript strict — tsc --noEmit exits 0 | ✅ |
| ESLint — 0 errors on auth files | ✅ |
| English + Bengali translation keys | ✅ |

---

## Files Created — PHASE_AUTH_01_FOUNDATION

```
auth.ts
middleware.ts
src/types/auth.ts
src/types/next-auth.d.ts
src/lib/auth/helpers.ts
src/lib/actions/auth/login.ts
src/app/(auth)/layout.tsx
src/app/(auth)/login/page.tsx
src/app/api/auth/[...nextauth]/route.ts
src/components/auth/login-form.tsx
src/components/providers/session-provider.tsx
prisma/seeds/admin-user.ts
```

## Files Modified — PHASE_AUTH_01_FOUNDATION

```
prisma/seed.ts
src/app/layout.tsx
public/locales/en/common.json
public/locales/bn/common.json
.env (AUTH_SECRET added)
package.json (next-auth, bcryptjs, @auth/prisma-adapter added)
```

---

## Delivery Challan Backend — Foundation (PHASE_05A)

| Criterion | Status |
|-----------|--------|
| Schema additions proposed (`DeliveryChallan`, `DeliveryChallanItem`, `DeliveryChallanStatus`) | ✅ |
| DTOs + error codes + `ActionResult` envelope | ✅ |
| Zod validators (create / confirm / list / identify / list-for-order) | ✅ |
| Workflow guards (over-delivery, order eligibility, completion detection) | ✅ |
| Quantity strategy — split `remainingQty` (display) vs `allocatableQty` (validation) | ✅ |
| Order immutability — Confirmed challans only (ADR-012 review) | ✅ |
| ADR-012 created | ✅ |
| Server actions deferred | ⏳ |
| Prisma migration applied (PHASE_05A1) | ✅ |
| `workflow.ts` alignment to amended ADR (split qty + confirmed-only lock) | ⏳ |
| No UI / Invoice / Collection / Ledger | ✅ |

### Files Created — PHASE_05A_DELIVERY_CHALLAN_BACKEND

```
src/types/delivery-challan.ts
src/lib/validators/delivery-challan.schema.ts
src/lib/delivery/workflow.ts
docs/ADR/ADR-012-delivery-challan-backend.md
```

### Files Modified — PHASE_05A_DELIVERY_CHALLAN_BACKEND

```
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Fulfillment Layer — Architecture Approved (ADR-011)

| Decision | Status |
|----------|--------|
| Workflow: Order → Delivery Challan → Invoice → Collection → Ledger → Due | ✅ Approved |
| Delivery Challan is NON-FINANCIAL (no balance / ledger / due / collection impact) | ✅ Approved |
| Invoice is FINANCIAL (credit exposure, ledger, balance, due) | ✅ Approved |
| One Sales Order → many Delivery Challans (partial delivery) | ✅ Approved |
| One Delivery Challan → exactly one Invoice | ✅ Approved |
| Invoice quantities sourced from Delivery Challan (not order directly) | ✅ Approved |
| InvoiceItem required on every invoice (no header-only invoices) | ✅ Approved |
| Logistics fields (`vehicleNo`, `driverName`, `deliveryMode`) owned by Delivery Challan | ✅ Approved |
| Credit limit checked at Invoice issue, not at challan dispatch | ✅ Approved |
| Revenue recognized at Invoice issue, not at order approval or challan dispatch | ✅ Approved |
| Order immutability after first confirmed challan | ✅ Approved |
| Invoice Engine postponed until Delivery Challan layer exists | ✅ Approved |
| ADR-011 created | ✅ |

### Approved Phase Sequence

| Phase | Description | Status |
|-------|-------------|--------|
| PHASE_05A_DELIVERY_CHALLAN_BACKEND | Challan validators, DTOs, workflow guards, schema design | **COMPLETE** |
| PHASE_05A1_DELIVERY_CHALLAN_SCHEMA | Prisma models + migration | **COMPLETE** |
| PHASE_05A2_DELIVERY_CHALLAN_ACTIONS | Server actions, challan number generator, order integration | **COMPLETE** |
| PHASE_05B_DELIVERY_CHALLAN_UI | Create challan from order, list, detail, dispatch workflow | **COMPLETE** |
| PHASE_05C_INVOICE_ENGINE | Invoice from challan + mandatory InvoiceItem | PLANNED |
| PHASE_05D_INVOICE_UI_PDF | Invoice UI, issue workflow, PDF | PLANNED |

---

## Upcoming Phases

| Phase | Description |
|-------|-------------|
| PHASE_05C_INVOICE_ENGINE | Invoice generation from challan |
| PHASE_05D_INVOICE_UI_PDF | Invoice UI + PDF |
| PHASE_06_COLLECTIONS | Payment collections |
| PHASE_07_LEDGER | Financial ledger |
| PHASE_08_DUE_REPORTS | Overdue reporting |
| PHASE_09_AUDIT_LOGS | Audit trail |
| PHASE_10_USER_MANAGEMENT | User CRUD (Super_Admin only) |
