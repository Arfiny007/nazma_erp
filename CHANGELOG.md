# CHANGELOG

All notable changes to Nazma ERP are documented here.

---

## [ADR-012_ARCHITECTURE_REVIEW] — 2026-06-25

### Changed (ADR-012 amended)

- **Quantity semantics split** — `remainingQty` (display) = `ordered − confirmed` only; `allocatableQty` (validation) = `ordered − confirmed − draft`. Draft does not count as delivered.
- **Order immutability refined** — line/header edits blocked after first **Confirmed** challan, not Draft. Amends ADR-011 §10 interpretation.
- **Fulfillment Progress DTO** — documented `OrderLineFulfillmentProgressDTO` and `OrderFulfillmentProgressDTO` with `deliveryPercent` (quantity-weighted at order level).
- **Invoice eligibility** — Draft → no invoice; Confirmed → eligible once; Cancelled → never.

### Scope

Architecture review only. No code, schema, or migration changes.

---

## [PHASE_05A_DELIVERY_CHALLAN_BACKEND] — 2026-06-25

### Added

- **Delivery Challan domain types** — `src/types/delivery-challan.ts`: `DeliveryChallanSummaryDTO`, `DeliveryChallanDetailDTO`, `DeliveryChallanItemDTO`, `OrderFulfillmentProgressDTO`, `OrderLineFulfillmentDTO`, error codes, `ActionResult<T>` envelope
- **Delivery Challan validators** — `src/lib/validators/delivery-challan.schema.ts`: `createDeliveryChallanSchema`, `confirmDeliveryChallanSchema`, `listDeliveryChallansSchema`, `deliveryChallanIdentifierSchema`, `listChallansForOrderSchema`
- **Delivery workflow guards** — `src/lib/delivery/workflow.ts`: `assertCanCreateChallan`, `assertNotOverDelivery`, `assertCanConfirmChallan`, `assertOrderLinesMutable`, `computeRemainingQuantity`, `isOrderFullyDelivered`, `isOrderPartiallyDelivered`, `resolveOrderStatusAfterDelivery`
- **ADR-012** — `docs/ADR/ADR-012-delivery-challan-backend.md`: proposed schema, quantity reconciliation strategy, over-delivery prevention, order completion detection, risks

### Architecture Notes

- **Derived quantities** — `orderedQuantity` from `SalesOrderItem`; `deliveredQuantity` summed from Confirmed challan lines; `remainingQuantity` computed at read time (never stored)
- **Draft challans** lock order line edits; only Confirmed quantities count toward delivery progress
- **Non-financial boundary** — delivery module has no ledger/balance/due/collection imports
- **Schema proposed, not migrated** — `DeliveryChallan`, `DeliveryChallanItem`, `DeliveryChallanStatus` documented in ADR-012; Prisma unchanged in this sub-phase
- **Server actions deferred** — `createChallan`, `confirmChallan`, etc. are the next sub-phase

### Scope

Backend foundation only. No UI, no Invoice engine, no migrations, no Prisma model changes.

---

## [ADR-011_FULFILLMENT_LAYER] — 2026-06-25

### Architecture Milestone: Fulfillment Layer Introduced

The commercial pipeline has been restructured. The direct **Order → Invoice**
path is superseded by a three-layer model:

```
Sales Order  →  Delivery Challan  →  Invoice  →  Collection  →  Ledger  →  Due Report
                 (NON-FINANCIAL)      (FINANCIAL)
```

### Key Decisions (ADR-011)

- **Partial delivery** — one Sales Order may generate multiple Delivery Challans.
- **One Challan → One Invoice** — each confirmed challan produces exactly one invoice.
- **InvoiceItem required** — every invoice must have line items; header-only invoices forbidden.
- **Quantity source** — invoice quantities come from Delivery Challan, not directly from the order.
- **Non-financial boundary** — challans must never affect dealer balance, ledger, due, or collections.
- **Financial boundary** — invoices affect credit exposure, ledger, dealer balance, and due.
- **Logistics ownership** — `vehicleNo`, `driverName`, `deliveryMode` belong to Delivery Challan.
- **Credit limit** — evaluated at invoice issue, not at challan dispatch.
- **Revenue recognition** — at invoice issue, not at order approval or challan dispatch.
- **Order immutability** — order lines become immutable after the first confirmed challan.

### Changed Roadmap

| Old next phase | New sequence |
|----------------|--------------|
| PHASE_05_INVOICE_ENGINE | PHASE_05A Delivery Challan Backend |
| | PHASE_05B Delivery Challan UI |
| | PHASE_05C Invoice Engine |
| | PHASE_05D Invoice UI + PDF |

Invoice Engine **postponed** until the Delivery Challan layer is built.

### Added

- **ADR-011** — `docs/ADR/ADR-011-delivery-challan-fulfillment.md`: fulfillment architecture, partial delivery rules, financial boundaries, credit/revenue policies, order immutability, delivery reporting roadmap.

### Updated Governance Docs

- `PROJECT_BRAIN.md` — Fulfillment Layer, Delivery Challan Module, InvoiceItem requirement, delivery reporting roadmap.
- `CURRENT_PHASE.md` — next phase set to PHASE_05A; order phases marked complete; 05A–05D roadmap added.
- `IMPLEMENTATION_STATUS.md` — architectural decisions table; approved phase sequence.
- `NEXT_ACTION.md` — PHASE_05A implementation goals replace Invoice Engine.

### Scope

Documentation and architecture governance only. No schema changes, no migrations, no application code.

---

## [PHASE_04C_ORDER_COMBOBOX_DIAGNOSTICS] — 2026-06-23

### Fixed

- **DealerCombobox dropdown invisible on Create Order** — `OrderFormSection` used `overflow-hidden`, which clipped the absolutely positioned dealer dropdown at the card border even when React state held dealers (`ready`, `items.length > 0`). Removed `overflow-hidden` from the section shell; the Dealer & Project section now passes `sectionClassName="relative z-20"` so the open list paints above the Order Items card below.
- **DealerCombobox transport / error boundary** — `src/components/orders/dealer-combobox.tsx`: the dealer load previously swallowed failures into `[]` with no `try/catch`. The load is now an explicit state machine (`loading` / `ready` / `error`) that never coerces a failure into an empty list.

### Changed

- `src/components/orders/order-form-section.tsx` — removed `overflow-hidden`; added optional `sectionClassName` prop for stacking when a section hosts popovers.
- `src/components/orders/order-form.tsx` — Dealer & Project section uses `sectionClassName="relative z-20"`.

### Added

- **Transport-aware error classification** — five distinct failure kinds: `ACTION_FAILURE` (typed `{ success: false }` envelope), `NETWORK` (thrown `TypeError`/`fetch`), `PERMISSION` and `SESSION` (`NEXT_REDIRECT`), and `STALE_ACTION` ("Failed to find Server Action … older/newer deployment"). Each maps to a localized message.
- **Actionable error UI** — `role="alert"` state with a localized message and a **Retry** action (or **Refresh page** for a stale Server Action, the only correct recovery for a rotated action id).
- **Dev-only diagnostics** — `logDealerDiagnostic()` logs the failure kind + context via `console.warn`, guarded by `process.env.NODE_ENV === "production"`; no production noise.
- **Localization keys** — `order.form.dealer.error.failed` / `.network` / `.permission` / `.session` / `.stale` / `.retry` / `.refresh` in `public/locales/en/common.json` and `public/locales/bn/common.json`.
- **ADR-010** — `docs/ADR/ADR-010-order-combobox-diagnostics.md`: root cause and the transport/error-boundary decision.

### Root Cause

Two distinct defects, both UI-only:

1. **Visibility (primary on Create Order)** — `OrderFormSection` applied `overflow-hidden` to the card shell. The dealer dropdown is `position: absolute` and opens downward; the list `<ul>` rendered below the section clip edge and was not painted or clickable despite correct React state.
2. **Transport (earlier)** — A stale Server Action reference could throw before returning; missing `try/catch` plus a silent `: []` fallback masked that failure as "No dealers found".

### Verification

- `npx tsc --noEmit` — 0 errors (strict)
- `npx eslint` — 0 errors (3 pre-existing `useReactTable` warnings)
- Dealer dropdown visible and selectable on `/orders/new` after section overflow fix

### Scope

UI-only, additive. No changes to `listDealers`, the Dealer module, the Orders backend, RBAC, or the schema. No Invoice / Collection / Ledger work.

---

## [PHASE_04B_ORDER_UI] — 2026-06-23

### Added

- **Order List** — `src/app/(dashboard)/orders/page.tsx` + `src/components/orders/order-table.tsx`: search, status / dealer / date-range filters, sortable columns, pagination, "Created By" column, status badges
- **Create Order** — `src/app/(dashboard)/orders/new/page.tsx` (+ `page-client.tsx`) and `src/components/orders/order-form.tsx`: dealer selector, project (existing or inline), product line grid with add/remove rows and per-line price override
- **Order Detail** — `src/app/(dashboard)/orders/[id]/page.tsx` (+ `page-client.tsx`) and `src/components/orders/order-detail-view.tsx`: order info, dealer, project, items, financial summary, approval status, audit timeline
- **Edit Order** — `src/app/(dashboard)/orders/[id]/edit/page.tsx` (+ `page-client.tsx`): reuses `OrderForm` in edit mode with status-aware submit; approved orders editable by Manager / Super_Admin
- **Approval UI** — `src/components/orders/approval-actions.tsx`: Approve / Reject / Cancel, shown only when state + role permit, with confirmation dialogs and optional reason; calls existing `approveOrder` / `rejectOrder` / `cancelOrder`
- **Live Financial Summary** — `src/components/orders/order-financial-summary.tsx`: real-time Subtotal / Discount % / Discount Amount / Grand Total, debounced, driven entirely by the server calculator
- **Shared order components** — `order-status-badge.tsx`, `order-empty-state.tsx`, `order-form-section.tsx`, `dealer-combobox.tsx`, `product-line-editor.tsx`, `order-history-timeline.tsx`
- **UI-support server actions** — `src/lib/actions/orders/preview-order-totals.ts` (runs existing `calculateOrderTotals`; converts order-level discount % → per-line amounts) and `src/lib/actions/orders/list-dealer-projects.ts` (read-only active-project list). Both RBAC-guarded by `orders:view`
- **ADR-009** — `docs/ADR/ADR-009-order-ui.md`: UI architecture, approval-workflow UX, pricing-override / discount-percentage rationale

### Changed

- `src/types/order.ts` — added `OrderSummaryDTO.createdByName` (and `OrderDetailDTO.createdByName`); added `OrderLinePreviewDTO` / `OrderTotalsPreviewDTO` for the live preview
- `src/lib/actions/orders/helpers.ts` — `orderSummaryInclude` / `orderDetailInclude` now include `createdBy { id, name }`; DTO serializers populate `createdByName`
- `src/lib/validators/order.schema.ts` — added `previewOrderTotalsSchema` and `dealerProjectsSchema` (+ inferred input types)
- `middleware.ts` — added `/orders/new → orders:create` as a more-specific route before the general `/orders` prefix
- `public/locales/en/common.json` & `public/locales/bn/common.json` — full EN + BN translation keys for the Order UI

### Architecture Notes

- **No client-side money math**: the live summary and submit path both call `previewOrderTotals`, which runs the existing Decimal engine; the per-line discount amounts returned by the preview are the exact values submitted to create/update
- **Order-level discount %** is a UI affordance converted to per-line amounts on the server — no schema change required
- **Hybrid Server/Client**: pages enforce RBAC and pre-load data; client components own interactivity
- **Centralized RBAC**: page guards (`enforcePermission`), middleware, and conditional rendering (`hasPermission`); no inline role checks
- **VAT never shown or computed** (already included in price)

### Verification

- `npx tsc --noEmit` — 0 errors (strict)
- `npx eslint` — 0 errors (3 pre-existing `react-hooks/incompatible-library` warnings on `useReactTable`, shared with the Product/Dealer tables)

---

## [PHASE_04A_ORDER_BACKEND] — 2026-06-23

### Added

- **Order domain types** — `src/types/order.ts`: `OrderSummaryDTO`, `OrderDetailDTO`, `OrderItemDTO`, `ApprovalHistoryDTO`, error codes, `ActionResult<T>`, sort fields (money/quantity exposed as fixed-precision decimal strings)
- **Order validators** — `src/lib/validators/order.schema.ts`: `createOrderSchema`, `updateOrderSchema`, `approveOrderSchema`, `rejectOrderSchema`, `cancelOrderSchema`, `listOrdersSchema`, `orderIdentifierSchema` (localization-key error messages)
- **Financial calculation engine** — `src/lib/utils/order-calculator.ts`: pure, Decimal-only engine (`calculateOrderTotals`, `findInvalidLineIndex`); no float math; VAT always `0.00` (already included in price)
- **Order status workflow** — `src/lib/orders/workflow.ts`: transition matrix + guards (`assertCanApprove`, `assertCanReject`, `assertCanCancel`, `assertCanChangeStatusOnUpdate`, `assertEditable`) raising typed `OrderWorkflowError`
- **Order number generator** — `src/lib/utils/order-number.ts`: sequential `ORD-NNNNNN` codes (transaction-safe, retry on collision)
- **Project code generator** — `src/lib/utils/project-code.ts`: sequential `PRJ-NNNNNN` codes for inline project creation
- **Order server actions** — `src/lib/actions/orders/`: `createOrder`, `updateOrder`, `approveOrder`, `rejectOrder`, `cancelOrder`, `getOrder`, `listOrders` (+ shared `helpers.ts`)
- **Approval audit** — every lifecycle event (CREATE/SUBMIT/UPDATE/APPROVE/REJECT/CANCEL) writes an `AuditLog` row inside the mutation transaction; `ApprovalHistoryDTO` is derived from these rows
- **ADR-008** — `docs/ADR/ADR-008-order-backend.md`: workflow, approval rules, multi-invoice architecture, calculation strategy, and RBAC decisions

### Changed

- `prisma/schema.prisma` — `OrderStatus` enum: added **`Cancelled`** (additive; `Delivered` retained, reserved). No tables, columns, or indexes changed
- `src/lib/permissions.ts` — **Manager** granted `orders:create` and `orders:edit` (in addition to `orders:approve`) per business rules ("Manager can create"; "approved orders may be edited by Manager and Super_Admin")

### Architecture Notes

- **Transaction safety**: `createOrder` validates dealer/project/products, optionally creates an inline project, calculates totals, generates the order number, and persists the order + items + audit entry — all in one `prisma.$transaction`
- **Decimal discipline**: all monetary and quantity math uses `Prisma.Decimal` (`ROUND_HALF_UP`, 2dp); DTOs expose decimal strings; no `number` ever touches money
- **Multi-invoice aware**: cancellation is blocked once any invoice exists; `invoiceCount` surfaced in DTOs (invoice creation itself deferred to PHASE_05)
- **Index review**: existing `SalesOrder` / `SalesOrderItem` indexes fully cover the search dimensions; no new indexes added
- **Centralized RBAC**: every action calls `requirePermission()`; no inline role checks
- **Migration deferred**: the `Cancelled` enum value (and the deferred PHASE_00C invoice-relation change) must be migrated before PHASE_05

### Verification

- `npx prisma generate` — succeeds
- `npx prisma format` — schema valid
- `npx tsc --noEmit` — 0 errors (strict)
- `npx eslint` — 0 errors on all new files
- Logic harness (calculator + workflow + validators) — 22/22 pass

---

## [PHASE_00C_INVOICE_RELATION_CORRECTION] — 2026-06-23

### Changed

- **Invoice ↔ SalesOrder is now one-to-many** — corrected to support the business rule "One SalesOrder may generate multiple Invoices"
- `prisma/schema.prisma` — `Invoice.orderId`: removed `@unique` (column and relation preserved)
- `prisma/schema.prisma` — `Invoice`: added `@@index([orderId])` to preserve FK lookup performance after the implicit unique index was removed
- `prisma/schema.prisma` — `SalesOrder`: changed back-relation `invoice Invoice?` → `invoices Invoice[]`

### Added

- **ADR-007** — `docs/ADR/ADR-007-order-multi-invoice.md`: documents the One Order → Many Invoices decision, scope boundaries, and consequences

### Notes

- `Collection`, `LedgerEntry`, `DueReport`, `Dealer`, `Product`, and `Project` were intentionally NOT modified
- Verified with `npx prisma format` and `npx prisma generate`
- Migration intentionally deferred; Orders module not built in this phase
- Financial reconciliation across multiple invoices per order is application logic (deferred to PHASE_05)

---

## [PHASE_03C_PRODUCT_FORMS] — 2026-06-20

### Added

- **ProductForm** — `src/components/products/product-form.tsx`: Shared create/edit form with money input, toggle, category select, unsaved-change indicator, success feedback, and field-level error display
- **ProductFormSection** — `src/components/products/product-form-section.tsx`: Section card wrapper for grouping product form fields
- **DeactivateProductDialog** — `src/components/products/deactivate-product-dialog.tsx`: Accessible confirmation modal for soft-deactivating a product (isActive = false)
- **New Product page** — `/products/new`: Server Component enforces `products:create`; fetches categories server-side; renders client form
- **Edit Product page** — `/products/[id]/edit`: Server Component enforces `products:edit`; fetches product + categories; renders client form with prefilled values
- **listActiveCategories** — `src/lib/actions/products/list-categories.ts`: Returns active categories alphabetically for the category dropdown
- **ADR-004** — `docs/ADR/ADR-004-product-forms.md`: Documents hybrid page architecture, three-layer RBAC, and soft-delete decision

### Modified

- `src/lib/actions/products/create-product.ts` — `requirePermission("products:create")` guard added at the top of the action
- `src/lib/actions/products/update-product.ts` — `requirePermission("products:edit")` guard added at the top of the action
- `src/components/products/product-table.tsx` — Edit link column added (visible only to `products:edit` users via `useSession`)
- `src/app/(dashboard)/products/page.tsx` — New Product button added (visible only to `products:create` users via `useSession`)
- `middleware.ts` — `/products/new` → `products:create` and `/dealers/new` → `dealers:create` added as more-specific routes before the general view-only prefixes
- `public/locales/en/common.json` — 60+ new keys: `products.form.*`, `products.deactivate.*`, `products.actions.*`, `validation.*` (sku, modelNumber, name, nameBn, categoryId, unit, description)
- `public/locales/bn/common.json` — Bengali translations for all new keys

### Architecture Notes

- **Three-layer RBAC**: middleware prefix → `enforcePermission()` in server component → `requirePermission()` in server action
- **Soft-delete only**: Deactivate sets `isActive = false`; no hard delete exposed in UI; historical data integrity preserved
- **Hybrid page pattern**: Server Component shell for enforcement + data fetch; Client Component for UI + translations
- **Category select**: Populated from live database at request time; only active categories shown

---

## [PHASE_AUTH_02_RBAC] — 2026-06-20

### Added

- **Centralized permission matrix** — `src/lib/permissions.ts` expanded with granular `Resource × Action` permissions for all 11 resources
- **RBAC helpers** — `src/lib/rbac/index.ts`: `canView()`, `canCreate()`, `canEdit()`, `canDelete()`, `canApprove()`, `canWrite()`, `getCapabilities()`, `buildPermissionContext()`
- **Server action guards** — `src/lib/rbac/guards.ts`: `requirePermission()`, `requireAllPermissions()`, `requireAnyPermission()`, `ForbiddenError`, `UnauthorizedError`
- **Server component guards** — `enforcePermission()`, `enforceAuth()`, `checkPermission()` (all in guards.ts)
- **Route-level middleware protection** — 11 route prefixes mapped to permissions; unauthorized → `/access-denied`
- **403 Access Denied page** — `/access-denied`, bilingual (EN/BN), shows user's role, responsive, premium design
- **Real session in DashboardLayout** — dashboard layout now reads `getCurrentUser()` and passes actual `userRole` to `DashboardShell` (was hardcoded `Super_Admin`)
- **RBAC localization keys** — `rbac.*` keys added to English and Bengali locale files

### Modified

- `src/lib/permissions.ts` — Added `Resource`, `Action` types; expanded `Permission` union with 25 granular permissions; corrected `ROLE_PERMISSIONS` for all 4 roles to match official matrix; changed to `import type` for Prisma `UserRole`
- `src/lib/auth/helpers.ts` — Added `requirePermission()` helper
- `middleware.ts` — Added `ROUTE_PERMISSIONS` map and permission check; unauthorized routes redirect to `/access-denied`
- `src/app/(dashboard)/layout.tsx` — Made async; reads session; passes real `userRole` to `DashboardShell`
- `public/locales/en/common.json` — Added `rbac.*` keys
- `public/locales/bn/common.json` — Added `rbac.*` Bengali keys

### Architecture Notes

- Audit-ready: `PermissionCheckContext` type with `checkedAt` field ready for future AuditLog service
- Sidebar and MobileNav already consumed `hasPermission()` — no changes needed; now receive real role from session
- No dealer or product server actions modified

---

## [PHASE_AUTH_01_FOUNDATION] — 2026-06-20

### Added

- **Auth.js v5** (next-auth@beta.31) with Credentials provider
- **bcrypt password hashing** (12 salt rounds) via bcryptjs
- **JWT session strategy** — no database sessions required
- **Login page** (`/login`) — enterprise-quality UI, RHF + Zod, loading state, error messages
- **Route protection middleware** — all dashboard/dealer/product routes require session
- **Super Admin seed** — idempotent, creates `admin@nazma.local` with hashed password
- **Auth helpers** — `getSession`, `getCurrentUser`, `getCurrentRole`, `requireUser`, `requireRole`
- **SessionProvider** — wraps root layout for client-side session access
- **Module augmentation** — `Session`, `User`, `JWT` types extended with `role` and `isActive`
- **Inactive user blocking** — `isActive: false` users receive friendly error on login attempt
- **Auth translation keys** — English and Bengali locale strings for auth module

### Dependencies Added

- `next-auth@^5.0.0-beta.31`
- `bcryptjs@^2.4.3`
- `@auth/prisma-adapter@latest`
- `@types/bcryptjs` (dev)

### Modified

- `prisma/seed.ts` — added `seedAdminUser` call with structured output
- `src/app/layout.tsx` — wrapped with `SessionProvider`
- `public/locales/en/common.json` — added `auth.*` keys
- `public/locales/bn/common.json` — added `auth.*` keys (Bengali)

---

## [PHASE_03A_REVIEW_PRODUCT_SEEDS] — Prior

### Added

- `prisma/seeds/product-categories.ts` — idempotent upsert of 12 categories
- `prisma/seed.ts` — Prisma seed entry point
- `package.json` — `prisma.seed` + `seed` script + `tsx` devDependency

---

## [PHASE_03B_PRODUCT_LIST_UI] — Prior

### Added

- `src/app/(dashboard)/products/page.tsx`
- `src/components/products/product-table.tsx`
- `src/components/products/product-search.tsx`
- `src/components/products/product-status-badge.tsx`
- `src/components/products/product-empty-state.tsx`
- Product translation keys (en + bn)

---

## [PHASE_03A_PRODUCT_BACKEND] — Prior

### Added

- `Category` and `Product` Prisma models
- Product domain types, validators, and CRUD server actions

---

## [PHASE_02C_DEALER_FORMS] — Prior

### Added

- New Dealer form (`/dealers/new`)
- Edit Dealer form (`/dealers/[dealerCode]/edit`)

---

## [PHASE_02B_DEALER_LIST_UI] — Prior

### Added

- Dealer list page with TanStack Table, search, sort, pagination

---

## [PHASE_02A_DEALER_BACKEND] — Prior

### Added

- Dealer domain: types, validators, CRUD server actions

---

## [PHASE_01_FOUNDATION] — Prior

### Added

- Next.js 15+ App Router project scaffold
- Prisma + PostgreSQL setup
- Tailwind CSS + design system
- Dashboard shell layout
- Localization (English + Bengali)
- Dark mode support
