# ADR-012: Delivery Challan Backend Design

Date: 2026-06-25

Status: ACCEPTED (amended 2026-06-25 — architecture review)

Phase: PHASE_05A_DELIVERY_CHALLAN_BACKEND

Builds on: ADR-011 (fulfillment architecture), ADR-008 (order workflow)

Amends: ADR-011 §3 (quantity semantics), ADR-011 §10 (order immutability trigger)

---

## Context

ADR-011 approved the Order → Delivery Challan → Invoice pipeline and defined
business rules for partial delivery, non-financial boundaries, and order
immutability. PHASE_05A establishes the **backend foundation** — types,
validators, workflow guards, and schema design — without migrations, Prisma
model changes, server actions, or UI.

The existing schema (`SalesOrder`, `SalesOrderItem`, `Invoice`) has no
`DeliveryChallan` entities. Logistics fields (`deliveryMode`, `vehicleNo`,
`driverName`) currently live on `Invoice` (PHASE_00B legacy) and will relocate
in a future migration.

---

## Decision

### 1. Proposed schema additions (migration deferred)

The minimum schema surface to support ADR-011:

#### New enum: `DeliveryChallanStatus`

```prisma
enum DeliveryChallanStatus {
  Draft       // Created, editable, does not count toward delivered qty
  Confirmed   // Dispatched — quantities immutable, counts toward delivery
  Cancelled   // Voided — excluded from delivery totals (reversal workflow TBD)
}
```

#### New model: `DeliveryChallan`

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String @id @default(uuid())` | PK |
| `challanNo` | `String @unique` | Sequential `CHL-NNNNNN` |
| `orderId` | `String` | FK → `SalesOrder.id` |
| `dealerCode` | `String` | Denormalized from order for list queries |
| `status` | `DeliveryChallanStatus` | Lifecycle |
| `deliveryMode` | `DeliveryMode` | Relocated from `Invoice` |
| `vehicleNo` | `String?` | Relocated from `Invoice` |
| `driverName` | `String?` | Relocated from `Invoice` |
| `dispatchedAt` | `DateTime?` | Set on `Confirmed` |
| `createdById` | `String?` | FK → `User.id` |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |

Indexes: `@@index([orderId])`, `@@index([dealerCode])`, `@@index([status])`,
`@@index([createdAt])`, `@@index([dispatchedAt])`.

Back-relations:
- `SalesOrder.deliveryChallans DeliveryChallan[]`
- `Invoice.deliveryChallan DeliveryChallan?` (one-to-one, added in migration)

#### New model: `DeliveryChallanItem`

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String @id @default(uuid())` | PK |
| `challanId` | `String` | FK → `DeliveryChallan.id` |
| `orderItemId` | `String` | FK → `SalesOrderItem.id` |
| `productId` | `String` | Denormalized for reporting |
| `quantity` | `Decimal @db.Decimal(18,2)` | Shipped qty on this challan |

Indexes: `@@index([challanId])`, `@@index([orderItemId])`, `@@index([productId])`.

Unique constraint: none per line — multiple challans may reference the same
`orderItemId` across documents (partial delivery).

#### Future migration changes to existing models (not in PHASE_05A)

| Model | Change |
|-------|--------|
| `SalesOrder` | Add `deliveryChallans DeliveryChallan[]` |
| `SalesOrder` | `Delivered` status activated when all lines fully challaned |
| `Invoice` | Add `deliveryChallanId String @unique` + relation |
| `Invoice` | Remove `deliveryMode`, `vehicleNo`, `driverName` (after data migration) |
| `InvoiceItem` | New model (PHASE_05C) — required child of `Invoice` |

No `remainingQuantity` column is introduced on `SalesOrderItem`. Remaining
quantity is always derived (see §3).

### 2. Fulfillment workflow

```
Approved SalesOrder
       │
       ├─ createChallan (Draft)     ← validators + workflow guards
       │       │
       │       └─ confirmChallan (Confirmed)  ← sets dispatchedAt
       │               │
       │               └─ [PHASE_05C] createInvoice (one per challan)
       │
       └─ repeat until all lines delivered → OrderStatus.Delivered
```

**Cardinality (mandatory):**

| Relationship | Cardinality |
|--------------|-------------|
| SalesOrder → DeliveryChallan | One-to-many |
| DeliveryChallan → DeliveryChallanItem | One-to-many |
| DeliveryChallanItem → SalesOrderItem | Many-to-one |
| DeliveryChallan → Invoice | One-to-one (PHASE_05C) |

Server actions (`createChallan`, `confirmChallan`, etc.) are **deferred** to
the next sub-phase after this foundation lands. This ADR phase delivers only
types, validators, and workflow guards.

### 3. Quantity reconciliation strategy

Quantities are tracked through a **derived, not stored** model. Draft and
Confirmed challans serve **different business roles** and must not be conflated
in a single `remainingQuantity` formula.

#### 3a. Two derived quantities (mandatory separation)

| Concept | Formula | Used for |
|---------|---------|----------|
| `orderedQty` | `SalesOrderItem.quantity` | Baseline (persisted) |
| `deliveredQty` | `Σ qty` WHERE challan `status = Confirmed` | Fulfillment progress, completion detection, invoicing |
| `draftQty` | `Σ qty` WHERE challan `status = Draft` | Informational + capacity reservation only |
| **`remainingQty`** (display) | `orderedQty − deliveredQty` (clamped ≥ 0) | UI progress, pending-dispatch reports, `Delivered` status |
| **`allocatableQty`** (validation) | `orderedQty − deliveredQty − draftQty` (clamped ≥ 0) | Over-delivery guards on create/confirm/edit Draft |

**Recommendation (accepted):** Draft challans **do not** reduce `remainingQty`
in fulfillment progress DTOs. A Draft is intent to ship, not a dispatch event.
Only **Confirmed** challans represent physical fulfillment.

Draft challans **do** reduce `allocatableQty` when validating new or edited
challan lines so concurrent Draft documents cannot collectively exceed the
ordered quantity. Cancelling or deleting a Draft releases its reservation
immediately.

```
remainingQty   = ordered − confirmed     ← what the business calls "undelivered"
allocatableQty = ordered − confirmed − draft   ← guard rail only, not shown as "delivered"
```

**Why no persisted `remainingQuantity` column:**

1. **Single source of truth** — `SalesOrderItem.quantity` is the only persisted
   ordered qty; challan lines are append-only shipment events.
2. **No drift** — stored remaining qty would require compensating updates on
   every challan create / confirm / cancel.
3. **Audit clarity** — fulfillment state is reconstructible from challan history.

Implementation note: `computeRemainingQuantity()` (display) and
`computeAllocatableQuantity()` (validation) will be split when server actions
are wired. The initial `workflow.ts` conflated both; align to this ADR at
implementation time.

### 4. Over-delivery prevention

Before persisting any challan (create, update Draft, or confirm), server
actions will:

1. Load all `SalesOrderItem` rows for the parent order.
2. Aggregate `deliveredQty` (Confirmed) and `draftQty` (other Draft challans)
   per `orderItemId`, excluding the challan under edit when applicable.
3. Call `assertNotOverDelivery(orderLines, requestedLines)`.
4. Reject with `OVER_DELIVERY` when `requestedQty > allocatableQty` for any
   line, where `allocatableQty = ordered − confirmed − draft`.

On **confirm**, re-validate against the same rule before transitioning
`Draft → Confirmed` (a race between two confirming drafts must still be caught
inside the transaction).

Duplicate `orderItemId` entries within a single request are summed before the
comparison.

### 5. Order completion detection

After confirming a challan, the action layer will:

1. Recompute fulfillment progress for every order line using **display**
   semantics (`remainingQty = ordered − confirmed` only).
2. Call `isOrderFullyDelivered(lines)` — true when every line has
   `remainingQty === 0` (all qty confirmed on challans).
3. Call `isOrderPartiallyDelivered(lines)` — true when some `deliveredQty > 0`
   but not all lines are complete.
4. Call `resolveOrderStatusAfterDelivery()` — transitions `Approved → Delivered`
   only when fully delivered; partial fulfillment keeps `Approved`.

Draft challans alone never advance order completion. `Delivered` is a terminal
order status (already in schema, reserved since PHASE_04A).

### 6. Order immutability — Confirmed challans only

ADR-011 §10 stated immutability triggers on **any** challan. Architecture review
refines this: a Draft is abandonable and must not freeze the commercial order.

**Recommendation (accepted):** Order structural edits are blocked only after the
**first Confirmed** challan exists.

| Guard | Rule | Error code |
|-------|------|------------|
| `assertOrderLinesMutable(confirmedChallanCount)` | Block line qty / price / add / remove when `confirmedChallanCount > 0` | `ORDER_LINES_LOCKED` |
| `assertOrderHeaderMutable(confirmedChallanCount)` | Block dealer / project change when `confirmedChallanCount > 0` | `ORDER_LINES_LOCKED` |
| Order cancel (extend ADR-008) | Block cancel when any **Confirmed** challan or invoice exists | `ORDER_INVOICED` / `ORDER_HAS_DISPATCH` |

While only Draft challans exist:

| Action | Allowed? |
|--------|----------|
| Edit order lines (Manager / Super_Admin) | ✅ Yes — subject to `allocatableQty` not being violated by existing drafts |
| Cancel / delete Draft challans | ✅ Yes — releases capacity reservation |
| Cancel order | ✅ Yes — no confirmed dispatch yet |
| Create additional Draft challans | ✅ Yes — subject to over-delivery guards |

Once a challan is **Confirmed**, all line and header edits are permanently
blocked for that order (same table as ADR-011 §10). Historical prices on
confirmed lines are locked for future `InvoiceItem` generation.

Challan creation guards:

| Guard | Rule | Error code |
|-------|------|------------|
| `assertCanCreateChallan(status)` | Only `Approved` orders | `ORDER_NOT_APPROVED` / `ORDER_CANCELLED` / `ORDER_REJECTED` |
| `assertCanConfirmChallan(status)` | Only `Draft → Confirmed` | `CHALLAN_ALREADY_CONFIRMED` |

### 7. Non-financial boundary

Delivery Challan code paths **must never**:

- Update `Dealer.currentBalance`
- Create `LedgerEntry` rows
- Affect `DueReport` aggregates
- Record `Collection` payments
- Call `credit-limit` services

Enforced by module boundary: `src/lib/delivery/` has no imports from financial
modules. Server actions (future) will be audited in code review and ADR-012
verification checklist.

### 8. Backend artifacts delivered (PHASE_05A)

| Artifact | Path |
|----------|------|
| DTOs, error codes, action result types | `src/types/delivery-challan.ts` |
| Zod validation contracts | `src/lib/validators/delivery-challan.schema.ts` |
| Workflow + quantity guards | `src/lib/delivery/workflow.ts` |
| Architecture decision record | `docs/ADR/ADR-012-delivery-challan-backend.md` |

### 9. RBAC (deferred to server actions sub-phase)

Planned permission reuse from Orders module:

| Action | Permission |
|--------|------------|
| `createChallan` | `orders:create` |
| `confirmChallan` | `orders:edit` |
| `getChallan` / `listChallans` | `orders:view` |

Dedicated `delivery:*` permissions may be introduced in PHASE_05B if the nav
requires a separate resource.

### 10. Fulfillment Progress DTO (derived — no schema fields)

Progress is computed at read time and attached to `OrderDetailDTO` (PHASE_05B).
All quantities are fixed-precision decimal strings; `deliveryPercent` is a
decimal string in the range `"0.00"` – `"100.00"`.

#### Per-line: `OrderLineFulfillmentProgressDTO`

| Field | Type | Derivation |
|-------|------|------------|
| `orderItemId` | `string` | `SalesOrderItem.id` |
| `productId` | `string` | `SalesOrderItem.productId` |
| `productName` | `string` | Join |
| `productSku` | `string` | Join |
| `orderedQty` | `string` | `SalesOrderItem.quantity` |
| `deliveredQty` | `string` | `Σ confirmed challan qty` for this line |
| `remainingQty` | `string` | `orderedQty − deliveredQty` (≥ 0) |
| `deliveryPercent` | `string` | `(deliveredQty ÷ orderedQty) × 100`, 2 dp, half-up; `"0.00"` when `orderedQty = 0` |
| `draftQty` | `string` | `Σ draft challan qty` for this line (informational) |
| `isFullyDelivered` | `boolean` | `remainingQty === "0.00"` |

#### Order-level: `OrderFulfillmentProgressDTO`

| Field | Type | Derivation |
|-------|------|------------|
| `orderId` | `string` | `SalesOrder.id` |
| `lines` | `OrderLineFulfillmentProgressDTO[]` | One per order line |
| `totalOrderedQty` | `string` | `Σ orderedQty` across lines |
| `totalDeliveredQty` | `string` | `Σ deliveredQty` across lines |
| `totalRemainingQty` | `string` | `Σ remainingQty` across lines |
| `totalDraftQty` | `string` | `Σ draftQty` across lines (informational) |
| `deliveryPercent` | `string` | `(totalDeliveredQty ÷ totalOrderedQty) × 100`, 2 dp — **quantity-weighted**, not average of line percents |
| `isFullyDelivered` | `boolean` | Every line `isFullyDelivered` |
| `isPartiallyDelivered` | `boolean` | `totalDeliveredQty > 0` and not fully delivered |
| `draftChallanCount` | `number` | Challans with `status = Draft` |
| `confirmedChallanCount` | `number` | Challans with `status = Confirmed` |

`draftQty` / `totalDraftQty` are optional display fields for warehouse staff
("30 PCS pending dispatch on Draft CHL-000042"). They do not affect
`remainingQty` or `deliveryPercent`.

### 11. Invoice eligibility workflow

Invoice creation is **strictly challan-gated** (PHASE_05C). Recommended state
machine:

```
                    ┌─────────────┐
                    │    Draft    │──→ No invoice (blocked)
                    └──────┬──────┘
                           │ confirmChallan
                           ▼
                    ┌─────────────┐
                    │  Confirmed  │──→ Eligible for exactly one Invoice
                    └──────┬──────┘
                           │ createInvoice (PHASE_05C)
                           ▼
                    ┌─────────────┐
                    │  Invoiced*  │──→ Invoice exists; no second invoice
                    └─────────────┘

                    ┌─────────────┐
                    │  Cancelled  │──→ Never invoiceable
                    └─────────────┘
```

\*`Invoiced` is not a challan status — it is derived from `Invoice.deliveryChallanId`
being set. The challan remains `Confirmed`; `hasInvoice: true` on the DTO.

| Challan status | Invoice allowed? | Rule |
|----------------|------------------|------|
| `Draft` | ❌ No | Goods not dispatched; no receivable event |
| `Confirmed` | ✅ Yes (once) | `createInvoice` requires `status = Confirmed` AND `hasInvoice = false` |
| `Cancelled` | ❌ Never | Voided shipment; excluded from fulfillment and billing |

Additional guards for PHASE_05C:

- Invoice quantities **must** equal Confirmed challan line quantities exactly.
- Invoice `unitPrice` sourced from the parent `SalesOrderItem` (historical).
- Credit-limit check runs at invoice **issue**, not at challan confirm.
- Cancelling a Confirmed challan after invoice exists is out of scope (reversal
  workflow deferred post PHASE_05D).

---

## Consequences

- Schema migration is **blocked** until a database is available; all Prisma
  changes are documented here but not applied to `schema.prisma` in this phase.
- `src/lib/orders/workflow.ts` must gain `assertOrderLinesMutable` integration
  in `updateOrder` when server actions are wired — keyed on **confirmed**
  challan count, not total challan count.
- `src/lib/delivery/workflow.ts` must split display `remainingQty` from
  validation `allocatableQty` (initial foundation conflated the two).
- `OrderDetailDTO` will gain `fulfillment: OrderFulfillmentProgressDTO` per §10.
- Invoice Engine (PHASE_05C) requires `DeliveryChallan` tables and
  `Invoice.deliveryChallanId` before implementation.
- Challan number generator (`CHL-NNNNNN`) will mirror `order-number.ts` pattern.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Concurrent challan creation over-delivers | Transaction + `assertNotOverDelivery` using `allocatableQty` inside `prisma.$transaction` |
| Order edited while Draft challans reference old qty | Re-validate all Draft challans on order update; reject update if drafts would over-allocate |
| Stale Draft challans accumulate | UI shows `draftQty`; periodic cleanup / cancel Draft workflow in PHASE_05B |
| Legacy logistics fields on `Invoice` | Dual-location during migration; challan actions own logistics; invoice migration strips columns |
| `Delivered` status set incorrectly | Only `confirmed` qty counts; transition only from `Approved` |
| Invoice created from Draft | Hard guard: `status === Confirmed` required in `createInvoice` |
| No reversal workflow | Cancelled challan status reserved; reversal deferred post PHASE_05D |

---

## Verification (this phase)

- [x] `DeliveryChallan` + `DeliveryChallanItem` schema proposed (not migrated)
- [x] DTOs and error codes defined
- [x] Zod validators created (create / confirm / list / identify)
- [x] Workflow guards: over-delivery, order status, completion detection
- [x] Quantity strategy documented — split `remainingQty` (display) vs `allocatableQty` (validation)
- [x] Order immutability refined — Confirmed challans only (amends ADR-011 §10)
- [x] Fulfillment Progress DTO structure documented (§10)
- [x] Invoice eligibility workflow documented (§11)
- [x] ADR-012 created
- [x] Governance docs updated
- [ ] Server actions (deferred)
- [ ] `npx prisma migrate` (deferred)
- [ ] Order workflow integration in `updateOrder` (deferred)
- [ ] Unit tests for workflow guards (deferred to actions sub-phase)

---

## References

- ADR-011 — Fulfillment layer architecture
- ADR-008 — Order backend workflow
- ADR-007 — One order → many invoices (via challans)
- `src/types/delivery-challan.ts`
- `src/lib/validators/delivery-challan.schema.ts`
- `src/lib/delivery/workflow.ts`
