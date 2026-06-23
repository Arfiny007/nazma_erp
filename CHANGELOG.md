# CHANGELOG

All notable changes to Nazma ERP are documented here.

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
