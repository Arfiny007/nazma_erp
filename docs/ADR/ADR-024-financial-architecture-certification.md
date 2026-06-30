# ADR-024: Financial Architecture Certification — PHASE_06D

Date: 2026-06-30

Status: ACCEPTED

Phase: PHASE_06D_FINANCIAL_ARCHITECTURE_CERTIFICATION

Builds on: ADR-011 through ADR-023

---

## Context

PHASE_01 through PHASE_06C delivered the full commercial → fulfillment →
financial → document pipeline:

```
Sales Order → Delivery Challan → Invoice → Collection → Allocation
    → Money Receipt → Dealer Balance → Financial Posting Service
```

Before PHASE_07 (Ledger Engine), a Chief ERP Architect review was required to
certify that every financial decision made to date can support an
enterprise-grade accounting system **without future refactoring**.

This phase is **architecture certification only**. No code, migrations, server
actions, or UI were created or modified.

---

## Executive Summary

**Verdict: ARCHITECTURALLY CERTIFIED for PHASE_07 Ledger implementation**

The Nazma ERP financial pipeline follows enterprise ERP patterns comparable to
SAP Business One, Oracle NetSuite, Microsoft Dynamics 365 Business Central, and
Odoo Enterprise:

- Immutable financial documents with snapshot discipline
- Single Financial Posting Service boundary for balance mutations
- Compensating reversal model for collections
- Generic polymorphic allocation engine
- Advance payment / negative AR balance formally supported
- Dealer row locking and atomic Decimal operations for concurrency

**Overall ERP production readiness score: 8.7 / 10**

No blocking architectural defects were found. PHASE_07 may proceed with
extension of the existing posting service — not replacement.

---

## 1. Financial Architecture Assessment

### Pipeline review

| Stage | Financial impact | Boundary | Certification |
|-------|------------------|----------|---------------|
| Sales Order | None (commercial only) | No `finance/` imports | ✅ PASS |
| Delivery Challan | Explicitly non-financial | ADR-011, ADR-012 | ✅ PASS |
| Invoice | Receivable increase | `postReceivableIncrease()` | ✅ PASS |
| Collection confirm | Receivable decrease (cash) | `postReceivableDecrease()` | ✅ PASS |
| Allocation | Pool movement only; no second balance post | `reference-resolver` | ✅ PASS |
| Money Receipt | Display only; server-sourced values | ADR-023 | ✅ PASS |
| Dealer Balance | Denormalized AR cache | `posting-service.ts` sole writer | ✅ PASS |
| Financial Posting | Central mutation boundary | 3 posting functions today | ✅ PASS |
| Ledger | Schema exists; posting deferred | `LedgerEntry` model (unused) | ⚠️ READY |

### Architectural strengths

1. **Separation of concerns** — logistics (challan) vs receivables (invoice) vs
   cash (collection) vs application (allocation) are distinct layers.
2. **Single write path** — grep-verified: only `posting-service.ts` mutates
   `Dealer.currentBalance`.
3. **Immutability after confirmation** — issued invoices, confirmed collections,
   and `InvoiceItem` snapshots are not edited; corrections use reversal or
   future credit notes.
4. **Decimal discipline** — all monetary DB fields use `Decimal(18,2)`; Prisma
   atomic `{ increment }` / `{ decrement }`.
5. **Concurrency controls** — `lockDealerForFinancialUpdate()` (`SELECT … FOR
   UPDATE`) on all financial mutations; idempotent invoice issue and collection
   confirm.
6. **Extension points** — `FinancialReferenceType` enum, polymorphic
   `CollectionAllocation`, document platform, posting service callbacks ready for
   ledger lines.

### Architectural gaps (non-blocking for PHASE_07 start)

| Gap | Impact | Phase |
|-----|--------|-------|
| No Chart of Accounts | Trial Balance, P&L, Balance Sheet impossible | PHASE_07+ |
| `LedgerEntry.referenceType` is `String`, not enum | Type drift risk | PHASE_07A schema hardening |
| No invoice reversal / credit note | Cannot void issued invoices | PHASE_07B or dedicated phase |
| `CollectionAllocation` hard-deleted on reversal | Historical allocation list incomplete | Optional soft-delete |
| `totalSales` on Dealer not computed | Sales analytics incomplete | Reporting phase |
| No collection concurrency integration tests | Lower confidence under load | Pre-production hardening |

---

## 2. Source-of-Truth Recommendation

### Enterprise hierarchy (recommended)

```
┌─────────────────────────────────────────────────────────────┐
│  TIER 1 — AUTHORITATIVE (accounting truth)                  │
│  LedgerEntry (PHASE_07) — append-only journal subledger     │
│  + future ChartOfAccounts for full GL                       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│  TIER 2 — DOCUMENT TRUTH (business event records)           │
│  Invoice, Collection, CollectionAllocation                  │
│  Future: CreditNote, DebitNote, OpeningBalance, Journal     │
│  Immutable headers + snapshots after confirmation/issue     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│  TIER 3 — OPERATIONAL CACHE (performance / UX)              │
│  Dealer.currentBalance — AR running total                   │
│  Invoice.currentDue / collectionReceived — invoice subledger│
│  Collection pool fields — cash application state            │
└─────────────────────────────────────────────────────────────┘
```

### Field-by-field determination

| Field / Entity | Role | Recommendation |
|----------------|------|----------------|
| `LedgerEntry` (future) | **Primary accounting source of truth** | Authoritative for dealer subledger, audit, and financial statements once PHASE_07 posts all events |
| `Invoice` + `InvoiceItem` | Document source of truth for billing | Immutable lines; header dues mutable only via allocation/reversal |
| `Collection` | Document source of truth for cash receipt | Confirmed headers retained forever; `Reversed` status marks void |
| `CollectionAllocation` | Application subledger | Truth while active; audit supplements after reversal deletion |
| `Dealer.currentBalance` | **Cached balance** | Fast lookup, credit limit, UI badges — **must reconcile to ledger** |
| `Invoice.currentDue` | **Derived document balance** | `previousDue + grandTotal − collectionReceived` equivalent; optimized for due reports |

### Recommendation

**Do not** treat `Dealer.currentBalance` as the primary accounting source.
Treat it as a **denormalized operational cache** maintained exclusively by the
Financial Posting Service, reconcilable against the sum of ledger entries.

This matches NetSuite/Odoo patterns: subsidiary ledger documents + GL journal +
cached customer balance for performance.

**PHASE_07 must add:** a nightly or on-demand reconciliation check:
`Dealer.currentBalance === last LedgerEntry.balance` for each dealer.

---

## 3. Financial Posting Strategy

### Mandate

**ALL future financial operations MUST pass through `posting-service.ts`.**

Direct `Dealer.currentBalance` updates from feature code remain forbidden.

### Current posting functions

| Function | Event | Balance effect |
|----------|-------|----------------|
| `postReceivableIncrease()` | Invoice issue | `+ grandTotal` |
| `postReceivableDecrease()` | Collection confirm | `− receivedAmount` |
| `postReceivableDecreaseReversal()` | Collection reverse | `+ receivedAmount` |

### Required future posting functions (same module)

| Operation | Proposed function | Balance effect | Ledger (PHASE_07) |
|-----------|-------------------|----------------|-------------------|
| Opening balance | `postOpeningBalance()` | Set initial AR | Dr/Cr AR + equity |
| Credit note | `postCreditNote()` | `− credit amount` | Compensating entry |
| Debit note | `postDebitNote()` | `+ debit amount` | Additional charge |
| Sales return | `postSalesReturn()` | `− return amount` | Via credit note path |
| Manual adjustment | `postManualAdjustment()` | `± amount` | Controlled Dr/Cr |
| Journal entry | `postJournalEntry()` | Per line allocation | Multi-account |
| Invoice reversal | `postInvoiceReversal()` | `− grandTotal` | Compensating entry |

### Posting flow architecture

```
Business Action (issueInvoice, confirmCollection, …)
        │
        ▼
   Workflow Guards + Dealer Lock
        │
        ▼
   Document Persistence (Invoice, Collection, …)
        │
        ▼
   Financial Posting Service
        ├── Update Dealer.currentBalance (atomic)
        ├── Create LedgerEntry row(s)     ← PHASE_07
        └── Write AuditLog
        │
        ▼
   Document-level fields (currentDue, pool amounts)
        │
        ▼
   Commit Transaction
```

### Allocation exception (by design)

Invoice allocation **does not** call the posting service for balance changes.
Cash was already posted on collection confirmation. Allocation only:

- Moves amounts within the collection pool
- Updates `Invoice.collectionReceived` and `currentDue`
- Creates `CollectionAllocation` rows

This is correct ERP accounting: **cash receipt ≠ application**.

### Idempotency requirement

Every posting function must accept a `postingKey` or derive one from
`(referenceType, referenceId, postingType)` to prevent duplicate ledger lines
on retry.

---

## 4. Future Ledger Architecture

### Design principles (PHASE_07 — not implemented)

1. **Append-only** — ledger entries are never updated or deleted.
2. **Compensating reversals** — corrections create offsetting entries linked to
   the original via `reversesEntryId`.
3. **Posted from posting service only** — no feature code writes `LedgerEntry`
   directly.
4. **Dealer subledger first** — single-account AR subledger before full
   multi-account GL.

### LedgerEntry model responsibilities

The existing `LedgerEntry` model provides a foundation. PHASE_07A should extend:

| Field | Purpose |
|-------|---------|
| `dealerCode` | Subledger owner (AR customer) |
| `transactionDate` | Value date for statement ordering |
| `postingDate` | System posting timestamp |
| `referenceType` | Align to `FinancialReferenceType` enum |
| `referenceId` | Source document UUID |
| `referenceNo` | Human-readable (`INV-000001`, `COL-000001`) |
| `debit` | Amount increasing dealer obligation |
| `credit` | Amount decreasing dealer obligation |
| `balance` | Running AR balance after this entry |
| `postingType` | `Issue`, `Collection`, `Reversal`, `OpeningBalance`, … |
| `reversesEntryId` | Link to original entry for compensating posts |
| `postingKey` | Idempotency unique constraint |
| `remarks` | Narration |
| `createdById` | Actor audit |

Recommended unique index: `@@unique([postingKey])` or
`@@unique([referenceType, referenceId, postingType])`.

### Debit / credit model (dealer AR subledger)

For **Accounts Receivable — dealer subledger**:

| Event | Debit (Dr) | Credit (Cr) | Balance effect |
|-------|------------|-------------|----------------|
| Invoice issue | `grandTotal` | 0 | Balance ↑ (dealer owes more) |
| Collection | 0 | `receivedAmount` | Balance ↓ |
| Collection reversal | `receivedAmount` | 0 | Balance ↑ |
| Credit note | 0 | `creditAmount` | Balance ↓ |
| Debit note | `debitAmount` | 0 | Balance ↑ |
| Opening balance (dealer owes) | `amount` | 0 | Balance ↑ |
| Opening balance (advance) | 0 | `amount` | Balance ↓ (negative AR) |

**Sign convention:** positive `balance` = dealer owes company (matches
`Dealer.currentBalance` semantics per ADR-019).

### Running balance

Each `LedgerEntry.balance` = previous entry balance + debit − credit for that
dealer, computed inside the posting transaction after dealer lock.

Posting order within a transaction:

1. Lock dealer row (`FOR UPDATE`)
2. Read last `LedgerEntry.balance` (or `Dealer.currentBalance` during migration)
3. Compute new running balance
4. Insert `LedgerEntry`
5. Update `Dealer.currentBalance` atomically
6. Assert `LedgerEntry.balance === Dealer.currentBalance`

### Opening balance

- New `OpeningBalance` document type (or dealer field migration row)
- Single posting event per dealer at go-live or onboarding
- Creates first `LedgerEntry` with `postingType = OpeningBalance`
- Negative opening = advance credit (credit entry)

### Closing balance

- **Period closing** is a reporting concept, not a mutation
- Closing balance at date D = last `LedgerEntry` where
  `transactionDate ≤ D`
- No destructive "close books" that alters entries

### Posting order (global)

Ledger entries for a dealer must be totally ordered by:

1. `transactionDate` ASC
2. `postingDate` ASC
3. `id` ASC (tie-breaker)

Concurrent postings for the same dealer are serialized by dealer row lock.

### Audit strategy

- Every `LedgerEntry` created in the same transaction as `AuditLog`
- `AuditLog` references `ledgerEntryId` in payload
- Ledger is immutable; audit chain is supplementary

### Reversal strategy

| Document | Current | Recommended (enterprise) |
|----------|---------|--------------------------|
| Collection | Compensating `postReceivableDecreaseReversal()` + status `Reversed` | ✅ Correct — retain model |
| Invoice | Not implemented | `postInvoiceReversal()` → compensating ledger entry; invoice status `Voided` or link to credit note |
| Allocation | `deallocateCollection()` reverses invoice fields | Compensating allocation reversal row (optional soft-delete) |
| Credit note | Future | New document + `postCreditNote()` — never edit original invoice |
| Journal | Future | Compensating journal with `reversesEntryId` |

**Never** hard-delete financial documents or ledger entries. **Never** rewrite
historical `InvoiceItem` rows.

---

## 5. Dealer Statement Architecture

### Recommended source: **Hybrid**

| Layer | Source | Purpose |
|-------|--------|---------|
| **Running balance column** | `LedgerEntry` (PHASE_07+) | Authoritative, auditable running total |
| **Line item detail** | Documents (`Invoice`, `Collection`, future notes) | Business-readable descriptions, PDF export |
| **Pre-ledger fallback** | Replay formula below | Valid until ledger backfill complete |

### Pre-ledger reconstruction formula

```
runningBalance(0) = openingBalance (future)
for each event ordered by date:
  + Invoice.grandTotal        (status ≠ Voided)
  − Collection.receivedAmount   (status ∉ {Draft, Reversed})
  ± Manual adjustments (future)
```

Cross-check: result must equal `Dealer.currentBalance`.

### Why not documents-only?

- `Invoice.currentDue` mutates on allocation — not suitable alone for historical
  replay without also reading allocations
- `CollectionAllocation` rows deleted on reversal — audit required for full history
- Documents lack a single running balance column optimized for statement PDF

### Why not ledger-only?

- Accountants require invoice numbers, payment methods, and line context
- Document platform (`DocumentTable`, `DocumentFinancialSummary`) already
  supports statement PDF composition (ADR-023 §Future extensibility)

### Statement line types (target)

| Type | Document | Debit | Credit |
|------|----------|-------|--------|
| Opening Balance | OpeningBalance | ± | ± |
| Invoice | Invoice | amount | — |
| Collection | Collection | — | amount |
| Credit Note | CreditNote | — | amount |
| Debit Note | DebitNote | amount | — |
| Reversal | Compensating entry | ± | ± |

---

## 6. Generic Allocation Certification

### Current state

`CollectionAllocation` with polymorphic `(referenceType, referenceId)`:

| Type | Handler | Status |
|------|---------|--------|
| `Invoice` | `resolveFinancialReference` + `applyInvoiceAllocation` | ✅ Implemented |
| `OpeningBalance` | — | Enum reserved |
| `CreditNote` | — | Enum reserved |
| `DebitNote` | — | Enum reserved |
| `ManualAdjustment` | — | Enum reserved |
| `JournalEntry` | — | Enum reserved |

### Certification verdict: **CERTIFIED — no redesign required**

Adding future types requires only:

1. Register handler in `reference-resolver.ts`
2. Implement `apply*Allocation` / `reverse*Allocation`
3. Define outstanding amount semantics per document type
4. Optionally extend allocation preview DTO

The unique constraint `(collectionId, referenceType, referenceId)` and pool
invariant `receivedAmount = allocatedAmount + unallocatedAmount` are
type-agnostic.

### Future compatibility notes

| Type | Outstanding semantics | Balance post timing |
|------|----------------------|---------------------|
| OpeningBalance | Remaining unallocated opening | On opening document confirm |
| CreditNote | Remaining credit value | On credit note issue |
| DebitNote | Remaining debit value | On debit note issue |
| ManualAdjustment | Signed adjustment amount | On adjustment confirm |
| JournalEntry | Per-line AR allocation | On journal post |

Collections may allocate to credit notes (reduce credit) or debit notes (apply
payment against charge) using the same engine.

---

## 7. Advance Payment Certification

### Architecture (ADR-019, ADR-020, ADR-021)

| Concern | Implementation | Certified |
|---------|----------------|-----------|
| Advance cash receipt | Full `receivedAmount` posted on confirm | ✅ |
| Advance allocation | Pool movement; no second balance post | ✅ |
| Negative `Dealer.currentBalance` | Atomic decrement; no floor | ✅ |
| `isAdvancePayment` flag | Set when `unallocatedAmount > 0` | ✅ |
| Money receipt display | Advance-retained message when no allocations | ✅ |
| UI treatment | Blue "Advance Credit" badge — not error styling | ✅ |

### Example (verified in ADR-020)

| Step | received | allocated | unallocated | Dealer balance |
|------|----------|-----------|-------------|----------------|
| Dealer owes 100,000 | — | — | — | +100,000 |
| Confirm 500,000 | 500,000 | 0 | 500,000 | −400,000 |
| Allocate 100,000 to invoice | 500,000 | 100,000 | 400,000 | −400,000 |

### Future statement compatibility

- Statement shows collection (credit) on confirm date
- Running balance goes negative — correct representation of company liability
- Future invoices consume advance by reducing balance toward zero without new
  cash collection

### Future ledger compatibility

- Collection confirm: Cr AR (credit entry), Cr Cash/Bank in full GL
- Advance portion: unallocated pool maps to **Customer Deposits** liability
  account in multi-account GL (PHASE_07+ extension)

**Verdict: CERTIFIED** — no architectural change needed.

---

## 8. Reporting Readiness Assessment

### Operational reports (ready — no schema redesign)

| Report | Primary sources | Status |
|--------|-----------------|--------|
| Dealer Statement | Ledger (07+) + Invoice + Collection + AuditLog | ✅ Architecture ready |
| Due Report | `Invoice.currentDue`, `dueDate`, `status` | ✅ Ready |
| Aging Report | `Invoice.dueDate`, `grandTotal − collectionReceived` | ✅ Ready |
| Collection Report | `Collection` + `CollectionAllocation` | ✅ Ready |
| Cash Book | `Collection` by `collectionDate`, `paymentMethod` | ✅ Ready |
| Sales Report | `Invoice` + `InvoiceItem` snapshots | ✅ Ready |
| Monthly Report | Date-indexed invoices + collections | ✅ Ready |
| Annual Report | Same + `Dealer.yearlyTarget` | ✅ Ready |
| Territory Analytics | `Dealer.territory` + invoice/collection joins | ✅ Ready |
| Dealer Analytics | `Dealer` foundation fields + aggregates | ⚠️ `totalSales` not computed |
| Management Dashboard | Above aggregates | ⚠️ Needs reporting layer |

### Financial statements (architectural requirements missing)

| Report | Requirement | Status |
|--------|-------------|--------|
| Trial Balance | Chart of Accounts + multi-account `LedgerEntry` | ❌ Not yet designed |
| General Ledger | Account dimension on ledger | ❌ Not yet designed |
| Profit & Loss | Revenue/expense account mapping | ❌ Requires COA |
| Balance Sheet | Asset/liability/equity accounts | ❌ Requires COA |

### Recommended indexes (non-blocking)

- `Collection(dealerCode, collectionDate)`
- `Invoice(dealerCode, issueDate)`
- `LedgerEntry(dealerCode, transactionDate)` — exists partially

### Missing architectural requirements for full accounting

1. **Chart of Accounts** model with account types (Asset, Liability, Equity,
   Revenue, Expense)
2. **Account dimension** on `LedgerEntry` (or separate `JournalLine` model)
3. **Fiscal period** model for period close reporting
4. **Reconciliation service** — `currentBalance` vs ledger vs document replay
5. **Denormalized reporting snapshots** (optional) — `DueReport` model exists
   but is unused; suitable for scheduled aging snapshots

---

## 9. Accounting Rules Verification

| Rule | Evidence | Result |
|------|----------|--------|
| No destructive financial updates | Confirmed collections immutable; invoice lines immutable | ✅ PASS |
| Immutable financial documents | `InvoiceItem` snapshots; collection headers retained on reversal | ✅ PASS |
| Snapshot strategy | `previousDue` at issue; product/price snapshots on lines | ✅ PASS |
| Audit trail completeness | `INVOICE_*`, `COLLECTION_*`, `DEALER_BALANCE_*` events | ✅ PASS |
| Concurrency safety | Dealer `FOR UPDATE`; atomic increment/decrement | ✅ PASS |
| Balance consistency | Post-write equality assertion in posting service | ✅ PASS |
| Idempotency | Invoice issue + collection confirm idempotent paths | ✅ PASS |
| Reference integrity | FK on dealer; unique allocation constraint; dealer match in resolver | ✅ PASS |
| Posting consistency | Single posting service; allocation does not double-post | ✅ PASS |
| Compensating reversals | Collection reversal restores balance + invoice fields | ✅ PASS |
| No invoice reversal yet | Gap — future credit note required | ⚠️ GAP |
| Allocation history on reversal | Rows deleted; audit preserves amounts | ⚠️ ACCEPTED RISK |

---

## 10. Identified Risks

| Priority | Risk | Mitigation | Blocking? |
|----------|------|------------|-----------|
| Medium | No invoice void / credit note | Implement in PHASE_07B or dedicated phase | No for ledger start |
| Medium | `LedgerEntry` schema stale (`referenceType` String, no `postingKey`) | PHASE_07A schema hardening | No |
| Medium | Full GL (TB/P&L/BS) not architected | PHASE_07+ COA design | No for AR subledger |
| Low | `CollectionAllocation` hard-deleted on reversal | Audit is source of truth; optional soft-delete | No |
| Low | No collection concurrency integration tests | Mirror invoice tests from PHASE_05C2A | No |
| Low | `postReceivableDecrease` uses `FINANCIAL_REFERENCE_INVOICE` on collection confirm | Cosmetic metadata only | No |
| Low | `totalSales` / dealer analytics fields not populated | Reporting phase computation | No |
| Low | `DueReport` model unused | Use in PHASE_08 scheduled aging | No |
| Low | Browser PDF variance | Accepted by design (ADR-017) | No |

**No blocking risks for PHASE_07 Ledger subledger implementation.**

---

## 11. Architecture Improvements (recommended, not required)

| Priority | Improvement | Rationale |
|----------|-------------|-----------|
| High | Add `postingKey` idempotency to ledger + posting | Prevent duplicate entries on retry |
| High | Align `LedgerEntry.referenceType` to `FinancialReferenceType` enum | Type safety |
| High | Implement `postInvoiceReversal` / credit note before production voids needed | Accountant requirement |
| Medium | Soft-delete `CollectionAllocation` (`reversedAt`, `isActive`) | Cleaner statement history |
| Medium | Add `Invoice.issuedById` FK | Reporting without audit join |
| Medium | Reconciliation job: `currentBalance` vs ledger | Operational integrity |
| Medium | Collection concurrency integration tests | Parity with invoice tests |
| Low | Denormalize `dealerName` / `orderNo` on invoice header | Historical PDF resilience |
| Low | Composite indexes for statement queries | Scale |
| Future | Split AR subledger from full GL (`JournalLine` model) | Multi-company platform goal |

---

## 12. ERP Production Readiness Score

| Subsystem | Score | Notes |
|-----------|-------|-------|
| Orders | 9.0 | Solid workflow; non-financial |
| Delivery | 9.0 | Non-financial boundary verified |
| Invoice | 9.0 | ADR-018 certified |
| Collections | 9.2 | ADR-021 certified |
| Money Receipt | 9.0 | ADR-023 complete |
| Document Engine | 9.0 | Platform ready for statements |
| Financial Posting | 8.5 | Solid; ledger posting pending |
| Generic Allocation | 8.5 | Invoice handler only; abstraction certified |
| Advance Payment | 9.0 | Fully certified |
| Audit | 8.0 | Strong events; allocation deletion gap |
| Security | 8.5 | RBAC on all financial actions |
| Scalability | 7.5 | Dealer lock serializes; indexes partial |
| Ledger Readiness | 8.5 | Extension points ready; schema needs hardening |
| Reporting Readiness | 7.0 | Operational reports ready; financial statements need COA |

### **Overall ERP production readiness: 8.7 / 10**

Suitable for controlled production use of Order → Invoice → Collection pipeline.
Ledger and full financial statements are the next maturity step.

---

## 13. Recommended PHASE_07 Breakdown

### PHASE_07A — Ledger Schema Hardening

- Extend `LedgerEntry`: `postingKey`, `referenceNo`, `postingType`, `postingDate`,
  `reversesEntryId`, `createdById`
- Change `referenceType` to `FinancialReferenceType` enum
- Add `@@unique([postingKey])`
- Migration only — no posting logic

### PHASE_07B — Ledger Posting Integration

- `createLedgerEntry()` helper inside `posting-service.ts`
- Wire into `postReceivableIncrease`, `postReceivableDecrease`,
  `postReceivableDecreaseReversal`
- Running balance from last ledger entry per dealer
- Assert `LedgerEntry.balance === Dealer.currentBalance` post-posting
- Unit + integration tests

### PHASE_07C — Opening Balance

- `OpeningBalance` document model (or dealer onboarding action)
- `postOpeningBalance()` in posting service
- `FinancialReferenceType.OpeningBalance` handler in allocation engine
- Migration path for existing dealers (single opening entry)

### PHASE_07D — Ledger UI & Dealer Subledger Statement

- Ledger list / detail routes
- Dealer subledger statement (hybrid: ledger balance + document lines)
- Document platform statement composer (reuse ADR-023 primitives)
- Print / PDF via existing document pipeline

### PHASE_07E — Reconciliation & Backfill

- Backfill script: replay invoices + collections → ledger entries for existing data
- Reconciliation report: `currentBalance` vs ledger vs document replay
- Optional: scheduled integrity check job

### PHASE_07F — Chart of Accounts Foundation (optional parallel)

- `ChartOfAccount` model
- `JournalLine` with account dimension
- Maps to full TB / GL / P&L / BS (PHASE_08+)

### Explicitly deferred beyond PHASE_07

- Credit note / invoice void workflow
- Due report UI (PHASE_08)
- Full multi-account GL financial statements
- Email / SMS document delivery

---

## Sign-off

The financial architecture of Nazma ERP **PHASE_01 through PHASE_06C** is
**certified** for enterprise ledger implementation. Proceed to **PHASE_07A**
without refactoring Invoice Engine, Collection Engine, or Financial Posting
Service boundaries.

| Check | Status |
|-------|--------|
| Full pipeline reviewed | ✅ |
| Source of truth defined | ✅ |
| Posting strategy documented | ✅ |
| Ledger architecture designed | ✅ |
| Dealer statement architecture defined | ✅ |
| Generic allocation certified | ✅ |
| Advance payment certified | ✅ |
| Reporting readiness assessed | ✅ |
| Accounting rules verified | ✅ |
| Risks documented | ✅ |
| PHASE_07 breakdown recommended | ✅ |

---

## References

- ADR-011 — Fulfillment pipeline
- ADR-014 — Invoice Engine
- ADR-015 — Financial integrity audit
- ADR-018 — Invoice production certification
- ADR-019 — Collections foundation
- ADR-020 — Collection engine
- ADR-021 — Collection financial certification
- ADR-023 — Money receipt / document platform
