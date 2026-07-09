# ADR-028: Enterprise Financial Initialization Engine — PHASE_07C

Date: 2026-07-09

Status: ACCEPTED

Phase: PHASE_07C_ENTERPRISE_FINANCIAL_INITIALIZATION_ENGINE

Builds on: ADR-024, ADR-025, ADR-026, ADR-027

---

## Context

ADR-027 certified the full financial path (`Invoice/Collection → PostingService
→ LedgerEntry → Dealer.currentBalance → Audit`) and explicitly approved
Opening Balance as the next phase. Two structural gaps blocked production
go-live:

1. **No way to onboard existing dealer receivables.** Every dealer created
   before PHASE_07B (or imported from a legacy system) carries transactional
   history with zero `LedgerEntry` rows. `postOpeningBalance()` was designed
   in ADR-025/026 (`buildOpeningBalancePosting`) but never wired to a
   workflow, a schema, or a UI.
2. **No permanent "financial initialization" platform.** The brief explicitly
   rejects treating Opening Balance as a one-off CRUD feature — it must be
   built as the FIRST workflow of a reusable initialization platform that
   later hosts Bulk Opening Balance Import, ERP Migration, Company
   Initialization, Branch Initialization, and Fiscal Year Initialization.

This ADR records the architecture, state machine, posting strategy, and
verification evidence for the Financial Initialization Engine, with Opening
Balance as its first shipped workflow.

**Scope:** Opening Balance workflow (backend engine + server actions +
enterprise wizard UI). No Invoice, Collection, Order, Delivery, Ledger
posting-function, Document Platform, RBAC-matrix, Reporting, or Dashboard
changes.

---

## Executive Summary

**Verdict: FINANCIAL INITIALIZATION ENGINE SHIPPED — PHASE_07D UNBLOCKED**

Opening Balance is delivered as a permanent, producer-agnostic platform, not
a dealer-balance edit screen. Every dealer can be initialized **exactly
once**, through an immutable state machine
(`NotInitialized → Draft → Validated → Posted+Locked`), that reuses
`PostingService` as the only mutation boundary — identical to Invoice and
Collection posting. A live-database concurrency test suite proves the
initialization lock and the ledger idempotency guarantee under real
PostgreSQL row-lock contention, and surfaced (and fixed) one genuine race
condition before it could reach production.

---

## 1. Architectural Goal

```
Financial Initialization
        ↓
   Validation
        ↓
  PostingService
        ↓
   LedgerEntry
        ↓
Dealer.currentBalance
        ↓
      Audit
```

`PostingService` is never bypassed. The engine adds exactly one new function,
`postOpeningBalance()`, to `src/lib/finance/posting-service.ts` — same file,
same transaction discipline, same dealer-lock pattern as
`postReceivableIncrease` / `postReceivableDecrease` /
`postReceivableDecreaseReversal`.

---

## 2. State Machine

```
NotInitialized  (no OpeningBalance row for the dealer)
      │  createOpeningBalanceRecord()
      ▼
    Draft            — editable*, NEVER touches balance or ledger
      │  validateOpeningBalanceRecord()
      ▼
  Validated          — ready for posting, NEVER touches balance or ledger
      │  postOpeningBalanceRecord()
      ▼
Posted + Locked      — ONE immutable LedgerEntry (or none if amount = 0),
                        Dealer.currentBalance updated, forever immutable
```

`* Editable` in the sense that `Draft` is the pre-posting state; there is no
`updateOpeningBalanceDraft()` action in this phase — a wrong Draft is
abandoned by never validating/posting it (harmless, since it never touched
balance or ledger) or corrected by the accountant re-entering values before
validation. `Posted` and `Locked` are set atomically in the same transaction
— there is no reviewable window between "the ledger entry exists" and "this
record is immutable forever," because there is no meaningful business action
that belongs in that window.

**Immutability:** once `Locked`, an `OpeningBalance` row is never edited or
deleted. Corrections are out of scope for this phase and happen through
Journal Entry / Manual Adjustment / Credit Note / Debit Note — all of which
plug into the same `posting-service.ts` boundary in future phases.

---

## 3. Schema

**New model:** `OpeningBalance` (`prisma/schema.prisma`)

| Field | Type | Purpose |
|-------|------|---------|
| `dealerCode` | `String @unique` | Enforces "every dealer initialized exactly once" at the database level |
| `amount` | `Decimal(18,2)` | Positive (dealer owes), negative (advance), or zero |
| `effectiveDate` | `DateTime` | Business date of the opening position |
| `status` | `OpeningBalanceStatus` | `Draft` \| `Validated` \| `Posted` \| `Locked` |
| `source` | `OpeningBalanceSource` | `Manual` \| `CsvImport` \| `ExcelImport` \| `ErpMigration` — import-ready from day one |
| `referenceNo` | `String?` | `OB-<dealerCode>`, deterministic |
| `createdById` / `validatedById` / `postedById` | `String` | Actor audit trail per transition |
| `ledgerEntryId` / `postingKey` | `String? @unique` | Idempotency + cross-reference to the posted `LedgerEntry` |

**Why `dealerCode @unique` instead of a status check alone:** the unique
constraint is the final backstop against a race between two concurrent
"start initialization" attempts for the same dealer — see §6.

**No changes** to `Invoice`, `Collection`, `SalesOrder`, `DeliveryChallan`,
`LedgerEntry`, or any RBAC/permission table. `LedgerPostingType.OpeningBalance`
and `FinancialReferenceType.OpeningBalance` already existed (reserved by
ADR-025); this phase is their first consumer.

---

## 4. Module Layout — Reusable by Design

```
src/lib/finance/initialization/
  opening-balance-types.ts        — OpeningBalanceRecordInput (producer-agnostic),
                                     OpeningBalanceRecord, write-client contract
  opening-balance-errors.ts       — OpeningBalanceError + error codes
  opening-balance-validation.ts   — business rule guards (pure functions)
  opening-balance.ts              — CORE state machine: createOpeningBalanceRecord,
                                     validateOpeningBalanceRecord,
                                     postOpeningBalanceRecord, postOpeningBalanceBatch
  opening-balance-service.ts      — orchestration: wraps core in prisma.$transaction,
                                     dealer existence/uniqueness, DTO mapping
  initialization-status.ts        — read-side: getInitializationStatusForDealer,
                                     listUninitializedDealers
```

**Reuse contract for future workflows:**

- `OpeningBalanceRecordInput.source` already models `CsvImport` / `ExcelImport`
  / `ErpMigration` — a future bulk importer supplies rows from a parsed file
  and calls the SAME `createOpeningBalanceRecord` / `validateOpeningBalanceRecord`
  / `postOpeningBalanceRecord` functions used by the manual wizard.
- `postOpeningBalanceBatch(tx, recordIds, actorId)` is shipped now (unused by
  the manual wizard) specifically so a bulk importer needs **zero engine
  changes** — only a new caller that parses a file into
  `OpeningBalanceRecordInput[]`, creates+validates+posts each row, and
  reports per-row success/failure without one bad row rolling back the batch.
- The core functions (`opening-balance.ts`) take an already-open
  `Prisma.TransactionClient` and are producer-agnostic; the orchestration
  layer (`opening-balance-service.ts`) is the ONLY place that knows about
  `prisma.$transaction`, dealer existence checks, and DTO shape. Company
  Initialization / Branch Initialization / Fiscal Year Initialization
  (future workflows) get their own orchestration modules but can share the
  same posting/validation idioms.

---

## 5. Posting Strategy

**New function:** `postOpeningBalance()` in `src/lib/finance/posting-service.ts`
— the sole entry point into the posting boundary for this engine.

| Amount | Ledger effect | Dealer.currentBalance |
|--------|---------------|------------------------|
| Positive (dealer owes) | `LedgerEntry(postingType=OpeningBalance, Debit=amount)` | `+= amount` |
| Negative (advance) | `LedgerEntry(postingType=OpeningBalance, Credit=|amount|)` | `+= amount` (goes negative) |
| Zero | **No `LedgerEntry`** — `buildOpeningBalancePosting` rejects zero-amount postings by design (ADR-025) | unchanged (0.00) |

For a zero opening balance, `postOpeningBalance()` still writes an
`AuditLog` row and the workflow still transitions the record to `Locked` —
the dealer is correctly marked "initialized," just without a meaningless
zero-value ledger row.

**Precondition enforced in-transaction:** `previousBalance` (the dealer's
current cached balance, read under the row lock) **must be exactly zero**
before an opening balance may post. Opening Balance is defined as a dealer's
*first-ever* posting — if the cache is already non-zero (legacy data seeded
outside this engine, or a second initialization attempt slipping past the
workflow guard), `postOpeningBalance()` throws rather than silently
compounding an incorrect balance.

**Reused, not duplicated:** balance mutation via `dealer.update({ currentBalance:
{ increment } })`, ledger insert via `createLedgerEntry()`,
`assertLedgerBalanceMatchesCache()` parity check, and `AuditLog` creation are
the exact same primitives `postReceivableIncrease` uses. `postOpeningBalance`
adds zero new mutation code paths — it is a new *caller* of existing,
certified primitives.

---

## 6. Concurrency and Idempotency — Two Real Races Found and Closed

### 6.1 Duplicate initialization (two concurrent "start" attempts)

`OpeningBalance.dealerCode @unique` plus an in-transaction existence check
(`assertDealerNotInitialized`) means only one of two concurrent
`createOpeningBalanceDraftForDealer()` calls for the same dealer can ever
succeed. The loser's `P2002` on `dealerCode` is mapped to
`OpeningBalanceError("ALREADY_INITIALIZED")`.

**Proven live** — `opening-balance-concurrency.integration.test.ts`,
scenario 1: `Promise.allSettled` of two concurrent drafts for one dealer →
exactly one `fulfilled`, one `rejected` with `ALREADY_INITIALIZED`, exactly
one `OpeningBalance` row persists.

### 6.2 Concurrent posting of the same record (defect found during this phase)

The initial implementation of `postOpeningBalanceRecord()` short-circuited on
`existing.status === Locked` **only at function entry**, before acquiring
the dealer row lock. Under real PostgreSQL concurrency this is unsafe:

```
Tx A: read record (Validated) → acquire dealer lock → post → Locked → commit
Tx B: read record (Validated, tx A hasn't committed yet)
      → blocks on dealer lock (tx A holds it)
      → tx A commits; tx B acquires lock; dealer.currentBalance is now
        NON-ZERO (tx A's posting)
      → assertPreviousBalanceZero() throws — Tx B fails loudly instead of
        replaying idempotently
```

This is the exact race the invoice engine already solved
(`issue-invoice-transaction.ts` re-checks `tx.invoice.findUnique` for an
existing invoice **after** acquiring the dealer lock, before doing any
posting work). **Fix applied in this phase:** `postOpeningBalanceRecord()`
now re-fetches the `OpeningBalance` row immediately after
`lockDealerForFinancialUpdate()` and returns `{ alreadyPosted: true }` if a
concurrent transaction already flipped it to `Locked` while this transaction
was waiting for the lock — identical idiom, same file pattern, no new
abstraction introduced.

**Proven live** — `opening-balance-concurrency.integration.test.ts`,
scenario 2: `Promise.all` of two concurrent `postOpeningBalanceDraft()` calls
on the SAME validated record → both resolve successfully, both report
`status: "Locked"` with the SAME `ledgerEntryId`, exactly **one**
`LedgerEntry` row exists, `postingKey` count is exactly 1,
`Dealer.currentBalance` matches the single posted amount exactly. Before the
fix, this scenario failed with `INTERNAL_ERROR` from
`assertPreviousBalanceZero`.

A matching unit-level regression test was added to
`opening-balance.test.ts` (in-memory stub) so the sequential path (winner
posts, loser replays) stays covered without requiring a live database.

### 6.3 Idempotent replay of an already-Locked record

Calling `postOpeningBalanceRecord()` again on a record already `Locked`
(the common case: a client retries a timed-out request) returns the
existing `{ record, alreadyPosted: true }` without any ledger or balance
mutation. `postingKey @unique` on `LedgerEntry` is the ledger-layer backstop
if a caller ever bypassed the workflow-layer check — identical defense in
depth to Invoice and Collection posting.

---

## 7. Import Readiness (Not Built, Only Architected)

Per the brief, no import UI is built in this phase. The architecture is
ready:

- `OpeningBalanceSource` enum already includes `CsvImport`, `ExcelImport`,
  `ErpMigration` alongside `Manual`.
- `postOpeningBalanceBatch(tx, recordIds, actorId)` runs each record's
  `postOpeningBalanceRecord` independently, collecting per-row
  success/failure so one bad row in a 500-row import never rolls back the
  other 499.
- A future importer's only job: parse rows → call
  `createOpeningBalanceRecord` per row (or a future bulk-create helper) with
  `source` set appropriately → call `postOpeningBalanceBatch` → render the
  success/failure report. No change to `opening-balance.ts`,
  `posting-service.ts`, or the Prisma schema is anticipated.

---

## 8. UI — Enterprise Wizard, Not Dealer Edit

**Route:** `/opening-balances` (dealer selection list) → `/opening-balances/new?dealerCode=...` (wizard)

**Steps:** Dealer Selection → Opening Balance Entry → Validation →
Confirmation → Posting → Success — a linear accountant workflow, never a
form embedded in the Dealer Edit page. The wizard supports resuming an
in-progress `Draft`/`Validated` record via `initialDealerCode`, so a browser
refresh mid-flow does not orphan a draft or force a duplicate-initialization
error.

**RBAC:** reuses the existing `invoices:create` permission (Super_Admin,
Accounts) rather than inventing a new permission key — `permissions.ts` is
explicitly forbidden from modification in this phase, and `invoices:create`
already gates the correct financial-actor population.

---

## 9. Server Actions

| Action | File | Effect |
|--------|------|--------|
| `createOpeningBalanceDraft()` | `src/lib/actions/opening-balance/create-opening-balance-draft.ts` | `NotInitialized → Draft` |
| `validateOpeningBalance()` | `src/lib/actions/opening-balance/validate-opening-balance.ts` | `Draft → Validated` (field-level issues returned, never thrown, for inline UI display) |
| `postOpeningBalance()` | `src/lib/actions/opening-balance/post-opening-balance.ts` | `Validated → Posted+Locked` |
| `getInitializationStatus()` | `src/lib/actions/opening-balance/get-initialization-status.ts` | Read-side status lookup (resume / guard) |
| `listUninitializedDealers()` | `src/lib/actions/opening-balance/list-uninitialized-dealers.ts` | Paginated dealer-selection source |

All five call ONLY `opening-balance-service.ts` / `initialization-status.ts`
— never the core engine or `posting-service.ts` directly — so RBAC, Zod
parsing, and `revalidatePath()` stay centralized in one layer per action.

---

## 10. Verification

| # | Invariant | Result |
|---|-----------|--------|
| 1 | Opening Balance posts exactly one `LedgerEntry` (or none for amount = 0) | ✅ PASS |
| 2 | `PostingService` remains the only mutation boundary | ✅ PASS — grep: `createLedgerEntry` imported only by `posting-service.ts`; `postOpeningBalance` is the only new function added there |
| 3 | `Dealer.currentBalance` matches Ledger | ✅ PASS — `assertLedgerBalanceMatchesCache` on every post; live smoke test confirms `12345.67` / `4321.50` parity |
| 4 | Initialization occurs only once | ✅ PASS — `dealerCode @unique` + `assertDealerNotInitialized`; concurrency test scenario 1 |
| 5 | PostingKey prevents duplicates | ✅ PASS — `ledger:OpeningBalance:OB-<dealerCode>:OpeningBalance`; concurrency test scenario 2 |
| 6 | Running balance correct | ✅ PASS — `balance = previousBalance(0) + debit − credit`; replay-vs-cache assertion in unit tests |
| 7 | Audit created | ✅ PASS — `DEALER_OPENING_BALANCE_POSTED` on every post, including zero-amount |
| 8 | Draft cannot affect balance | ✅ PASS — `createOpeningBalanceRecord` never touches `dealer` or `ledgerEntry` |
| 9 | Validation cannot affect balance | ✅ PASS — `validateOpeningBalanceRecord` is a pure status transition |
| 10 | Only Posted affects Ledger | ✅ PASS — `postOpeningBalanceRecord` is the only transition that calls `posting-service.ts` |
| 11 | `npx tsc --noEmit` | ✅ 0 errors |
| 12 | `npx eslint .` | ✅ 0 errors (pre-existing TanStack Table / `<img>` warnings unrelated to this phase) |
| 13 | `npx vitest run` | ✅ 141 passed / 5 skipped (pre-existing DB-optional integration tests unrelated to this phase) |
| 14 | `npx next build` | ✅ Compiles; `/opening-balances` and `/opening-balances/new` render as dynamic routes |

### Live end-to-end proof (real PostgreSQL, not mocks)

A one-time smoke script exercised the full pipeline against the running
Docker database: create draft (`12345.67`) → validate → post → replay-post
(idempotent, `alreadyPosted: true`) → verified `Dealer.currentBalance =
12345.67` → verified exactly one `LedgerEntry`
(`OpeningBalance`/`OpeningBalance`, `debit=12345.67`, `balance=12345.67`) →
verified duplicate draft creation rejected with `ALREADY_INITIALIZED` →
verified the dealer disappeared from `listUninitializedDealers()`. The
script and its test data were deleted after verification; no residue was
left in the shared development database.

---

## 11. Regression Analysis

**No modification** to any forbidden surface: `src/lib/invoices/`,
`src/lib/collections/` (aside from pre-existing PHASE_07B code, untouched
this phase), `src/lib/orders/`, `src/lib/delivery/`, `src/lib/ledger/`
posting functions, `src/components/documents/`, `src/lib/permissions.ts`,
`src/lib/rbac/`, or any reporting/dashboard code.

**Additive only** at the schema level: one new model
(`OpeningBalance`), two new enums (`OpeningBalanceStatus`,
`OpeningBalanceSource`), and new relation fields on `User` / `Dealer` — no
existing column, index, or relation was altered or removed.

**Additive only** at the posting-service level: one new exported function
(`postOpeningBalance`). The three existing functions
(`postReceivableIncrease`, `postReceivableDecrease`,
`postReceivableDecreaseReversal`) are byte-for-byte unchanged.

Full regression suite (delivery, invoice, collection, ledger, posting-service,
opening-balance) passes: **141 passed / 5 skipped** (the 5 skips are
pre-existing DB-optional integration tests unrelated to this phase — see
§12 below for a related finding).

### Related finding (not a regression — pre-existing pattern)

While building the Opening Balance concurrency integration test, we found
that the existing pattern
`it.skipIf(!integrationReady)(...)` used by
`issue-invoice-concurrency.test.ts` and
`ledger-reconciliation.integration.test.ts` evaluates `integrationReady`
**at test-registration time**, before the `beforeAll` hook that sets it ever
runs — so those tests always skip regardless of database availability, not
only when the database is unreachable. This phase's own integration test
(`opening-balance-concurrency.integration.test.ts`) uses the correct
runtime pattern (`ctx.skip()` inside the test body, checked after
`beforeAll` resolves) and was verified to actually execute and pass against
live PostgreSQL. The pre-existing files were **not modified** — they are
outside this phase's forbidden-files list (Invoice) or out of scope
(Ledger reconciliation) — but the gap is logged in `TECH_DEBT.md` (item C8)
for a future test-infrastructure pass.

---

## 12. Future Extension Points

| Extension | Hook |
|-----------|------|
| Bulk Opening Balance Import (CSV/Excel) | `postOpeningBalanceBatch()` + `OpeningBalanceSource.CsvImport`/`ExcelImport` — ship a file parser + import UI only |
| ERP Migration | `OpeningBalanceSource.ErpMigration` + same `createOpeningBalanceRecord`/`postOpeningBalanceBatch` pipeline |
| Company Initialization | New orchestration module beside `opening-balance-service.ts`, same core-engine idiom |
| Branch Initialization | Same pattern; depends on future `Branch` model |
| Fiscal Year Initialization | Same pattern; depends on future fiscal-period model |
| Opening Balance corrections | `postJournalEntry()` / `postManualAdjustment()` / `postCreditNote()` / `postDebitNote()` — reserved `FinancialReferenceType` values already exist; plug into `posting-service.ts` without redesign |
| Dealer subledger statement (PHASE_07D) | Opening Balance's `LedgerEntry` is the first row in every initialized dealer's statement — no special-casing needed, it is a normal `LedgerPostingType.OpeningBalance` entry |

**No refactor required** of Invoice Engine, Collection Engine, Ledger, or
`posting-service.ts`'s existing three functions to support any of the above.

---

## 13. Production Approval

### Question

> Is Opening Balance safe to use for production dealer onboarding?

### Answer

**YES.**

1. Every dealer can be initialized exactly once — enforced at both the
   application layer (`assertDealerNotInitialized`) and the database layer
   (`dealerCode @unique`), and proven safe under real concurrency.
2. Posting reuses the certified `PostingService` boundary with zero new
   mutation primitives — only a new caller of `createLedgerEntry`,
   `assertLedgerBalanceMatchesCache`, and `AuditLog.create`.
3. The one real race condition found during this phase's own testing was
   fixed and proven fixed with a live-database regression test before this
   ADR was written — not deferred.

### Approval

**PHASE_07D — Dealer Subledger & Statement Engine is UNBLOCKED.**

---

## Cross-References

- `FINANCIAL_INVARIANTS.md` §21 — Financial Initialization Engine invariants
- `KNOWN_RISKS.md` — F4 (No Opening Balance Handler) closed
- `TECH_DEBT.md` — M15 (Opening balance document) closed; C8 (skipIf
  registration-time evaluation) logged
- ADR-024 — Financial architecture certification (designed PHASE_07C)
- ADR-025 — Enterprise Ledger Foundation (`buildOpeningBalancePosting`,
  `LedgerPostingType.OpeningBalance`)
- ADR-026 — Enterprise Ledger Posting Engine (posting-service pattern)
- ADR-027 — Enterprise Financial Integrity Certification (approved this phase)
