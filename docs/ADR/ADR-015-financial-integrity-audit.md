# ADR-015: Financial Integrity Audit — PHASE_05C2

Date: 2026-06-25

Status: ACCEPTED

Phase: PHASE_05C2_FINANCIAL_INTEGRITY_AUDIT

Builds on: ADR-011, ADR-012, ADR-014

---

## Context

PHASE_05C1 delivered the Invoice Engine backend. Before PHASE_05D (Invoice UI &
PDF) and PHASE_06 (Collections), a pre-production accounting review was
performed across the full commercial → fulfillment → financial pipeline.

This ADR records audit findings, mandatory remediations, and certification scope.
No UI or feature work is in scope for this phase.

---

## Audit Verdict

**Invoice Engine architecture: APPROVED** with one **mandatory remediation**
before high-concurrency production use.

Production readiness score: **7.5 / 10**

The design correctly separates non-financial (Delivery Challan) from financial
(Invoice + Financial Posting Service) boundaries. Immutable `InvoiceItem`
snapshots, single balance write path, challan-gated issuance, and transactional
`issueInvoice()` are sound ERP patterns.

The score is reduced because concurrent invoice issue against the **same dealer**
can produce lost balance updates, incorrect `previousDue` snapshots, and credit
limit bypass under PostgreSQL default `READ COMMITTED` isolation without row
locking.

---

## Section Results

| # | Area | Result | Notes |
|---|------|--------|-------|
| 1 | Invoice Snapshot Integrity | **PASS** | Line-level snapshots immutable; product/order/challan changes do not alter issued lines |
| 2 | Dealer Balance Integrity | **PASS** | Only `postReceivableIncrease()` writes `currentBalance` |
| 3 | Previous Due Snapshot | **WARNING** | Correct in serial execution; race under concurrent same-dealer issue |
| 4 | Current Due Logic | **PASS** | Stored at issue; `collectionReceived` ready for PHASE_06 reduction |
| 5 | Credit Limit Enforcement | **WARNING** | Checked only at invoice issue (correct boundary); TOCTOU under concurrency |
| 6 | Financial Transaction Boundary | **PASS** | All issue steps inside one `prisma.$transaction` |
| 7 | Invoice Number Generator | **PASS** | In-transaction generation + `P2002` retry; unique `invoiceNo` is final guard |
| 8 | Delivery → Invoice Integrity | **PASS** | Confirmed-only, unique `deliveryChallanId`, unique `challanItemId` on items |
| 9 | Reporting Readiness | **WARNING** | Core financial fields present; `issuedById` and territory not denormalized |
| 10 | Ledger Readiness | **PASS** | `posting-service.ts` is the correct extension point for PHASE_06–07 |
| 11 | Audit Trail Integrity | **PASS** | `INVOICE_CREATED` + `DEALER_BALANCE_UPDATED` with references and amounts |
| 12 | Database Integrity | **WARNING** | FK/unique constraints sound; dealer balance lacks pessimistic lock |
| 13 | Performance | **PASS** | Single nested load in `issueInvoice`; list uses batched count + findMany |

---

## Critical Finding — Dealer Balance Concurrency

### Problem

`issueInvoice()` reads `Dealer.currentBalance` for `previousDue` and credit
check, then `postReceivableIncrease()` performs read-modify-write:

```
previousBalance = dealer.currentBalance   // read
newBalance = previousBalance + amount     // compute
UPDATE dealer SET currentBalance = newBalance
```

Two concurrent transactions issuing invoices for the same dealer can both read
the same `previousBalance`. The second commit overwrites the first increment
(**lost update**). Consequences:

1. `Dealer.currentBalance` understates total receivables.
2. Second invoice `previousDue` does not reflect first invoice's `currentDue`.
3. Credit limit check uses stale balance — combined exposure can exceed limit.

### Mandatory Remediation (before production concurrency)

**Status: IMPLEMENTED in PHASE_05C2A** — Options A + B combined:

**Option A (recommended):** Pessimistic row lock at the start of
`executeIssueInvoiceTransaction()`:

```sql
SELECT "currentBalance", "creditLimit"
FROM "Dealer"
WHERE "dealerCode" = $1
FOR UPDATE
```

Perform credit check, `previousDue` snapshot, invoice create, and balance
update only after the lock is acquired.

**Option B:** Atomic increment in `postReceivableIncrease()`:

```typescript
await tx.dealer.update({
  where: { dealerCode },
  data: { currentBalance: { increment: amount } },
});
```

`previousDue` must still be captured from the locked or pre-increment read so it
matches the balance used for the credit check.

**Option C:** PostgreSQL advisory lock keyed by `dealerCode` for the duration of
the issuing transaction.

All three options preserve the existing Financial Posting Service boundary. The
fix belongs in `issue-invoice.ts` + `posting-service.ts`, not in UI.

### Verification after fix

- Integration test: two concurrent `issueInvoice()` calls for the same dealer;
  assert final `currentBalance` equals sum of both `grandTotal` values added to
  starting balance.
- Assert second invoice `previousDue` equals first invoice `currentDue`.
- Assert credit limit blocks when concurrent issues would exceed limit.

---

## Certified Design Decisions (no change required)

### InvoiceItem immutability

`InvoiceItem` stores `productCode`, `productName`, `unit`, `quantity`,
`unitPrice`, `discount`, `lineTotal` at issue. No update paths exist. Live
`Product` / `SalesOrderItem` changes cannot alter issued lines. `orderItemId` and
`challanItemId` provide traceability; header FKs supply order/challan numbers at
read time.

### Single balance write path

Grep-verified: only `src/lib/finance/posting-service.ts` mutates
`Dealer.currentBalance`. Delivery challan actions, order actions, and dealer CRUD
do not touch balance.

### Current due strategy

`previousDue` — immutable statement snapshot at issue.

`currentDue` — stored at issue as `previousDue + grandTotal`; will be reduced by
`collectionReceived` in PHASE_06 via Financial Posting Service. This is the
correct ERP pattern: historical `previousDue` preserved; running invoice balance
mutable via collections.

### Credit limit boundary

Credit checked only in `issueInvoice()`. Orders and challans do not call
`wouldExceedCreditLimit()`. Correct per ADR-011.

### Transaction boundary

Inside one transaction: challan load → guards → `previousDue` → totals → credit
check → invoice + items → `postReceivableIncrease()` → `INVOICE_CREATED` audit.
Rollback on any failure reverts balance and invoice.

### One challan → one invoice

Enforced by `assertNoExistingInvoice()`, workflow status guards, and unique
`Invoice.deliveryChallanId` + unique `InvoiceItem.challanItemId`.

### PHASE_06+ extension points

| Future module | Extension |
|---------------|-----------|
| Collections | `postReceivableDecrease()`; update `collectionReceived` + `currentDue` |
| Ledger | Ledger line creation inside posting service callbacks |
| Credit notes | Reversal posting through same service |
| Opening balance | `postOpeningBalance()` initial posting |
| Returns | Negative receivable or credit-note path |

Invoice Engine (`issue-invoice.ts`, calculator, workflow) requires **no
refactoring** for these phases once concurrency remediation lands.

---

## Recommended (non-blocking) improvements

| Priority | Item | Rationale |
|----------|------|-----------|
| Recommended | Add `Invoice.issuedById` FK | Reporting without joining `AuditLog` |
| Recommended | Denormalize `dealerName` on `Invoice` | Historical accuracy if dealer renamed |
| Optional | Snapshot `orderNo` / `challanNo` on header | PDF/report resilience if FK labels change |
| Optional | Composite index `(dealerCode, issueDate)` | Large-scale dealer statement queries |

---

## Out of scope (this ADR)

- Invoice UI / PDF (PHASE_05D)
- Collections / Ledger implementation
- Credit-limit override workflow (ADR-011 mentions Manager override — not built)
- Logistics field relocation from `Invoice` to `DeliveryChallan` (schema debt)

---

## Governance

| Document | Update |
|----------|--------|
| `CURRENT_PHASE.md` | PHASE_05C2 complete; next: remediate concurrency, then PHASE_05D |
| `IMPLEMENTATION_STATUS.md` | Audit results table |
| `NEXT_ACTION.md` | Concurrency fix before UI |
| `CHANGELOG.md` | PHASE_05C2 audit entry |

---

## Sign-off

Invoice Engine backend is **architecturally approved** for PHASE_05D and
PHASE_06. Dealer balance concurrency remediation landed in **PHASE_05C2A**
(`dealer-lock.ts`, atomic increment in `posting-service.ts`, idempotent
`executeIssueInvoiceTransaction()`).

---

## Implementation Notes (PHASE_05C2A)

| Item | Implementation |
|------|----------------|
| Dealer lock | `lockDealerForFinancialUpdate()` — `SELECT … FOR UPDATE` on `Dealer` row |
| `previousDue` | Snapshot from locked `currentBalance` after lock; re-check invoice exists post-lock |
| Balance update | `postReceivableIncrease()` uses `{ increment: amount }`; `previousBalance` required from lock |
| Credit limit | `wouldExceedCreditLimit()` after lock only |
| Idempotency | Early return if challan has invoice; post-lock re-check; `P2002` on `deliveryChallanId` resolves existing |
| Tests | `issue-invoice-concurrency.test.ts` — parallel same-dealer, credit limit, duplicate challan, retry |
