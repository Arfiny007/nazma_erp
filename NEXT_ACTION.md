# NEXT ACTION

## Current State

PHASE_04C_ORDER_COMBOBOX_DIAGNOSTICS is COMPLETE.

The `DealerCombobox` is fixed end-to-end on Create Order:

1. **Visibility** — `OrderFormSection` no longer uses `overflow-hidden`, which was clipping the absolutely positioned dropdown at the card border even when state held dealers. The Dealer & Project section uses `relative z-20` so the open list paints above the Order Items card.
2. **Transport** — Load path uses `try/catch` and typed `loading | ready | error` states; failures are never coerced to `[]`.

Verified: `tsc --noEmit` 0 errors; `eslint` 0 errors (3 pre-existing `useReactTable` warnings). Product Form sections untouched. ADR-010 documents both defects. UI-only — no backend/schema changes.

PHASE_04B_ORDER_UI (prior) delivered the Sales Order UI.

The Sales Order **UI** is fully implemented on top of the existing backend:

- Order List `/orders` — search, status / dealer / date-range filters, sorting, pagination, status badges, "Created By" column
- Create Order `/orders/new` — dealer selector, project (existing or inline), product line grid (add/remove rows, per-line price override)
- Live Financial Summary — Subtotal / Discount % / Discount Amount / Grand Total via the server calculator (`previewOrderTotals`); no client-side money math
- Order Detail `/orders/[id]` — order info, dealer, project, items, financial summary, approval status, audit timeline
- Edit Order `/orders/[id]/edit` — status-aware submit, workflow-respecting; approved orders editable by Manager / Super_Admin
- Approval UI — Approve / Reject / Cancel, shown only when state + role permit; reuses existing actions
- UI-support actions — `preview-order-totals.ts`, `list-dealer-projects.ts` (RBAC-guarded, no duplicated logic)
- Centralized RBAC (middleware + `enforcePermission` + `hasPermission`); EN + BN localization; loading / error / empty states; responsive
- ADR-009 documents UI architecture, approval-workflow UX, pricing-override rationale
- Verified: `tsc --noEmit` 0 errors; `eslint` 0 errors (3 pre-existing `useReactTable` warnings)

PHASE_04A (prior) delivered the order backend; PHASE_00C corrected `Invoice` ↔ `SalesOrder` to one-to-many.

---

## Outstanding

- **Migration NOT yet run.** Two deferred schema changes must be applied together
  before the Invoice engine (PHASE_05):
  1. `OrderStatus` enum gained `Cancelled` (PHASE_04A).
  2. The `Invoice.orderId` `@unique` removal + `@@index([orderId])` (PHASE_00C).

  Run `npx prisma migrate dev --name order_backend_and_invoice_relation` (or a
  descriptive name) once a database is available. The Order UI cannot be
  exercised end-to-end against a live DB until this migration is applied.

---

## Next Phase: PHASE_05_INVOICE_ENGINE

### Objective

Build the Invoice engine on top of the completed Order module (one Order →
many Invoices), following the same backend-then-UI, Decimal-safe, RBAC-guarded
patterns.

### Guard Usage Pattern

```typescript
// In Server Component pages (page.tsx)
import { enforcePermission } from "@/lib/rbac/guards";
await enforcePermission("orders:view");

// In Server Actions
import { requirePermission } from "@/lib/rbac/guards";
const user = await requirePermission("orders:create");

// In Client Components (conditional rendering)
import { hasPermission } from "@/lib/permissions";
const canApprove = hasPermission(userRole, "orders:approve");
```

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |

---

## Notes

- Do NOT begin Invoices, Collections, Ledger, or Due Reports
- All new server actions MUST call `requirePermission()` at the top
- All new protected pages MUST call `enforcePermission()` at the top
- Never expose raw Prisma errors to the client (use the typed `ActionResult` envelope)
- Never use `any` type
- Never hardcode role checks — use helpers from `src/lib/rbac/`
- Money is always a fixed-precision decimal string at the boundary; never a float
