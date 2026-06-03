# CURRENT_PHASE.md

Current Phase:

PHASE_03A_REVIEW_PRODUCT_SEEDS

Status:

COMPLETE

---

## Objectives

Create the complete Product domain layer (catalog) that Orders and Invoices
will later consume. Nazma Metal products are organized by Category and
identified primarily by their Model Number (e.g. FV-222, FV-223-C, OVP6-507).

* Category model (catalog grouping)
* Product model keyed by unique SKU and unique Model Number
* Decimal-safe pricing (`currentPrice`)
* Type-safe domain layer (types, validators, server actions)
* No UI, pages, forms, or mock data in this phase

---

## Deliverables

prisma/schema.prisma (added `Category`, reshaped `Product`)

src/types/product.ts

src/lib/validators/product.schema.ts

src/lib/actions/products/helpers.ts

src/lib/actions/products/create-product.ts

src/lib/actions/products/update-product.ts

src/lib/actions/products/delete-product.ts

src/lib/actions/products/get-product.ts

src/lib/actions/products/list-products.ts

---

## Implementation Notes

* `Category` -> `Product` is a one-to-many relation; `Product` keeps its
  existing `orderItems SalesOrderItem[]` relation so Orders can reference it.
* `currentPrice` is `Decimal @db.Decimal(18,2)`; it is serialized to a
  fixed-precision decimal string in `ProductDTO` (Decimal is not serializable
  across the Server/Client boundary).
* SKU and Model Number are validated, normalized to uppercase, and enforced as
  unique both at the application level (precise field errors inside the
  transaction) and via database unique constraints (`fromPrismaError` P2002).
* Server actions follow the Dealer module patterns exactly: Zod validation,
  Prisma `$transaction`, the `ActionResult<T>` discriminated union, typed
  error envelopes with localization `messageKey`s, and DTO serialization.
* `createProduct` / `updateProduct` verify the referenced category exists;
  `deleteProduct` blocks removal when dependent order items exist
  (PRODUCT_HAS_DEPENDENCIES), preferring deactivation.
* `getProduct` resolves by `id`, `sku`, or `modelNumber`; `listProducts`
  supports search, category/active filters, sorting, and pagination, with the
  owning category eagerly included.
* Strict TypeScript throughout: no `any`, no mock data, no UI.

---

## Completion Criteria

Phase 03A is complete when:

* `Category` and `Product` models exist with the required fields and relations
* Product domain types, Zod validators, and CRUD + list server actions exist
* SKU and Model Number uniqueness are validated
* Decimal fields are serialized safely in the DTO layer
* `prisma generate` succeeds
* TypeScript passes (`tsc --noEmit`)
* ESLint passes (0 errors)

All criteria met.

---

---

## Objectives (PHASE_03A_REVIEW_PRODUCT_SEEDS)

Create a seed structure for Nazma Metal product categories.

* `prisma/seeds/product-categories.ts` — idempotent upsert of all 12 categories
* `prisma/seed.ts` — Prisma seed entry point
* `package.json` — `prisma.seed` configured, `seed` script added, `tsx` installed

---

## Deliverables

prisma/seeds/product-categories.ts

prisma/seed.ts

package.json (prisma.seed + seed script + tsx devDependency)

---

## Implementation Notes

* Upsert is keyed on `slug` (unique constraint). Re-running the seed updates
  `name` and `isActive` in place — no duplicate rows, fully idempotent.
* No products seeded.
* No Product CRUD actions modified.
* `tsc --noEmit` exits 0.

---

## Next Phase

PHASE_03B_PRODUCT_LIST_UI

---

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

## Implementation Notes

* `ProductTable` calls `listProducts()` server action with search, sort, and pagination params — no new backend APIs.
* Price is formatted with `Intl.NumberFormat` (BDT, narrowSymbol) using the `currentPrice` decimal string from `ProductDTO`; no floating-point arithmetic.
* `ProductStatusBadge` renders green (emerald) for active and gray (slate) for inactive — consistent with enterprise design system.
* All UI strings use `t()` translation keys; zero hardcoded human strings.
* Columns: Model Number, SKU, Product Name (with Bengali subtitle), Category, Current Price (right-aligned), Status.
* Sticky table header, horizontal scroll on small viewports (`min-w-[760px]`), loading skeleton, empty state, error state with retry button.
* Architecture mirrors `DealerTable` exactly: TanStack Table, manual sort/pagination, cancel-on-unmount fetch, `FetchStatus` discriminated state.
* `tsc --noEmit` exits 0. ESLint exits 0 (1 expected TanStack warning, same as dealer module).

## Next Phase

PHASE_03C_PRODUCT_FORMS
