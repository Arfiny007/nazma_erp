# Financial Invariants — Nazma Water Taps ERP

Authoritative engineering rulebook. Every rule below is mandatory. Violation constitutes a production defect and potential accounting corruption.

**Certification basis:** ADR-015, ADR-021, ADR-024, ADR-025, ADR-026, ADR-027  
**Last updated:** 2026-07-09 (PHASE_07B.5 — Enterprise Financial Integrity Certification)

---

## 1. Dealer Balance (`Dealer.currentBalance`)

| Rule | Detail |
|------|--------|
| Sole writer | ONLY `src/lib/finance/posting-service.ts` may mutate `Dealer.currentBalance` |
| Semantics | Positive = dealer owes company (AR); Zero = settled; Negative = company owes dealer (advance/credit) |
| Role | Operational cache for fast lookup, credit limit, UI badges — asserted equal to `LedgerEntry.balance` on every commit (PHASE_07B) |
| Reconciliation | `assertLedgerBalanceMatchesCache` runs inside every posting transaction; drift rolls back atomically |
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
| Mandate | ALL financial operations MUST pass through this module |
| Current functions | `postReceivableIncrease()`, `postReceivableDecrease()`, `postReceivableDecreaseReversal()` |
| Future functions | `postOpeningBalance()`, `postCreditNote()`, `postDebitNote()`, `postInvoiceReversal()`, `postJournalEntry()` |
| Side effects | Balance update + `LedgerEntry` append + cache/ledger parity assertion + audit log (all in one transaction) |
| Sole ledger writer | `createLedgerEntry` (from `@/lib/ledger`) is imported ONLY by `posting-service.ts` |
| Forbidden | Feature-level balance mutations bypassing posting service; direct `LedgerEntry` inserts from anywhere else |

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

## 18. Ledger Foundation Invariants (PHASE_07A — shipped)

| Rule | Detail |
|------|--------|
| Write path | `LedgerEntry` inserted only via `createLedgerEntry` in `@/lib/ledger` |
| Caller | `createLedgerEntry` is invoked only from `posting-service.ts` |
| Append-only | Ledger entries never updated or deleted; runtime guard `assertLedgerAppendOnly` |
| Reversals | Compensating entries with `reversesEntryId` and `postingType = Reversal`; `buildReversalPosting` helper |
| Running balance | `LedgerEntry.balance = previousBalance + debit − credit`; MUST equal `Dealer.currentBalance` after each post (`assertLedgerBalanceMatchesCache`) |
| Sign convention | Debit increases dealer obligation; credit decreases. Advance credit ⇒ negative balance |
| Idempotency | `postingKey String @unique` derived from `(referenceType, referenceId, postingType[, sequence])` |
| Amount rules | `debit ≥ 0`, `credit ≥ 0`, exactly one > 0 (`assertLedgerPostingInputValid`) |
| Enum discipline | `referenceType: FinancialReferenceType`, `postingType: LedgerPostingType` — no strings |
| Actor audit | `createdById` on every entry (nullable for system backfills) |
| Reconciliation | `reconcileDealerLedger` + `replayDealerLedgerBalance` + `validateDealerLedgerChain` + `reconcileAllDealers` — drift never silently corrected |
| Opening balance | `buildOpeningBalancePosting` sign-aware; `previousBalance = 0.00` mandatory |

---

## 19. Ledger Posting Engine Invariants (PHASE_07B — shipped)

| Rule | Detail |
|------|--------|
| Every receivable event | `postReceivable*` MUST produce exactly one `LedgerEntry` inside the caller's transaction |
| Invoice issue | `postingType = Issue`, `referenceType = Invoice`, Debit = `grandTotal` |
| Collection confirm | `postingType = Collection`, `referenceType = Collection`, Credit = `receivedAmount` |
| Collection reverse | `postingType = Reversal`, `referenceType = Collection`, Debit = `receivedAmount`, `reversesEntryId` = original Collection entry id when it exists |
| Allocation | `applyDealerBalance = false` → NO balance touch, NO ledger row (cash already posted on confirm) |
| Balance parity | `assertLedgerBalanceMatchesCache(dealerCode, ledgerEntry.balance, newBalance)` after every insert |
| Order of side effects | (1) Dealer balance atomic ± → (2) `createLedgerEntry` → (3) parity assertion → (4) audit row |
| Transaction atomicity | Balance mutation + ledger insert + parity assertion + audit row commit or roll back together |
| Idempotent replay | `createLedgerEntry` P2002 on `postingKey` collapses to `isNew = false` on matching payload; raises `LedgerDuplicatePostingError` on payload drift |
| Reversal linkage | `reversesEntryId` populated when canonical original exists; null for pre-PHASE_07B collections — ledger complete going forward |
| Audit cross-reference | Audit payload carries `ledgerEntryId`, `ledgerPostingKey`, `ledgerPostingType`, `ledgerIsNew`, and (on reversal) `ledgerReversesEntryId` |
| Forbidden | Direct `LedgerEntry` inserts, updates, or deletes anywhere other than `createLedgerEntry`; direct dealer balance mutations outside `posting-service.ts` |

---

## 20. Financial Integrity Certification Invariants (PHASE_07B.5 — shipped)

| Rule | Detail |
|------|--------|
| Repository reconciliation | `SUM(debit) − SUM(credit) = last LedgerEntry.balance = Dealer.currentBalance` for dealers with ledger rows |
| Chain integrity | Entry `i > 0`: `balance[i] = balance[i−1] + debit[i] − credit[i]` |
| Empty ledger | Reconciled only when `Dealer.currentBalance = 0.00`; non-zero cache without ledger = pre-backfill drift |
| Scheduled job | `reconcileAllDealers` ready for PHASE_07E cron; not yet scheduled |
| Certification | ADR-027 — Opening Balance (PHASE_07C) approved |

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
- ADR-025 — Enterprise Ledger Foundation (PHASE_07A)
- ADR-026 — Enterprise Ledger Posting Engine (PHASE_07B)
- ADR-027 — Enterprise Financial Integrity Certification (PHASE_07B.5)
