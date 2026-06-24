# ADR-011: Delivery Challan & Fulfillment Layer

Date: 2026-06-25

Status: ACCEPTED

Phase: PHASE_05A_DELIVERY_CHALLAN_BACKEND (architecture governance)

Supersedes / amends: ADR-007 (partial fulfillment model refined), ADR-008 §5 (multi-invoice path clarified)

---

## Context

The platform originally planned a direct path from **Sales Order → Invoice**
(ADR-007 corrected the schema to allow one order → many invoices for partial
shipments). Business has now approved a **Fulfillment Layer** that separates
physical delivery from financial recognition:

```
Sales Order
  → Delivery Challan   (NON-FINANCIAL — logistics only)
  → Invoice            (FINANCIAL — revenue & receivables)
  → Collection
  → Ledger
  → Due Report
```

This ADR governs the fulfillment architecture **before** any schema migration or
implementation code. It is the authoritative reference for PHASE_05A through
PHASE_05D.

---

## Decision

### 1. Fulfillment architecture — three layers

| Layer | Entity | Purpose | Financial impact |
|-------|--------|---------|------------------|
| Commercial | `SalesOrder` | Approved commitment of products, quantities, and pricing | None until invoiced |
| Logistics | `DeliveryChallan` | Records what was physically shipped, when, and how | **None** |
| Financial | `Invoice` (+ `InvoiceItem`) | Recognizes revenue, creates receivable, drives collections | **Full** |

The Fulfillment Layer sits between Order and Invoice. It is the **only** source
of shipped quantities for invoicing.

### 2. Delivery workflow

```
Approved SalesOrder
       │
       ├─→ DeliveryChallan #1  ──→  Invoice #1  ──→  Collection / Ledger / Due
       │
       ├─→ DeliveryChallan #2  ──→  Invoice #2  ──→  Collection / Ledger / Due
       │
       └─→ DeliveryChallan #N  ──→  Invoice #N  ──→  Collection / Ledger / Due
```

**Cardinality rules (mandatory):**

| Relationship | Cardinality |
|--------------|-------------|
| SalesOrder → DeliveryChallan | **One-to-many** (partial delivery allowed) |
| DeliveryChallan → Invoice | **One-to-one** (exactly one invoice per challan) |
| SalesOrder → Invoice | **One-to-many** (derived: one invoice per challan) |

An invoice **must** reference its originating Delivery Challan. Invoice
quantities **must** come from Delivery Challan line quantities — never directly
from the Sales Order.

### 3. Partial delivery rules

1. **Only `Approved` orders** may generate Delivery Challans.
2. Each challan line quantity **must not exceed** the remaining undelivered
   quantity for that product on the order
   (`orderLineQty − Σ priorChallanQtyForProduct ≥ thisChallanQty`).
3. Multiple challans against the same order are independent documents; each
   records a distinct shipment event.
4. A challan may cover **some or all** order lines; lines with zero shipped
   quantity are omitted from the challan.
5. Once a challan is **confirmed / dispatched**, its quantities are immutable.
   Corrections require a reversal workflow (future phase — not in PHASE_05A).
6. Order-level financial totals (`grandTotal`) are **not** reconciled at the
   challan layer; reconciliation happens at the invoice layer against challan
   quantities × agreed unit prices.

### 4. One Challan → One Invoice

- Every confirmed Delivery Challan generates **exactly one** Invoice.
- An Invoice **cannot** exist without a parent Delivery Challan.
- An Invoice **cannot** aggregate multiple challans.
- Invoice header amounts are calculated from **InvoiceItem** rows (see §5), not
  copied blindly from the order header.
- Invoice creation is blocked if the parent challan is not in a dispatchable
  terminal state (exact status enum deferred to PHASE_05A implementation).

This replaces the earlier mental model (ADR-007) of "split invoices directly
from the order." Partial billing is now **challan-driven**, not order-driven.

### 5. InvoiceItem requirement

`InvoiceItem` is **required** for every invoice. Header-only invoices are
forbidden.

Each `InvoiceItem` must capture at minimum:

| Field | Source |
|-------|--------|
| `productId` | Delivery Challan line |
| `quantity` | Delivery Challan line (exact match) |
| `unitPrice` | Sales Order line at time of order (historical price) |
| `discount` | Proportional allocation from order line discount |
| `total` | Decimal-safe calculation: `(qty × unitPrice) − discount` |

**Rationale:** Line-level invoicing is mandatory for accurate partial-shipment
accounting, product-level reporting, and audit. The header totals on `Invoice`
are **derived sums** of `InvoiceItem` rows, computed by the same Decimal engine
used for orders (`order-calculator` pattern).

### 6. Non-financial vs financial boundary

**Delivery Challan — NON-FINANCIAL. Must NEVER:**

- Update `Dealer.currentBalance`
- Create `LedgerEntry` rows
- Affect `DueReport` aggregates
- Accept or record `Collection` payments
- Count toward credit exposure

**Invoice — FINANCIAL. Must ALWAYS:**

- Update dealer balance (receivable created)
- Write ledger entries (debit receivable)
- Feed due-report calculations
- Be the attachment point for collections
- Count toward credit exposure at issue time

Any code path that creates or confirms a Delivery Challan **must not import or
call** ledger, balance, due, or collection services. This boundary is enforced
at the action layer in PHASE_05A.

### 7. Delivery logistics ownership

The following fields belong to **Delivery Challan**, not Invoice:

| Field | Purpose |
|-------|---------|
| `vehicleNo` | Transport vehicle registration |
| `driverName` | Person responsible for delivery |
| `deliveryMode` | `Truck` / `Courier` / `Pickup` / `Company_Delivery` |

These fields document **how goods moved**. They have no accounting meaning.
The current schema places them on `Invoice` (PHASE_00B legacy); a future schema
migration (PHASE_05A) will relocate them to `DeliveryChallan`. Until then,
application logic treats them as challan attributes regardless of column
location.

### 8. Credit-limit policy

Credit limit is evaluated **at Invoice issue**, not at order approval or challan
dispatch.

```
projectedExposure = dealer.currentBalance + invoice.grandTotal
if projectedExposure > dealer.creditLimit → block invoice issue
```

- Delivery Challan dispatch **does not** consume credit headroom.
- Order approval **does not** reserve credit (reservation is a future
  enhancement).
- Accounts and Manager roles may override credit block (RBAC-gated; audit-logged).
- SR cannot issue invoices.

### 9. Revenue recognition policy

Revenue is recognized **when the Invoice is issued**, not when:

- The Sales Order is approved
- The Delivery Challan is dispatched
- Goods are physically received by the dealer (no GRN module in scope)

```
Revenue event = Invoice.status transitions to Issued
```

Issued invoices create the receivable (`currentDue`, ledger debit). Draft
invoices are non-financial placeholders (same pattern as order Draft).

### 10. Order immutability rules after delivery

Once **any** Delivery Challan exists for an order:

| Action | Allowed? | Notes |
|--------|----------|-------|
| Edit order line quantities | ❌ | Would desync challan allocations |
| Edit order line prices | ❌ | Invoiced lines lock historical price |
| Add new order lines | ❌ | Would bypass challan tracking |
| Remove order lines | ❌ | Would orphan challan references |
| Cancel order | ❌ if any challan confirmed | Same as "cannot cancel invoiced" |
| Change dealer / project | ❌ | Immutable after first challan |

Before any challan: existing edit rules apply (Manager / Super_Admin may edit
approved orders per ADR-008).

The `Delivered` order status is set when **all** order line quantities have
been fully challaned (remaining qty = 0 for every line). Partial fulfillment
keeps the order in `Approved` until complete.

---

## Scope boundaries (this ADR — documentation only)

- **No schema changes** in this phase.
- **No migrations.**
- **No application code.**
- Schema evolution (DeliveryChallan model, InvoiceItem model, logistics field
  relocation) is deferred to PHASE_05A implementation planning.

---

## Consequences

- ADR-007 remains valid for `SalesOrder.invoices Invoice[]` cardinality, but
  the **business path** to multiple invoices is now always via Delivery Challans.
- ADR-008 workflow guards must gain challan-aware rules in PHASE_05A (cancel
  block, edit immutability).
- Invoice Engine (PHASE_05C) **cannot start** until Delivery Challan backend
  (PHASE_05A) and UI (PHASE_05B) are complete.
- `InvoiceItem` becomes a first-class entity; header-only invoices are rejected.
- Delivery reporting (challan register, pending-dispatch, fulfillment rate) is
  a future roadmap item after PHASE_05D.
- Existing `Invoice.deliveryMode` / `vehicleNo` / `driverName` columns will
  migrate to `DeliveryChallan` in a future schema phase.

---

## Future roadmap (post PHASE_05D)

| Item | Description |
|------|-------------|
| Delivery register | List/filter all challans by date, dealer, vehicle, status |
| Pending dispatch report | Approved orders with undelivered quantities |
| Fulfillment rate dashboard | % of order qty delivered vs ordered |
| Challan PDF | Printable dispatch document for driver / gate pass |
| Reversal / return challan | Correct erroneous dispatches (out of initial scope) |

---

## Verification

This is a governance-only ADR. Verification checklist for PHASE_05A
implementation (deferred):

- [ ] DeliveryChallan model with line items
- [ ] InvoiceItem model required on every invoice
- [ ] One challan → one invoice enforced at action layer
- [ ] Challan actions produce zero ledger/balance/due side effects
- [ ] Invoice issue produces ledger/balance/due side effects
- [ ] Partial delivery qty guards pass unit tests
- [ ] Order immutability after first challan enforced
- [ ] Logistics fields owned by challan
- [ ] Credit check at invoice issue only
- [ ] ADR-011 referenced in code comments / module README
