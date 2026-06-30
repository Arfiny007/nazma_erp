# ADR-019: Collections Foundation — Schema & Architecture

Date: 2026-06-28

Status: ACCEPTED

Phase: PHASE_06A1_COLLECTIONS_SCHEMA_FOUNDATION

Builds on: ADR-011, ADR-014, ADR-015, ADR-018

---

## Context

PHASE_05 delivered the Invoice Engine and enterprise invoice UI/document
pipeline. Invoice production is certified (ADR-018, readiness 9.0/10).

PHASE_06 introduces **Collections** — cash received from dealers against
accounts receivable. This sub-phase establishes **only** the database schema,
domain types, validation contracts, and architectural decisions. No server
actions, allocation engine, posting, UI, or ledger work is in scope.

Enterprise ERP reference models: SAP Business One, Oracle NetSuite, Microsoft
Dynamics 365 Business Central, Odoo Enterprise.

---

## Decision

### 1. AR Balance semantics — `Dealer.currentBalance`

From this phase onward, `Dealer.currentBalance` is formally defined as the
**Accounts Receivable (AR) Balance**. The field name is **not renamed**; only
its meaning is standardized and documented.

| Sign | Meaning |
|------|---------|
| **Positive** | Dealer owes the company (outstanding receivable) |
| **Zero** | Fully settled |
| **Negative** | Company owes the dealer — advance payment / customer credit |

**Negative AR balance** represents a **company liability** (dealer credit).
Future invoices may consume this credit without additional cash collection.

All balance mutations continue to flow exclusively through the Financial
Posting Service (`src/lib/finance/posting-service.ts`). Collections will add
`postReceivableDecrease()` in PHASE_06A2; this phase does not implement it.

### 2. Collection architecture — cash pool separation

Collections and allocations are **intentionally separated**:

```
Collection (cash received)
        │
        ▼
   Cash Pool  (unallocatedAmount)
        │
        ▼
 Allocation Engine  (PHASE_06A2)
        │
        ▼
 Financial Documents  (Invoice, Credit Note, …)
```

A **Collection** records cash received. It does **not** represent payment
allocation. Allocation is modeled in `CollectionAllocation` and executed
by a future allocation engine.

### 3. Collection model

| Field | Purpose |
|-------|---------|
| `collectionNo` | Unique business identifier (replaces legacy `receiptNo`) |
| `dealerCode` | Paying dealer |
| `collectionDate` | Value date of receipt |
| `paymentMethod` | `CollectionPaymentMethod` enum |
| `referenceNumber` | Cheque / transfer / transaction reference |
| `bankName` | Depositing bank when applicable |
| `receivedAmount` | Total cash received |
| `allocatedAmount` | Sum allocated to financial documents |
| `unallocatedAmount` | Cash pool remainder |
| `status` | Lifecycle (`Draft` → `Confirmed` → allocation states → `Reversed`) |
| `isAdvancePayment` | Flag when receipt exceeds immediate allocation need |
| `confirmedAt` / `confirmedById` | Immutability boundary |
| `reversedAt` / `reversedCollectionId` / `reversalReason` | Correction via reversal |

**Amount invariant** (enforced in PHASE_06A2 workflow):

```
receivedAmount = allocatedAmount + unallocatedAmount
```

**Advance payment:** `receivedAmount` may exceed `allocatedAmount`. The
remainder stays in `unallocatedAmount` as dealer credit (cash pool).

**Immutability:** Collections are immutable after confirmation. Corrections
occur only through **Reversal** — never by editing confirmed records.

### 4. Generic allocation abstraction — `CollectionAllocation`

Allocation is **not invoice-specific**. `CollectionAllocation` uses a
polymorphic reference:

| Field | Purpose |
|-------|---------|
| `referenceType` | `FinancialReferenceType` enum |
| `referenceId` | UUID of the target document |
| `allocatedAmount` | Amount applied |
| `allocationOrder` | Application sequence (oldest-first policies in PHASE_06A2) |

**Supported reference types (today and future):**

| `FinancialReferenceType` | Phase |
|--------------------------|-------|
| `Invoice` | PHASE_06A2 |
| `OpeningBalance` | Future |
| `CreditNote` | Future |
| `DebitNote` | Future |
| `ManualAdjustment` | Future |
| `JournalEntry` | Future |

Unique constraint: `(collectionId, referenceType, referenceId)` — one
allocation row per document per collection.

No schema redesign is required when new document types are added; only enum
values and allocation-engine handlers.

### 5. Collection lifecycle — `CollectionStatus`

```
Draft
  → Confirmed
      → PartiallyAllocated
      → Allocated
  → Reversed  (from Confirmed / PartiallyAllocated / Allocated)
```

Status transitions and guards are implemented in PHASE_06A2.

### 6. Payment method — `CollectionPaymentMethod`

Distinct from legacy `PaymentMethod` enum (retained for backward compatibility
elsewhere). Collection-specific values:

`Cash`, `Bank`, `Cheque`, `MobileBanking`, `OnlineTransfer`, `Other`

### 7. Dealer reporting foundation

New `Dealer` fields prepare future dashboards without computation in this phase:

| Field | Ownership | Future use |
|-------|-----------|------------|
| `monthlyTarget` | Dealer master | SR / manager target tracking |
| `yearlyTarget` | Dealer master | Annual quota reporting |
| `totalSales` | Denormalized aggregate | Sales performance dashboard |
| `lastCollectionDate` | Updated on collection confirm | Collection recency |
| `lastInvoiceDate` | Updated on invoice issue | Billing recency |

**No calculations or dashboard logic** in PHASE_06A1.

### 8. Legacy `Collection` model replacement

The init-schema `Collection` model (direct `invoiceId`, `receiptNo`, `amount`)
is **replaced** by the enterprise design above. The direct `Invoice.collections`
relation is removed; invoice payments link through `CollectionAllocation` with
`referenceType = Invoice`.

### 9. DTO foundation

Types in `src/types/collection.ts`:

- `CollectionDTO` / `CollectionDetailDTO`
- `CollectionAllocationDTO`
- `CollectionListItemDTO`
- `DealerFinancialSummaryDTO`
- `AdvancePaymentSummaryDTO`
- `ActionResult<T>` envelope (consistent with Order / Invoice modules)

Monetary values exposed as fixed-precision decimal strings.

### 10. Validator foundation

Schemas in `src/lib/validators/collection.schema.ts`:

- `createCollectionSchema`
- `updateCollectionSchema`
- `listCollectionsSchema`
- `collectionIdentifierSchema`
- `allocationPreviewSchema`
- `reversalSchema`

Validation contracts only — no business-rule enforcement.

---

## Future Work (explicitly deferred)

| Item | Phase |
|------|-------|
| `createCollection()` / `confirmCollection()` server actions | PHASE_06A2 |
| Allocation engine | PHASE_06A2 |
| `postReceivableDecrease()` | PHASE_06A2 |
| Dealer balance mutation on collection | PHASE_06A2 |
| Invoice `collectionReceived` / status updates | PHASE_06A2 |
| Reversal workflow | PHASE_06A3+ |
| Collection UI | PHASE_06B |
| Ledger posting | PHASE_07 |
| Receipt PDF | Future |

---

## Consequences

### Positive

- Enterprise-grade separation of cash receipt vs allocation
- Generic allocation supports credit notes, opening balances, adjustments
- AR balance semantics formally documented before collection posting
- Dealer reporting fields ready without blocking PHASE_06A2
- Consistent DTO / validator / ActionResult patterns

### Negative / trade-offs

- Migration drops legacy `Collection` table (no production data assumed)
- `PaymentMethod` enum retained but unused by new Collection model
- `unallocatedAmount` must be kept in sync by application logic (not a DB check)

### Risks

| Risk | Mitigation |
|------|------------|
| Amount invariant drift | Enforced in allocation engine transaction (PHASE_06A2) |
| Concurrent allocation | Dealer row lock pattern from ADR-015 / PHASE_05C2A |
| Polymorphic reference integrity | Allocation engine validates reference exists per type |

---

## Verification

- `npx prisma format` — schema valid
- `npx prisma generate` — client regenerated
- `npx prisma migrate dev` — migration applied
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors

---

## References

- ADR-011 — Fulfillment pipeline (Collection in commercial chain)
- ADR-014 — Invoice Engine (`collectionReceived`, `currentDue`)
- ADR-015 — Financial integrity (posting service extension point)
- ADR-018 — Invoice production certification (Collections readiness)
