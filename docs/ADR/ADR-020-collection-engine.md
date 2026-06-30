# ADR-020: Collection Engine & Allocation

Date: 2026-06-28

Status: ACCEPTED

Phase: PHASE_06A2_COLLECTION_ENGINE_AND_ALLOCATION

Builds on: ADR-014, ADR-015, ADR-018, ADR-019

---

## Context

PHASE_06A1 delivered the Collections schema, DTOs, validators, and ADR-019
architecture. PHASE_06A2 implements the **backend Collection Engine**:

- Cash receipt workflow (Draft → Confirmed)
- Generic allocation engine (polymorphic `FinancialReferenceType`)
- Advance payment / negative dealer AR balance
- Financial posting via `postReceivableDecrease()`
- Collection reversal (immutable corrections)
- Audit events

No UI, receipt printing, reports, dashboards, or `LedgerEntry` rows in this
phase.

---

## Decision

### 1. Cash pool vs allocation accounting

Collection records **cash received**. Allocation records **how cash is applied**
to financial documents. They are intentionally separate concerns.

```
Cash Receipt (Collection.confirm)
        │
        ▼
   Cash Pool  (unallocatedAmount)
        │
        ▼
 Allocation Engine  (allocateCollection)
        │
        ▼
 Financial Documents  (Invoice today; others later)
```

**Amount invariant** (always enforced in transactions):

```
receivedAmount = allocatedAmount + unallocatedAmount
```

A confirmed collection may have **zero allocations** — the full
`unallocatedAmount` represents **advance payment** (dealer credit).

### 2. Collection lifecycle

```
Draft
  → Confirmed
      → PartiallyAllocated
      → Allocated
  → Reversed
```

| Status | Editable | Allocatable | Reversible |
|--------|----------|-------------|------------|
| Draft | Yes | No | Delete only (`cancelDraftCollection`) |
| Confirmed | No | Yes | Yes |
| PartiallyAllocated | No | Yes (until pool empty) | Yes |
| Allocated | No | No (pool = 0) | Yes |
| Reversed | No | No | No |

Collections are **immutable after confirmation**. Corrections use
`reverseCollection()` — nothing is hard-deleted except Draft cancellations.

### 3. Advance payment & negative AR balance

`Dealer.currentBalance` semantics (ADR-019):

| Sign | Meaning |
|------|---------|
| Positive | Dealer owes company |
| Negative | Company owes dealer (advance / credit) |

On **confirmation**, `postReceivableDecrease()` atomically decrements
`Dealer.currentBalance` by `receivedAmount`. Over-payment relative to open
invoices produces a **negative balance** — never rejected.

Example:

| Step | received | allocated | unallocated | Dealer balance |
|------|----------|-----------|-------------|----------------|
| Dealer owes 100,000 | — | — | — | +100,000 |
| Confirm 500,000 | 500,000 | 0 | 500,000 | −400,000 |
| Allocate 100,000 to invoice | 500,000 | 100,000 | 400,000 | −400,000 |

Balance changes on **cash confirmation** only. Invoice allocation moves amounts
within the pool without a second balance mutation.

### 4. Generic allocation engine

Location: `src/lib/collections/allocation-engine.ts`

Allocation is **not invoice-specific**. `CollectionAllocation` uses:

| Field | Purpose |
|-------|---------|
| `referenceType` | `FinancialReferenceType` enum |
| `referenceId` | Target document UUID |
| `allocatedAmount` | Amount applied |
| `allocationOrder` | Application sequence |

Reference resolution: `src/lib/collections/reference-resolver.ts`

| Type | Handler | Phase |
|------|---------|-------|
| `Invoice` | `resolveFinancialReference` + `applyInvoiceAllocation` | **06A2** |
| `OpeningBalance` | Deferred | Future |
| `CreditNote` | Deferred | Future |
| `DebitNote` | Deferred | Future |
| `ManualAdjustment` | Deferred | Future |
| `JournalEntry` | Deferred | Future |

Unique constraint `(collectionId, referenceType, referenceId)` blocks duplicate
allocation to the same document from one collection.

### 5. Allocation algorithm

For each allocation line:

```
invoiceOutstanding = currentDue − collectionReceived
applicableAmount   = min(requested, collection.unallocatedAmount, invoiceOutstanding)
```

Updates (single transaction, dealer row lock):

1. `Invoice.collectionReceived += applicableAmount`
2. `Invoice.currentDue -= applicableAmount`
3. `Invoice.status` → `Partial` / `Paid` when thresholds met
4. `Collection.allocatedAmount += applicableAmount`
5. `Collection.unallocatedAmount -= applicableAmount`
6. Create `CollectionAllocation` row
7. `AuditLog` → `COLLECTION_ALLOCATED`

Rejections:

- `allocation <= 0`
- `allocation > unallocatedAmount`
- `allocation > document outstanding`
- Duplicate `(collectionId, referenceType, referenceId)`
- Allocation to Draft / Reversed collection
- Allocation to `Paid` invoice

### 6. Financial posting service extension

Location: `src/lib/finance/posting-service.ts`

| Function | Purpose |
|----------|---------|
| `postReceivableDecrease()` | Decrement `Dealer.currentBalance` on cash confirm |
| `postReceivableDecreaseReversal()` | Increment balance on collection reversal |

Allocation invoice updates run through `reference-resolver.ts`; balance posting
on confirm uses `postReceivableDecrease()` with `applyDealerBalance: true`.

**No `LedgerEntry` rows** — extension point preserved for PHASE_07.

### 7. Concurrency & integrity

Reuses PHASE_05C2A dealer locking (`lockDealerForFinancialUpdate` — `SELECT … FOR
UPDATE`) at the start of every financial transaction:

- `confirmCollection`
- `allocateCollection`
- `deallocateCollection`
- `reverseCollection`

Additional guarantees:

- Idempotent `confirmCollection` when already `Confirmed`
- Amount invariant assertion after every pool mutation
- Atomic Prisma `{ decrement: amount }` / `{ increment: amount }` balance writes
- Duplicate allocation protection (application + DB unique index)

### 8. Reversal workflow

`reverseCollection()`:

1. Assert status ∈ {Confirmed, PartiallyAllocated, Allocated}
2. Lock dealer row
3. For each `CollectionAllocation`: reverse invoice fields (`COLLECTION_REVERSED_MISALLOCATION` audit)
4. `postReceivableDecreaseReversal()` — restore `receivedAmount` to dealer balance
5. Set `status = Reversed`, `reversedAt`, `reversalReason`
6. Delete allocation rows (collection header retained)
7. `COLLECTION_REVERSED` audit

Nothing is hard-deleted except allocation rows (reversal is a correction event,
not erasure of the cash receipt record).

### 9. Server actions

All actions return `ActionResult<T>` and enforce RBAC via `requirePermission`.

| Action | Permission |
|--------|------------|
| `createCollection` | `collections:create` |
| `updateCollection` | `collections:edit` |
| `confirmCollection` | `collections:edit` |
| `cancelDraftCollection` | `collections:delete` |
| `reverseCollection` | `collections:edit` |
| `allocateCollection` | `collections:edit` |
| `deallocateCollection` | `collections:edit` |
| `getCollection` / `listCollections` / `previewCollectionAllocation` | `collections:view` |

### 10. Audit events

| Action | AuditLog `action` |
|--------|-------------------|
| Create draft | `COLLECTION_CREATED` |
| Confirm cash | `COLLECTION_CONFIRMED` |
| Allocate | `COLLECTION_ALLOCATED` |
| Deallocate | `COLLECTION_DEALLOCATED` |
| Reverse (header) | `COLLECTION_REVERSED` |
| Reverse (per allocation) | `COLLECTION_REVERSED_MISALLOCATION` |
| Balance decrease | `DEALER_BALANCE_DECREASED` |

Payload fields: `collectionNo`, `dealerCode`, `allocatedAmount`,
`unallocatedAmount`, `referenceType`, `referenceId`, `actor`, `reason`,
`previousCollectionId`, `timestamp`.

---

## Future Work (explicitly deferred)

| Item | Phase |
|------|-------|
| Collection UI | PHASE_06B |
| Money receipt PDF | Future |
| Due reports | PHASE_08 |
| `LedgerEntry` posting | PHASE_07 |
| Non-invoice reference handlers | Future |

---

## Consequences

### Positive

- Enterprise separation of cash receipt vs allocation accounting
- Generic allocation engine ready for credit notes and adjustments
- Advance payment / negative AR formally supported
- Reversal workflow without mutating confirmed headers
- Consistent posting boundary with Invoice Engine

### Risks

| Risk | Mitigation |
|------|------------|
| Pool invariant drift | Asserted in every allocation transaction |
| Concurrent same-dealer mutations | Dealer `FOR UPDATE` lock |
| Polymorphic reference integrity | Per-type resolver with dealer match check |

---

## Verification

- `npx prisma generate` — OK
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors
- `npm test` — pass

---

## References

- ADR-014 — Invoice Engine (`collectionReceived`, `currentDue`)
- ADR-015 — Financial integrity & dealer lock
- ADR-019 — Collections foundation schema
- ADR-018 — Invoice production certification
