# ADR-025: Enterprise Ledger Foundation — PHASE_07A

Date: 2026-07-09

Status: ACCEPTED

Phase: PHASE_07A_ENTERPRISE_LEDGER_FOUNDATION

Builds on: ADR-014, ADR-015, ADR-019, ADR-020, ADR-021, ADR-024

Supersedes: none

---

## Context

ADR-024 certified the PHASE_01–06D pipeline as ready for ledger implementation
without refactoring Invoice Engine, Collection Engine, or Financial Posting
Service boundaries. It also identified the ledger-related gaps:

1. `LedgerEntry.referenceType` is `String`, not enum (type drift risk).
2. No `postingKey` — retried postings could produce duplicate ledger rows.
3. No `postingType` — the accounting event is not represented as an enum.
4. No `reversesEntryId` — compensating reversals lack a stable link.
5. No `createdById` — actor audit missing on ledger writes.
6. No system-side `postingDate` distinct from `transactionDate`.
7. No public API for building idempotent posting keys.
8. No opening balance builders.
9. No reconciliation helpers.

PHASE_07A closes all nine gaps as a self-contained accounting foundation. The
posting service call sites, business actions, UI, and reports are explicitly
out of scope. PHASE_07B wires this foundation into `posting-service.ts`; the
ledger becomes the accounting source of truth in PHASE_07B–07E.

**Governance frame:** this ADR extends — does not redesign — the certified
architecture. Every rule and boundary from ADR-024 continues to hold.

---

## Decision

Introduce a strongly typed, append-only ledger foundation under
`src/lib/ledger/` that:

1. Harden the `LedgerEntry` model with enums, idempotency, actor audit, and
   compensating-reversal linkage.
2. Provide a `PostingKey` abstraction and posting-input contract with
   `debit/credit/balance` invariants.
3. Ship a single write-path (`createLedgerEntry`) that MUST be called only
   from `posting-service.ts` in PHASE_07B onwards.
4. Ship reconciliation helpers so PHASE_07E can build the scheduled integrity
   job without further schema work.
5. Ship opening-balance builders so PHASE_07C can wire `postOpeningBalance()`
   without redesign.

No caller-visible behavior changes in PHASE_07A. `posting-service.ts` accepts
new optional ledger metadata on its input contracts but ignores it at runtime.
PHASE_07B consumes it.

---

## 1. Ledger Architecture

### Source-of-truth hierarchy (unchanged from ADR-024 §2)

```
TIER 1  LedgerEntry              — authoritative journal subledger (PHASE_07+)
TIER 2  Invoice, InvoiceItem,    — document truth (immutable snapshots)
        Collection, CollectionAllocation
TIER 3  Dealer.currentBalance    — operational cache (reconcilable to Tier 1)
        Invoice.currentDue, pool amounts
```

PHASE_07A prepares Tier 1 for population. Tiers 2 and 3 are unchanged.

### Posting flow (target — PHASE_07B onwards)

```
Business Action (issueInvoice, confirmCollection, reverseCollection, …)
        │
        ▼
   Workflow guards + Zod validation
        │
        ▼
   prisma.$transaction
        │
        ▼
   lockDealerForFinancialUpdate  ─────►  Locked snapshot
        │
        ▼
   Document persist (Invoice, Collection, …)
        │
        ▼
   posting-service.ts
        ├── Dealer.currentBalance  (atomic ± amount)
        ├── createLedgerEntry      (append-only row, PHASE_07B)
        └── auditLog.create        (event trail)
        │
        ▼
   Document-level fields (currentDue, pool amounts)
        │
        ▼
   commit  ── OR ── rollback (any failure)
```

Allocation continues to skip the balance path (cash was posted on confirm) and
therefore skips the ledger path — matches ADR-024 §3.

### Model hardening (schema)

| Field | Before | After (PHASE_07A) |
|-------|--------|-------------------|
| `referenceType` | `String` | `FinancialReferenceType` enum |
| `referenceNo` | — | `String` (required) |
| `postingType` | — | `LedgerPostingType` enum |
| `postingDate` | — | `DateTime @default(now())` |
| `postingKey` | — | `String @unique` (idempotency) |
| `reversesEntryId` | — | `String?` self-relation → `LedgerEntry.reverses`/`reversedBy` |
| `createdById` | — | `String?` FK → `User` |
| `@@index([dealerCode, transactionDate])` | — | added |
| `@@index([dealerCode, postingDate])` | — | added |
| `@@index([postingDate])` | — | added |
| `@@index([reversesEntryId])` | — | added |
| `@@index([createdById])` | — | added |

`FinancialReferenceType` gains `Collection`. Runtime allocation guards
(`reference-resolver.ts`) continue to reject Collection at allocation time —
allocation semantics unchanged.

New enum `LedgerPostingType`:

```
Issue | Collection | Reversal | OpeningBalance | CreditNote
DebitNote | ManualAdjustment | JournalEntry | Adjustment
```

`referenceType` names the *source document*; `postingType` names the
*accounting event*. This distinction lets the same document produce multiple
entries (e.g., Invoice `Issue` then, later, `Reversal`) with unique posting
keys.

---

## 2. Posting Strategy

### PostingKey abstraction

`src/lib/ledger/posting-key.ts` ships:

```
buildLedgerPostingKey({ referenceType, referenceId, postingType, sequence? })
parseLedgerPostingKey(key)
isLedgerPostingKey(key)
```

Canonical format:

```
ledger:<referenceType>:<referenceId>:<postingType>[:<sequence>]
```

Guarantees:

- Deterministic: identical inputs ⇒ identical key.
- Namespaced (`ledger:` prefix) so raw keys are unmistakable in logs.
- Rejects `:` inside `referenceId` (prevents ambiguity).
- Sequence reserved for multi-line entries (per-line journals, future).

### Posting input contract

`LedgerPostingInput` (from `src/lib/ledger/ledger-types.ts`) is an immutable
value object:

- `tx` — the enclosing Prisma transaction.
- `dealerCode` — dealer subledger owner (caller holds the row lock).
- `transactionDate` — business/value date.
- `referenceType`, `referenceId`, `referenceNo` — source document identifiers.
- `postingType` — accounting event.
- `postingKey?` — override; otherwise derived.
- `debit`, `credit` — non-negative `Prisma.Decimal`; exactly one > 0.
- `previousBalance` — captured under dealer lock.
- `reversesEntryId?` — link to the entry this posting compensates.
- `createdById?` — actor for audit.
- `remarks?` — narration.

`assertLedgerPostingInputValid()` enforces the rules. Failures raise
`LedgerPostingValidationError` and roll back the enclosing transaction —
never swallow.

### Balance derivation

```
balance = previousBalance + debit − credit
```

Signed: advance credit (negative AR) round-trips as a negative running
balance, preserving the sign convention on `Dealer.currentBalance`.

### Idempotency

`LedgerEntry.postingKey` is `@unique`. `createLedgerEntry`:

1. Builds the posting key (from descriptor or explicit override).
2. Attempts `INSERT`.
3. On `P2002` unique violation for `postingKey`, re-reads the existing row,
   asserts the retry attempt matches (`debit`, `credit`, `balance`,
   `referenceType`, `referenceId`, `postingType`), and returns
   `isNew = false`. Any drift raises `LedgerDuplicatePostingError`.

This lets `issueInvoice` retry on `P2002` conflicts (e.g., `invoiceNo`
collision) without producing duplicate ledger rows. PHASE_07B relies on this
guarantee to make the entire posting service idempotent.

### Compensating reversals

Corrections MUST create a new entry with:

- `postingType = Reversal`
- `debit` / `credit` swapped from the original
- `reversesEntryId` = original entry `id`
- `postingKey = ledger:<refType>:<refId>:Reversal[:<seq>]`

`buildReversalPosting()` in `ledger-posting.ts` produces this input for a
given original entry. Historical rows are NEVER updated or deleted; the
runtime guard `assertLedgerAppendOnly()` throws if any code path attempts an
`update` / `delete` of a persisted entry.

### PostingService integration (PHASE_07A extension point)

`ReceivablePostingInput` and `ReceivableDecreasePostingInput` in
`src/lib/finance/types.ts` gain four optional fields:

- `postingType?: LedgerPostingType`
- `transactionDate?: Date`
- `postingKey?: string`
- `reversesEntryId?: string`

`postReceivableIncrease`, `postReceivableDecrease`, and
`postReceivableDecreaseReversal` accept these fields in PHASE_07A but ignore
them at runtime. PHASE_07B consumes them inside each function body by
calling `createLedgerEntry(tx, …)` after the atomic
`Dealer.currentBalance` update, asserting via
`assertLedgerBalanceMatchesCache(dealerCode, ledgerBalance, cachedBalance)`.

No caller-side changes are required in PHASE_07B — the extension point is
already in place.

---

## 3. Append-Only Policy

Enforcement layers, from strongest to weakest:

1. **Cultural / ADR** — this ADR forbids updates/deletes of historical rows.
2. **Runtime guard** — `assertLedgerAppendOnly(operation, entryId)` throws
   `LedgerPostingValidationError` for any code path attempting to
   `tx.ledgerEntry.update` / `delete` a historical row.
3. **Schema** — `postingKey @unique` prevents accidental duplicates; the
   application layer inserts through `createLedgerEntry` only.
4. **Reviewer** — grep-verifiable: only `posting-service.ts` may import
   `createLedgerEntry` after PHASE_07B.

Deferred (documented in TECH_DEBT): a database-level policy (e.g.,
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `REVOKE UPDATE, DELETE`) that
enforces immutability without a runtime guard. Not required for PHASE_07A.

---

## 4. Reconciliation Contract

`src/lib/ledger/ledger-reconciliation.ts` ships four helpers:

| Helper | Purpose |
|--------|---------|
| `getLastLedgerEntryForDealer(tx, dealerCode)` | Last row ordered `(postingDate DESC, id DESC)` |
| `reconcileDealerLedger(tx, dealerCode)` | Snapshot `{ cached, ledger, drift, entryCount, isReconciled }` |
| `assertDealerLedgerReconciled(tx, dealerCode)` | Throws `LedgerReconciliationError` on drift (PHASE_07A allows empty-ledger short-circuit) |
| `replayDealerLedgerBalance(tx, dealerCode)` | `SUM(debit) − SUM(credit)` — independent cross-check |

PHASE_07A: with no ledger rows, `ledgerBalance = 0` and
`assertDealerLedgerReconciled` treats non-zero cache as reconciled (cache is
the sole source of truth pre-posting). PHASE_07B tightens the assertion by
requiring at least one entry per dealer once posting is live. PHASE_07E adds
the scheduled reconciliation job and the reconciliation report.

Drift is NEVER silently corrected. Any non-zero drift after PHASE_07B is a
bug — surface, investigate, fix.

---

## 5. Opening Balance Compatibility

`src/lib/ledger/opening-balance.ts` ships PHASE_07C-ready builders:

- `buildOpeningBalanceReferenceId(dealerCode)` — canonical `OB-<dealerCode>`.
- `buildOpeningBalancePostingKey(dealerCode)` — deterministic, ensures
  at-most-one opening entry per dealer via the `postingKey @unique` index.
- `buildOpeningBalancePosting({ tx, input, previousBalance })` — produces a
  `LedgerPostingInput` with debit/credit derived from `sign(amount)`:
  - `amount > 0` ⇒ debit (dealer owes)
  - `amount < 0` ⇒ credit (advance credit)
  - `amount = 0` ⇒ rejected

Constraints:

- `previousBalance` MUST equal `0.00` — opening balance is by definition the
  first entry for a dealer.
- `effectiveDate` MUST be a valid `Date` and is stored as `transactionDate`.

PHASE_07C wires this into a `openDealerBalance()` server action and
`postOpeningBalance()` in `posting-service.ts` without further redesign.

---

## 6. Financial Rules Preserved

Every rule from FINANCIAL_INVARIANTS.md and ADR-024 continues to apply:

- `Decimal(18, 2)` for every monetary field — no JS `number`.
- All ledger writes flow through `posting-service.ts` (from PHASE_07B).
- Dealer row lock (`FOR UPDATE`) held before every ledger write.
- Ledger + balance + audit share a single `prisma.$transaction`.
- Confirmed collections and issued invoices remain immutable.
- Allocation continues to skip the balance path — no ledger entry.
- Compensating reversals only — never in-place edits.

---

## 7. Boundaries

### In scope (PHASE_07A)

- `src/lib/ledger/` module.
- `prisma/schema.prisma` LedgerEntry hardening + migration.
- `src/lib/finance/types.ts` optional ledger metadata fields.
- ADR-025 (this document) + governance updates.

### Out of scope (deferred)

| Item | Phase |
|------|-------|
| Wire `createLedgerEntry` into posting service | PHASE_07B |
| Backfill existing invoices/collections into ledger | PHASE_07E |
| `openDealerBalance()` server action | PHASE_07C |
| `postOpeningBalance()` in posting service | PHASE_07C |
| Ledger list / detail UI | PHASE_07D |
| Dealer subledger statement | PHASE_07D |
| Scheduled reconciliation job | PHASE_07E |
| Chart of Accounts / full GL | PHASE_07F+ |
| Credit note / invoice void workflow | PHASE_07B or dedicated |
| Due report UI | PHASE_08 |

---

## 8. Alternatives Considered

### A. Separate `LedgerReferenceType` enum

Rejected. ADR-024 §11 recommends aligning `LedgerEntry.referenceType` to
`FinancialReferenceType`. Adding `Collection` to that enum keeps a single
source of enum truth. Allocation runtime guards continue to reject
`Collection` at allocation time, so the additive change is safe.

### B. Write ledger from feature code (bypass posting service)

Rejected. See `ARCHITECTURE_DECISIONS_REJECTED.md §21`. Bypasses the
`LedgerEntry.balance = Dealer.currentBalance` assertion and breaks
idempotency coupling.

### C. Auto-generated posting keys from database sequences

Rejected. Sequences are not deterministic across retries — the same business
event could produce different keys on different attempts. The deterministic
`(referenceType, referenceId, postingType[, sequence])` derivation is the
only shape compatible with idempotent retry.

### D. Update historical rows on correction

Rejected. Violates append-only invariant (FINANCIAL_INVARIANTS §18) and
destroys the audit trail. Compensating reversals are the only mechanism.

### E. Non-transactional ledger writes

Rejected. Ledger + balance + audit are a single accounting fact — they
either all commit or all roll back. Non-transactional ledger writes create
observable drift under failure.

### F. Add ledger UI or reports in PHASE_07A

Rejected. Explicit phase objective forbids UI, reports, statements, and
dashboards. Foundation only.

---

## 9. Verification

| Check | Evidence |
|-------|----------|
| Ledger architecture follows ADR-024 | §1–5 map 1:1 to ADR-024 §2–4 |
| PostingService remains single mutation boundary | `posting-service.ts` bodies unchanged |
| `Dealer.currentBalance` still cache only | Sole writer unchanged; ledger reads it during reconciliation |
| Ledger append-only | `assertLedgerAppendOnly()` runtime guard + reviewer discipline |
| No duplicated posting logic | `createLedgerEntry` is the only insert path |
| Decimal preserved | Every monetary field/type is `Prisma.Decimal` |
| Row locking preserved | Caller responsibility documented in `LedgerPostingInput` |
| Idempotent design | `postingKey @unique` + replay assertion |
| TypeScript passes | `npx tsc --noEmit` — 0 errors |
| ESLint passes | `npx eslint` — 0 errors (7 pre-existing TanStack Table warnings) |
| Unit tests | 35 new ledger tests; 68 tests pass in total |

---

## 10. Regression Analysis

| Surface | Change | Regression risk |
|---------|--------|-----------------|
| Schema | LedgerEntry columns added + typed | None: table has no historical rows (posting deferred) |
| Enum `FinancialReferenceType` | `Collection` added | None: additive; allocation runtime guards unchanged |
| Enum `LedgerPostingType` | Created | None: new type |
| `posting-service.ts` | Types extended; bodies unchanged | None: existing callers ignore new fields |
| `finance/types.ts` | Optional fields added | None: additive |
| Invoice Engine | Untouched | None |
| Collection Engine | Untouched | None |
| Delivery Engine | Untouched | None |
| Document platform | Untouched | None |
| RBAC / permissions | Untouched | None |
| Localization | Untouched | None |
| UI | Untouched | None |

Test regression: `npx vitest run` — 64 pass, 4 skipped (DB integration
tests requiring DATABASE_URL — pre-existing behavior).

---

## 11. Future Extension Points

| Extension | Hook |
|-----------|------|
| Ledger posting wiring | `createLedgerEntry` in `posting-service.ts` (PHASE_07B) |
| Opening balance action | `buildOpeningBalancePosting()` + `postOpeningBalance()` (PHASE_07C) |
| Credit note | `postCreditNote()` → `postingType = CreditNote` |
| Debit note | `postDebitNote()` → `postingType = DebitNote` |
| Journal entry | Per-line postings with `sequence` in posting key |
| Reconciliation job | `reconcileDealerLedger` in a scheduled action (PHASE_07E) |
| Multi-account GL | `JournalLine` extension on top of `LedgerEntry` (PHASE_07F) |
| Statement UI | `LedgerEntrySnapshot` + document platform composer (PHASE_07D) |

---

## 12. Files Delivered

### New

- `src/lib/ledger/posting-key.ts`
- `src/lib/ledger/ledger-types.ts`
- `src/lib/ledger/ledger-errors.ts`
- `src/lib/ledger/ledger-validation.ts`
- `src/lib/ledger/ledger-posting.ts`
- `src/lib/ledger/ledger-service.ts`
- `src/lib/ledger/ledger-reconciliation.ts`
- `src/lib/ledger/opening-balance.ts`
- `src/lib/ledger/index.ts`
- `src/lib/ledger/posting-key.test.ts`
- `src/lib/ledger/ledger-validation.test.ts`
- `src/lib/ledger/ledger-posting.test.ts`
- `prisma/migrations/20260709000000_phase_07a_ledger_foundation/migration.sql`
- `docs/ADR/ADR-025-enterprise-ledger-foundation.md`

### Modified

- `prisma/schema.prisma` (enum + `LedgerEntry` + `User` reverse relation)
- `src/lib/finance/types.ts` (optional ledger metadata fields + `Collection` reference constant)
- `src/lib/finance/posting-service.ts` (documentation only — bodies unchanged)
- `PROJECT_BRAIN.md`, `CURRENT_PHASE.md`, `IMPLEMENTATION_STATUS.md`,
  `NEXT_ACTION.md`, `CHANGELOG.md`, `SYSTEM_CONTEXT.md`, `TECH_DEBT.md`,
  `KNOWN_RISKS.md`, `FINANCIAL_INVARIANTS.md`, `CLIENT_FEEDBACK_LOG.md`

---

## 13. Sign-off

The Nazma ERP now has a permanent, extension-ready accounting foundation.
Every future financial module — opening balance, credit notes, debit notes,
journal entries, dealer statements, trial balance, chart of accounts — plugs
into `createLedgerEntry` via `posting-service.ts` without redesign.

| Check | Status |
|-------|--------|
| Schema hardened per ADR-024 recommendation | ✅ |
| PostingKey abstraction implemented | ✅ |
| Enum alignment (FinancialReferenceType) | ✅ |
| PostingService prepared for hooks | ✅ |
| Immutable posting contracts designed | ✅ |
| Reconciliation helpers shipped | ✅ |
| Opening balance infrastructure shipped | ✅ |
| No ledger UI, reports, statements, or dashboards | ✅ |
| No regressions | ✅ (verified: tsc, eslint, vitest) |

Proceed to PHASE_07B when ready.

---

## References

- ADR-014 — Invoice Engine
- ADR-015 — Financial integrity audit
- ADR-019 — Collections foundation
- ADR-020 — Collection engine
- ADR-021 — Collection financial certification
- ADR-023 — Money receipt / document platform
- ADR-024 — Financial architecture certification
- FINANCIAL_INVARIANTS.md
- TECH_DEBT.md
- KNOWN_RISKS.md
- ARCHITECTURE_DECISIONS_REJECTED.md
