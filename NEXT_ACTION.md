# NEXT ACTION

## Current State

PHASE_04A_ORDER_BACKEND is COMPLETE.

The Sales Order **backend** is fully implemented (no UI):

- Validators — `src/lib/validators/order.schema.ts` (create / update / approve / reject / cancel / list / identify)
- DTOs — `src/types/order.ts` (Summary / Detail / Item / Approval History)
- Server actions — `src/lib/actions/orders/` (`createOrder`, `updateOrder`, `approveOrder`, `rejectOrder`, `cancelOrder`, `getOrder`, `listOrders`)
- Decimal-safe calculation engine — `src/lib/utils/order-calculator.ts` (VAT already in price → vat = 0.00)
- Status workflow guards — `src/lib/orders/workflow.ts`
- Approval audit via `createdById` / `approvedById` / `approvedAt` + `AuditLog`
- Order numbers `ORD-NNNNNN`; inline projects `PRJ-NNNNNN`
- Search backend: order number, dealer, project, status, date range
- RBAC: Manager now has `orders:create` + `orders:edit`; `orders:approve` for approve/reject; `orders:edit` for cancel
- ADR-008 documents the decisions
- Verified: `prisma generate`, `prisma format`, `tsc --noEmit`, `eslint` — all clean; 22/22 logic checks pass

PHASE_00C (prior) corrected `Invoice` ↔ `SalesOrder` to one-to-many.

---

## Outstanding

- **Migration NOT yet run.** Two deferred schema changes must be applied together
  before the Invoice engine (PHASE_05):
  1. `OrderStatus` enum gained `Cancelled` (PHASE_04A).
  2. The `Invoice.orderId` `@unique` removal + `@@index([orderId])` (PHASE_00C).

  Run `npx prisma migrate dev --name order_backend_and_invoice_relation` (or a
  descriptive name) once a database is available.

---

## Next Phase: PHASE_04B_ORDER_UI

### Objective

Build the Sales Order UI on top of the completed backend, following the hybrid
Server Component + Client Component pattern established in PHASE_03C.

### Tasks

1. Order list page — table, search (number/dealer/project/status/date range), pagination, status badges
2. Create Order form — dealer select, project (existing or inline), product line editor with live Decimal-safe totals
3. Order detail page — items, totals, approval history timeline
4. Approval workflow UI — Approve / Reject / Cancel actions (role-aware buttons)
5. RBAC: `enforcePermission()` in pages; role-aware action buttons via `hasPermission()`
6. EN + BN localization for all new `order.*` and `validation.*` keys used by the backend

### Guard Usage Pattern

```typescript
// In Server Component pages (page.tsx)
import { enforcePermission } from "@/lib/rbac/guards";
await enforcePermission("orders:view");

// In Server Actions (already implemented in the backend)
import { requirePermission } from "@/lib/rbac/guards";
const user = await requirePermission("orders:create");

// In Client Components (conditional rendering)
import { hasPermission } from "@/lib/permissions";
const canApprove = hasPermission(userRole, "orders:approve");
```

### Localization Keys Used by the Backend (to add in PHASE_04B)

`order.error.*` (dealerNotFound, inactiveDealer, projectNotFound, duplicateProject,
productNotFound, inactiveProduct, notFound, duplicateOrderNo, orderNoGenerationFailed,
invalidReference, invalidTransition, cancelledImmutable, locked, cannotApproveCancelled,
alreadyApproved, cannotRejectApproved, alreadyRejected, invoiced, alreadyCancelled),
`validation.*` (quantity.*, dealerCode.*, projectId.*, productId.*, projectName.*,
contactName.*, contactPhone.*, orderNo.*, order.itemsRequired, project.ambiguous,
dateRange.invalid, discount.exceedsLine, reason.tooLong).

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
