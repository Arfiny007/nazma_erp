# Financial Invariants — Nazma Water Taps ERP

Authoritative engineering rulebook. Every rule below is mandatory. Violation constitutes a production defect and potential accounting corruption.

**Certification basis:** ADR-015, ADR-021, ADR-024  
**Last updated:** 2026-07-01 (REPOSITORY_MIGRATION_AND_METADATA_DUMP)

---

## 1. Dealer Balance (`Dealer.currentBalance`)

| Rule | Detail |
|------|--------|
| Sole writer | ONLY `src/lib/finance/posting-service.ts` may mutate `Dealer.currentBalance` |
| Semantics | Positive = dealer owes company (AR); Zero = settled; Negative = company owes dealer (advance/credit) |
| Role | Operational cache for fast lookup, credit limit, UI badges — NOT primary accounting source of truth |
| Reconciliation | Must reconcile to ledger entries (PHASE_07+) and document replay |
| Forbidden | Direct `dealer.update({ currentBalance })` from feature code, UI, or allocation engine |

---

## 2. Decimal Handling

| Rule | Detail |
|------|--------|
| Database | All monetary fields: `Decimal @db.Decimal(18, 2)` |
| Application | Use Prisma `Decimal` type; never JavaScript `number` for money |
| Calculations | Decimal-safe engines only (`order-calculator`, `invoice-calculator`, Prisma `{ increment }` / `{ decrement }`) |
| Display | `format-money.ts` / `useFormatMoney` for presentation only — not calculation |
| Forbidden | `parseFloat`, `Number()`, floating-point arithmetic on money |

---

## 3. Transaction Boundaries

| Rule | Detail |
|------|--------|
| Atomicity | Every financial mutation occurs inside a single `prisma.$transaction` |
| Scope | Document persistence + posting service + audit log + related field updates commit together or roll back together |
| Examples | `issueInvoice()`, `confirmCollection()`, `allocateCollection()`, `reverseCollection()` |
| Forbidden | Multi-step financial updates across separate transactions without compensating design |

---

## 4. Dealer Row Lock

| Rule | Detail |
|------|--------|
| Function | `lockDealerForFinancialUpdate()` in `src/lib/finance/dealer-lock.ts` |
| Mechanism | `SELECT … FOR UPDATE` on dealer row before any balance read or write |
| Required on | Invoice issue, collection confirm, allocate, deallocate, reverse |
| Purpose | Prevent lost updates, stale `previousDue`, credit limit TOCTOU under concurrent access |
| Forbidden | Financial mutations without dealer lock when balance or credit is involved |

---

## 5. Financial Posting Service

| Rule | Detail |
|------|--------|
| Location | `src/lib/finance/posting-service.ts` |
| Mandate | ALL future financial operations MUST pass through this module |
| Current functions | `postReceivableIncrease()`, `postReceivableDecrease()`, `postReceivableDecreaseReversal()` |
| Future functions | `postOpeningBalance()`, `postCreditNote()`, `postDebitNote()`, `postInvoiceReversal()`, `postJournalEntry()` |
| Side effects | Balance update + audit log (+ ledger entry in PHASE_07) |
| Forbidden | Feature-level balance mutations bypassing posting service |

---

## 6. Pipeline Financial Boundaries

### Sales Order — NON-FINANCIAL

- No `Dealer.currentBalance` changes
- No ledger entries
- No due report impact
- Commercial terms only

### Delivery Challan — NON-FINANCIAL

- Must NEVER update `Dealer.currentBalance`
- Must NEVER create `LedgerEntry` rows
- Must NEVER affect `DueReport` aggregates
- Must NEVER record collections
- Must NOT import `src/lib/finance/`
- Credit limit NOT evaluated at dispatch

### Invoice — FINANCIAL BOUNDARY BEGINS HERE

- Revenue recognized at issue (status → Issued)
- `postReceivableIncrease()` on issue
- Updates dealer balance, `previousDue`, `currentDue`
- Credit limit evaluated at issue only
- Immutable after issue (lines never edited)

### Collection Confirm — FINANCIAL (Cash)

- `postReceivableDecrease()` on confirmation
- Full `receivedAmount` posted once
- Collection immutable after confirmation

### Allocation — NON-BALANCE

- Moves cash within collection pool
- Updates `Invoice.collectionReceived` and `currentDue`
- Must NEVER call posting service for balance changes
- Cash was already posted on confirmation

### Money Receipt / Document Platform — PRESENTATION ONLY

- Must NEVER calculate financial values
- All amounts from server DTO strings
- Preview = Print = PDF (same component tree)

---

## 7. Invoice Invariants

| Rule | Detail |
|------|--------|
| Source | One confirmed `DeliveryChallan` → exactly one `Invoice` |
| Quantities | From `DeliveryChallanItem` only — never from `SalesOrderItem.quantity` directly |
| Lines required | `InvoiceItem` mandatory; header-only invoices forbidden |
| Immutability | Issued invoice lines are permanent snapshots |
| Snapshots | `previousDue` captured from locked dealer balance at issue |
| `currentDue` | `previousDue + grandTotal` at issue; reduced by allocation, not by re-issue |
| Duplicate prevention | Unique `deliveryChallanId`; idempotent re-issue returns existing invoice |
| Forbidden | Editing issued `InvoiceItem` rows; voiding without compensating entry |

---

## 8. Collection Invariants

| Rule | Detail |
|------|--------|
| Pool invariant | `receivedAmount = allocatedAmount + unallocatedAmount` — enforced after every pool mutation |
| Immutability | Confirmed collections cannot be edited; corrections via `reverseCollection()` only |
| Cash posting | Balance decreases exactly once on confirmation |
| Advance | Negative AR allowed; no floor on balance decrement |
| Reversal | `postReceivableDecreaseReversal()` restores balance; invoice fields reversed per allocation row |
| Idempotency | Duplicate confirmation returns early without double-posting |
| Forbidden | Editing confirmed collection headers; double cash posting on allocation |

---

## 9. Allocation Invariants

| Rule | Detail |
|------|--------|
| Cap | Allocatable amount = `invoice.grandTotal − invoice.collectionReceived` |
| Overpayment guard | `collectionReceived` must never exceed `grandTotal` |
| Pool cap | Single allocation cannot exceed `unallocatedAmount` |
| Uniqueness | One allocation per `(collectionId, referenceType, referenceId)` |
| Dealer match | Reference document must belong to same dealer as collection |
| No balance post | Allocation must NEVER directly modify `Dealer.currentBalance` |
| Forbidden | Using `currentDue − collectionReceived` as allocation cap (double-counts payments) |

---

## 10. Advance Payment Invariants

| Rule | Detail |
|------|--------|
| Receipt | Full cash posted on collection confirm regardless of immediate allocation |
| Credit | Unallocated portion remains in pool; dealer balance may go negative |
| Application | Future invoice allocation reduces invoice dues without additional cash post |
| Display | Advance shown as credit (blue badge), not error state |
| Forbidden | Rejecting collection that would create negative AR |

---

## 11. Quantity / Fulfillment Invariants

| Rule | Detail |
|------|--------|
| Derived quantities | `remainingQty` and `allocatableQty` computed from challan history — not stored columns |
| Over-delivery | `requestedQty ≤ allocatableQty` on every challan create/update/confirm |
| Confirmed only | Only confirmed challan quantities count toward delivered totals |
| Draft reservation | Draft challans reduce `allocatableQty` but not `remainingQty` display |
| Forbidden | Persisted `remainingQuantity` on `SalesOrderItem`; billing qty from order instead of challan |

---

## 12. Audit Invariants

| Rule | Detail |
|------|--------|
| Retention | Never delete financial history |
| Events | `INVOICE_CREATED`, `DEALER_BALANCE_UPDATED`, `COLLECTION_*`, `DEALER_BALANCE_DECREASED` |
| Immutability | Audit log entries are append-only |
| Reversal audit | `COLLECTION_REVERSED*` preserves allocation amounts even when allocation rows deleted |
| Forbidden | Hard-deleting invoices, confirmed collections, or ledger entries |

---

## 13. Reversal Invariants

| Rule | Detail |
|------|--------|
| Model | Compensating transactions only — never silent edits |
| Collection | Status → Reversed; balance restored; invoice fields reversed |
| Invoice | Not yet implemented — future `postInvoiceReversal()` / credit note |
| Ledger | Future entries linked via `reversesEntryId` |
| Forbidden | Rewriting historical financial document values in place |

---

## 14. Source-of-Truth Hierarchy

```
TIER 1 — AUTHORITATIVE (PHASE_07+)
  LedgerEntry (append-only journal subledger)

TIER 2 — DOCUMENT TRUTH
  Invoice, InvoiceItem, Collection, CollectionAllocation

TIER 3 — OPERATIONAL CACHE
  Dealer.currentBalance
  Invoice.currentDue / collectionReceived
  Collection pool fields
```

Reports and statements must not trust Tier 3 alone without reconciliation to Tier 1/2.

---

## 15. Concurrency Invariants

| Rule | Detail |
|------|--------|
| Serialization | Same-dealer financial operations serialized via row lock |
| Atomic updates | Balance changes use Prisma `{ increment }` / `{ decrement }` with post-write assertion |
| Idempotency | Invoice issue and collection confirm have idempotent retry paths |
| Future | Ledger posting requires `postingKey` unique constraint |

---

## 16. Credit Limit Invariants

| Rule | Detail |
|------|--------|
| When | Evaluated only at `issueInvoice()` |
| Formula | `projectedExposure = dealer.currentBalance + invoice.grandTotal` |
| Lock | Credit check uses balance from dealer row lock |
| Not evaluated | Order approval, challan dispatch, collection |
| Forbidden | Credit check without dealer lock under concurrency |

---

## 17. Document Platform Invariants

| Rule | Detail |
|------|--------|
| No client math | React components display server-formatted strings only |
| Single pipeline | Same component for preview, print, and PDF |
| Print guard | Draft and reversed documents blocked from print routes |
| Forbidden | Client-side sum/subtract of monetary fields; rasterized PDF generation |

---

## 18. Ledger Extension Points (PHASE_07)

| Rule | Detail |
|------|--------|
| Write path | `LedgerEntry` created only inside `posting-service.ts` |
| Append-only | Ledger entries never updated or deleted |
| Reversals | Compensating entries with `reversesEntryId` |
| Running balance | `LedgerEntry.balance` must equal `Dealer.currentBalance` after each post |
| Idempotency | `postingKey` unique constraint prevents duplicate entries on retry |

---

## Enforcement Checklist for New Code

Before merging any financial feature:

- [ ] Uses `Decimal(18,2)` — no `number` for money
- [ ] Inside `prisma.$transaction`
- [ ] Calls `lockDealerForFinancialUpdate()` when touching balance
- [ ] Routes balance changes through `posting-service.ts`
- [ ] Writes audit log in same transaction
- [ ] Does not mutate immutable issued documents
- [ ] Allocation does not double-post cash
- [ ] Delivery challan code has zero finance imports
- [ ] Document UI displays server values only

---

## Cross-References

- ADR-014 — Invoice Engine
- ADR-015 — Financial integrity audit
- ADR-019 — Collections foundation (AR semantics)
- ADR-020 — Collection engine
- ADR-021 — Collection financial certification
- ADR-024 — Financial architecture certification
