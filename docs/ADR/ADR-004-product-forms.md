# ADR-004: Product Forms Architecture

Date: 2026-06-20

Status: ACCEPTED

---

## Context

The product catalog backend (PHASE_03A) and read-only product list (PHASE_03B) were complete. This phase (PHASE_03C) adds Create, Edit, and Deactivate workflows for the Product module.

Key constraints:
- RBAC infrastructure from PHASE_AUTH_02_RBAC is in place
- Only `Super_Admin` and `Manager` can create/edit/delete products
- `Accounts` and `SR` are read-only for products
- No floating-point monetary calculations allowed
- All user-facing strings must be localized (EN + BN)

---

## Decisions

### 1. Hybrid Server/Client Page Architecture

**Decision**: Form pages use a thin Server Component shell (`page.tsx`) that calls `enforcePermission()` and fetches data, plus a Client Component that handles all UI rendering and translations.

**Why**: 
- `enforcePermission()` requires server-side execution (reads session, redirects)
- `useLanguage()` (the project's translation hook) is client-only
- A hybrid approach satisfies both requirements without workarounds
- Consistent with Next.js App Router best practices

**Alternative considered**: Pure client components (matching dealer form pattern). Rejected because it would require client-side redirect logic for RBAC enforcement, creating a flash of forbidden content.

### 2. Three-Layer RBAC Enforcement

**Decision**: RBAC is enforced at three layers:

1. **Middleware** (`middleware.ts`): `/products/new` → `products:create`. All `/products/*` require `products:view`.
2. **Server Component** (`page.tsx`): `enforcePermission("products:create")` / `enforcePermission("products:edit")` — redirects to `/access-denied`.
3. **Server Action** (`create-product.ts`, `update-product.ts`): `requirePermission()` — throws `ForbiddenError`.

**Why**: Defense in depth. Each layer independently prevents unauthorized access. The server action guard is the true security boundary (cannot be bypassed by URL manipulation). The server component guard provides early redirect UX. The middleware guard handles static routes.

### 3. Soft-Delete (isActive = false) Instead of Hard Delete

**Decision**: Deactivating a product sets `isActive = false`. No hard delete exposed in the UI.

**Why**:
- Products may be referenced by historical orders and invoices
- Hard deletion would violate referential integrity
- Business requires ability to re-activate products
- Audit trail is preserved
- Prisma schema already has the `isActive` Boolean field
- The existing `updateProduct` server action supports partial updates including `isActive`

**Implementation**: A dedicated `DeactivateProductDialog` component shows a confirmation modal with:
- Product name in the description for confirmation
- Note that re-activation is possible
- Two-step confirmation (modal + button click)
- RBAC: Deactivate button only shown on edit page (which requires `products:edit`)

### 4. Shared ProductForm Component

**Decision**: A single `ProductForm` component handles both create and edit modes, controlled by a `mode` prop.

**Why**:
- Eliminates code duplication for validation, field layout, error handling, and money formatting
- Consistent UX between create and edit
- Single place to update form fields when schema evolves

**Pattern**: Identical to `DealerForm` which was established in PHASE_02C.

### 5. Server-Side Category Fetching

**Decision**: Categories are fetched server-side in the page Server Component and passed as props to the form.

**Why**:
- Avoids client-side loading state for the category dropdown
- Categories are static enough to benefit from server-side rendering
- Consistent with how product data is fetched for edit mode
- Only active categories are fetched (`isActive: true`) to keep the select clean

### 6. Money Input Pattern

**Decision**: Reuse the `sanitizeMoneyInput` / `formatMoneyDisplay` / `normalizeMoneyOnBlur` helper functions (same as DealerForm's credit limit field).

**Why**:
- Prevents floating-point issues (`currentPrice` persists as `Decimal(18,2)` in Postgres)
- Consistent UX with the dealer form
- No separate utility extraction needed (pattern is self-contained per form)

### 7. Unsaved Changes Indicator

**Decision**: A subtle amber indicator appears when `isDirty` is true (React Hook Form) and the form hasn't been submitted.

**Why**:
- Enterprise UX requirement from the phase specification
- Prevents accidental navigation away without saving
- Uses RHF's built-in `isDirty` flag — no extra state needed

---

## Files Created

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

## Files Modified

```
src/lib/actions/products/create-product.ts  — requirePermission("products:create") added
src/lib/actions/products/update-product.ts  — requirePermission("products:edit") added
src/components/products/product-table.tsx   — Edit link column + session-aware rendering
src/app/(dashboard)/products/page.tsx       — New Product button (role-aware)
middleware.ts                               — /products/new and /dealers/new routes added
public/locales/en/common.json              — product form + deactivate + validation keys
public/locales/bn/common.json              — Bengali translations for all new keys
```

---

## Consequences

- Product create/edit is fully RBAC-protected at 3 layers
- Deactivation is soft-delete only — no data loss risk
- The form pattern (ProductForm) can be reused as a template for future modules
- Categories load server-side — no loading spinner for the select field
- All UI text is translatable (EN/BN)
