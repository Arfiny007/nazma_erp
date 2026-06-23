# ADR-008: Sales Order Backend

Date: 2026-06-23

Status: ACCEPTED

Phase: PHASE_04A_ORDER_BACKEND

---

## Context

With Dealers, Products, RBAC and the one-to-many Invoice relation (ADR-007) in
place, the platform needs the Sales Order backend: the transactional core that
turns dealer + product + pricing data into an approvable, auditable order that
later feeds the Invoice engine (PHASE_05). This phase builds the **backend only**
— validators, DTOs, server actions, a Decimal-safe calculation engine, a status
workflow, and the approval audit trail. No UI, no Invoice/Collection/Ledger work.

The schema was already scaffolded in PHASE_00B (`SalesOrder`, `SalesOrderItem`).
This ADR documents the workflow, approval, calculation, multi-invoice, and RBAC
decisions taken while wiring up the backend.

---

## Decision

### 1. Order status workflow

The `OrderStatus` enum is the single source of truth for lifecycle state. This
phase operates over five statuses:

```
Draft  →  Pending_Approval  →  Approved
   │             │
   │             └──────────→  Rejected
   └─────────────────────────→ Cancelled   (from any non-terminal state)
```

`Cancelled` was **added** to the enum (it did not previously exist). `Delivered`
is retained (reserved for a future delivery/fulfilment phase) but is not part of
this workflow. This is the minimum schema change required to satisfy the phase.

All transition rules live in `src/lib/orders/workflow.ts` (`canTransition`,
`assertCanApprove`, `assertCanReject`, `assertCanCancel`,
`assertCanChangeStatusOnUpdate`, `assertEditable`). Actions never embed status
logic inline. Guards throw a typed `OrderWorkflowError` that the action layer
maps to a structured, localizable failure.

**Hard rules enforced (per business spec):**

- **Cannot approve a cancelled order** → `ORDER_CANCELLED`.
- **Cannot reject an approved order** → `CANNOT_REJECT_APPROVED`.
- **Cannot cancel an invoiced order** → `ORDER_INVOICED` (checked via live
  `invoices` count, not status).

`create` / `update` may only place an order into `Draft` or `Pending_Approval`
(the Draft↔Pending_Approval edges). `Approve` / `Reject` / `Cancel` are dedicated
actions that own every other transition.

### 2. Approval rules & audit

- **Create**: SR, Manager, Super_Admin.
- **Approve / Reject**: Manager, Super_Admin (approval authority). Super_Admin can
  override a prior rejection by re-approving (`Rejected → Approved` is permitted).
- **Edit**: Manager, Super_Admin — **including approved orders** (approval does not
  lock an order; only `Cancelled`/`Delivered` are immutable).

The approval audit uses the **existing** `SalesOrder` fields — `createdById`,
`approvedById`, `approvedAt` — plus the existing `AuditLog` table. Every lifecycle
mutation (`CREATE`, `SUBMIT`, `UPDATE`, `APPROVE`, `REJECT`, `CANCEL`) writes an
`AuditLog` row **inside the same transaction** as the state change, capturing the
actor, the from/to status, and an optional reason (for reject/cancel, which have
no dedicated schema columns). `ApprovalHistoryDTO` is derived from these audit
rows, giving a complete, ordered, tamper-evident timeline without a new table.

### 3. Transaction safety

`createOrder` performs all of the following in **one** `prisma.$transaction`:
dealer/project/product validation, optional inline-project creation, Decimal-safe
total calculation, order-number generation, order + line-item persistence, and
the audit entry. The unique constraint on `orderNo` is the final guard against
concurrent inserts, so creation retries a bounded number of times on a collision
(mirroring the established dealer-code pattern). `updateOrder` re-prices and
replaces line items (`deleteMany` + `create`) and writes its audit row atomically.

### 4. Financial calculation engine

`src/lib/utils/order-calculator.ts` is a pure, reusable, **Decimal-only** engine.
No `number` math touches money at any point — all arithmetic uses
`Prisma.Decimal` with `ROUND_HALF_UP` at 2 decimal places.

```
lineSubtotal   = quantity × unitPrice          (rounded 2dp)
lineTotal      = lineSubtotal − discount        (rounded 2dp)
subtotal       = Σ lineSubtotal
discountAmount = Σ discount
grandTotal     = subtotal − discountAmount
vat            = 0.00   (VAT is already included in the product price)
```

Per the business rule, **VAT is not calculated** — it is already embedded in the
product price. The persisted `SalesOrder.vat` column is therefore always `0.00`.
`findInvalidLineIndex` flags any line whose discount exceeds its subtotal so
actions can reject malformed pricing before persistence.

### 5. Multi-invoice architecture

Building on ADR-007 (`SalesOrder.invoices Invoice[]`), an order may generate many
invoices. This backend does **not** create invoices, but it respects the
relationship: cancellation is blocked once any invoice exists, and the
`OrderSummaryDTO`/`OrderDetailDTO` expose `invoiceCount`. Reconciliation of
invoice amounts against `grandTotal` remains application logic deferred to the
Invoice engine (PHASE_05).

### 6. Inline project support

An order may reference an existing `projectId` **or** create a project inline
(mutually exclusive — enforced by the validator). Inline creation generates a
`PRJ-NNNNNN` code (`src/lib/utils/project-code.ts`), enforces the
`@@unique([dealerId, name])` constraint, and ties the project to the order's
dealer. There is no standalone Project module (per business rules) — projects
exist only as an order concern here.

### 7. Search backend

`listOrders` supports paginated, sortable search across: **Order Number**
(free-text), **Dealer** (free-text company name or exact `dealerCode`),
**Project** (free-text name or exact `projectId`), **Status** (exact), and
**Date Range** (`createdAt` `gte`/`lte`). Count + page run in a single read
transaction for consistent totals.

### 8. Index review

The existing `SalesOrder` indexes — `dealerCode`, `projectId`, `status`,
`createdById`, `approvedById`, `createdAt` — plus the unique `orderNo` index and
the `SalesOrderItem` `orderId`/`productId` indexes **already cover** every search
and lookup dimension required by this phase. **No new indexes were added** (the
only schema change is the additive `Cancelled` enum value).

### 9. RBAC

All authorization flows through the centralized RBAC layer
(`requirePermission` from `@/lib/rbac/guards`). No inline role checks.

| Action        | Permission        |
|---------------|-------------------|
| `createOrder` | `orders:create`   |
| `updateOrder` | `orders:edit`     |
| `approveOrder`| `orders:approve`  |
| `rejectOrder` | `orders:approve`  |
| `cancelOrder` | `orders:edit`     |
| `getOrder`    | `orders:view`     |
| `listOrders`  | `orders:view`     |

To satisfy the business rules ("Manager can create"; "approved orders may be
edited by Manager and Super_Admin"), the permission matrix was updated to grant
**Manager** `orders:create` and `orders:edit` (in addition to its existing
`orders:approve`). `rejectOrder` is treated as an approval-authority decision;
`cancelOrder` as a modification-authority action.

### Role access matrix (Orders)

| Role        | View | Create | Edit | Approve | Reject | Cancel |
|-------------|:----:|:------:|:----:|:-------:|:------:|:------:|
| Super_Admin | ✅   | ✅     | ✅   | ✅      | ✅     | ✅     |
| Manager     | ✅   | ✅     | ✅   | ✅      | ✅     | ✅     |
| Accounts    | ✅   | ❌     | ❌   | ❌      | ❌     | ❌     |
| SR          | ✅   | ✅     | ❌   | ❌      | ❌     | ❌     |

---

## Consequences

- The backend is fully usable by a future Order UI (PHASE_04B) and by the Invoice
  engine (PHASE_05) through typed, serializable `ActionResult<T>` envelopes.
- Money never leaves the data layer as a float: every amount is a fixed-precision
  decimal **string** in the DTOs; quantities likewise.
- The approval history is reconstructed from `AuditLog`, so it grows automatically
  as more lifecycle events are added — no schema migration needed to enrich it.
- A schema **migration is required** before runtime use to apply the new
  `Cancelled` enum value (deferred per the PHASE_00C note that also defers the
  invoice-relation migration; both should be applied together before PHASE_05).
- SR cannot edit an order after creating it (only Manager/Super_Admin edit). This
  strictly follows the stated business rules; if SRs need to amend their own
  drafts in future, grant SR `orders:edit` scoped to `Draft` status.

---

## Verification

- `npx prisma generate` — succeeds (new `Cancelled` enum present).
- `npx prisma format` — schema valid.
- `npx tsc --noEmit` — 0 errors (strict mode).
- `npx eslint` — 0 errors on all new files.
- Logic harness (calculation engine + workflow guards + validators) — 22/22 pass,
  including Decimal-safety (no IEEE-754 drift), VAT = 0, and all three hard
  workflow rules.
