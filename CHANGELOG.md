# CHANGELOG

All notable changes to Nazma ERP are documented here.

---

## [PHASE_07B.5_ENTERPRISE_FINANCIAL_INTEGRITY_CERTIFICATION] — 2026-07-09

### Purpose

Chief ERP Architecture Audit before Opening Balance. Certify every financial
path; grep repository for bypasses; implement reconciliation tests; remediate
defects; document production approval in ADR-027. No feature work.

### Added

- **`validateDealerLedgerChain`** — per-dealer running balance chain + replay validation
- **`assertDealerLedgerIntegrity`** — raises on chain, replay, or cache drift
- **`reconcileAllDealers`** — repository-wide integrity scan
- **Unit tests** — `ledger-reconciliation.test.ts` (9 tests)
- **Integration test** — `ledger-reconciliation.integration.test.ts` (live DB scan)
- **ADR-027** — Enterprise Financial Integrity Certification

### Fixed

- **`assertDealerLedgerReconciled`** — empty ledger reconciled only when
  `Dealer.currentBalance = 0.00`; non-zero cache with no ledger rows now
  correctly flagged (pre-PHASE_07B / pre-backfill drift)

### Certification Verdict

- Financial Certification Score: **9.3 / 10**
- Production Readiness Score: **9.1 / 10** (up from 8.7)
- **Opening Balance (PHASE_07C): APPROVED**

### Verification

- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 92 passed / 5 skipped

### Next

**PHASE_07C — Opening Balance** (`postOpeningBalance()` + server action)

---

## [PHASE_07B_LEDGER_POSTING_INTEGRATION] — 2026-07-09

### Purpose

Wire the PHASE_07A ledger foundation into the Financial Posting Service.
Every receivable event now permanently creates an immutable `LedgerEntry`;
`LedgerEntry.balance` is asserted equal to `Dealer.currentBalance` on
every commit. No caller, business workflow, UI, or schema change. The
ERP now has a true, append-only accounting subledger backing every
dealer receivable mutation.

### Added

- **`createLedgerEntry` wired inside `postReceivableIncrease`,
  `postReceivableDecrease`, `postReceivableDecreaseReversal`.**
  - Invoice issue → `postingType = Issue`, Debit = `grandTotal`
  - Collection confirm → `postingType = Collection`, Credit = `receivedAmount`
  - Collection reverse → `postingType = Reversal`, Debit = `receivedAmount`,
    `reversesEntryId` linked to the canonical original entry when found
- **`assertLedgerBalanceMatchesCache`** now runs after every ledger
  insert — `LedgerEntry.balance === Dealer.currentBalance` invariant
  enforced at every commit.
- **Audit payload cross-references** — `ledgerEntryId`,
  `ledgerPostingKey`, `ledgerPostingType`, `ledgerIsNew`, and (on
  reversal) `ledgerReversesEntryId` added to `DEALER_BALANCE_UPDATED` /
  `DEALER_BALANCE_DECREASED` rows.
- **Semantic correction** — `postReceivableDecrease` and
  `postReceivableDecreaseReversal` callers in `allocation-engine.ts`
  now pass `FINANCIAL_REFERENCE_COLLECTION` for the posting
  `referenceType`. Allocation runtime guards unchanged. Resolves the
  ADR-024 §10 low-priority item.
- **Unit tests — 19 new tests:**
  - `src/lib/finance/posting-service.test.ts` (12) — in-memory Prisma
    transaction stub exercising every posting function, sign
    convention, parity assertion, drift rollback, allocation
    short-circuit, and full lifecycle (Issue → Collection → Reversal).
  - `src/lib/ledger/ledger-service.test.ts` (7) — `createLedgerEntry`
    idempotent replay behavior (`P2002` on `postingKey` collapses to
    `isNew = false` on matching payload; raises
    `LedgerDuplicatePostingError` on payload drift) and
    `assertLedgerBalanceMatchesCache` on drift.
- **Concurrency test coverage extended.**
  `issue-invoice-concurrency.test.ts` (integration, DB-backed) now
  asserts:
  - Parallel invoice issues produce a chained ledger with running
    balance equal to `Dealer.currentBalance`.
  - Credit-limit rejection rolls back the ledger insert atomically
    (exactly one ledger row for the winning issue).
  - Concurrent duplicate submission and sequential retry each produce
    exactly one ledger row (postingKey unique + workflow guard).
- **ADR-026 — Enterprise Ledger Posting Engine.**

### Changed

- `src/lib/finance/posting-service.ts` — bodies now insert
  `LedgerEntry` + assert balance + write ledger cross-references in
  audit; public API unchanged.
- `src/lib/collections/allocation-engine.ts` — `referenceType` for
  collection cash-receipt and reversal postings switched from
  `Invoice` to `Collection` (semantic correction).
- `PROJECT_BRAIN.md`, `CURRENT_PHASE.md`, `IMPLEMENTATION_STATUS.md`,
  `NEXT_ACTION.md`, `SYSTEM_CONTEXT.md`, `FINANCIAL_INVARIANTS.md`,
  `TECH_DEBT.md`, `KNOWN_RISKS.md` — reflect PHASE_07B completion.

### Not Changed

- Prisma schema — no migration required.
- Invoice Engine, Collection Engine, Delivery Engine, Order Engine —
  untouched.
- Document platform, RBAC, localization, UI — untouched.
- Public caller signatures of `postReceivable*` functions.
- Allocation semantics — still skips balance path AND ledger path
  (cash already posted on confirm).
- Financial calculations, dealer balance semantics, decimal handling.

### Architecture

- The ledger is now Tier 1 authoritative in the source-of-truth
  hierarchy (ADR-024 §2) for every receivable event from this point
  forward.
- `Dealer.currentBalance` is now a verified operational cache — proven
  equal to `LedgerEntry.balance` on every commit by
  `assertLedgerBalanceMatchesCache`.
- Compensating reversals are the ONLY correction mechanism —
  `postingType = Reversal` with `reversesEntryId`. No in-place edits
  to historical rows.
- Idempotency operates in two layers: caller workflow guards
  (short-circuit on already-posted state) and ledger `postingKey`
  uniqueness (defense-in-depth backstop).

### Verification

- `npx tsc --noEmit` — 0 errors
- `npx eslint .` — 0 errors (7 pre-existing TanStack Table warnings)
- `npx vitest run` — 83 passed / 4 skipped (DB integration tests
  requiring `DATABASE_URL`; pre-existing behavior)

### Next

**PHASE_07C — Opening Balance:** `openDealerBalance()` server action +
`postOpeningBalance()` in `posting-service.ts` using
`buildOpeningBalancePosting`. Then PHASE_07D (Ledger UI + dealer
statement) and PHASE_07E (reconciliation + backfill).

---

## [PHASE_07A_ENTERPRISE_LEDGER_FOUNDATION] — 2026-07-09

### Purpose

Deliver a permanent accounting foundation on top of the PHASE_06D-certified
financial architecture. Foundation only — no ledger UI, no reports, no
statements, no dashboards, no data migration, no wired posting. Every future
financial module (opening balance, credit notes, debit notes, journal
entries, dealer statements, trial balance, chart of accounts) can now be
implemented without redesigning the existing financial architecture.

### Added

- **Prisma schema — `LedgerEntry` hardening:**
  - `referenceType` changed from `String` to `FinancialReferenceType` enum
  - `referenceNo String` (required human-readable reference)
  - `postingType LedgerPostingType` (new enum — accounting event)
  - `postingDate DateTime @default(now())` (system-side timestamp)
  - `postingKey String @unique` (idempotency guard)
  - `reversesEntryId String?` self-relation (`reverses` / `reversedBy`)
  - `createdById String?` FK to `User`
  - Composite indexes on `(dealerCode, transactionDate)` and
    `(dealerCode, postingDate)`
  - Additional indexes on `postingDate`, `reversesEntryId`, `createdById`
- **New enum `LedgerPostingType`** — `Issue`, `Collection`, `Reversal`,
  `OpeningBalance`, `CreditNote`, `DebitNote`, `ManualAdjustment`,
  `JournalEntry`, `Adjustment`
- **`FinancialReferenceType.Collection`** added (allocation runtime guards
  unchanged)
- **`User.ledgerEntriesCreated`** reverse relation
- **`src/lib/ledger/` module** (9 files):
  - `posting-key.ts` — `buildLedgerPostingKey`, `parseLedgerPostingKey`,
    `isLedgerPostingKey`; canonical format
    `ledger:<referenceType>:<referenceId>:<postingType>[:<sequence>]`
  - `ledger-types.ts` — `LedgerPostingInput`, `LedgerPostingResult`,
    `LedgerEntrySnapshot`, `DealerLedgerReconciliation`,
    `OpeningBalanceInput`, `LEDGER_ENTITY_TYPE`
  - `ledger-errors.ts` — `LedgerError`, `LedgerPostingValidationError`,
    `LedgerDuplicatePostingError`, `LedgerBalanceMismatchError`,
    `LedgerImmutabilityError`, `LedgerReconciliationError`
  - `ledger-validation.ts` — `assertLedgerPostingInputValid`,
    `applyPostingToBalance`, `assertLedgerAppendOnly`
  - `ledger-posting.ts` — `buildLedgerEntryCreateData`,
    `buildReversalPosting`, `LedgerEntryCreateData`
  - `ledger-service.ts` — `createLedgerEntry` (single write path,
    idempotent via `postingKey`, replay-safe),
    `assertLedgerBalanceMatchesCache`
  - `ledger-reconciliation.ts` — `getLastLedgerEntryForDealer`,
    `reconcileDealerLedger`, `assertDealerLedgerReconciled`,
    `replayDealerLedgerBalance`
  - `opening-balance.ts` — `buildOpeningBalanceReferenceId`,
    `buildOpeningBalancePostingKey`, `buildOpeningBalancePosting`,
    `OPENING_BALANCE_REFERENCE_PREFIX`
  - `index.ts` — public surface
- **`src/lib/finance/types.ts`** — `FINANCIAL_REFERENCE_COLLECTION`
  constant; optional `postingType`, `transactionDate`, `postingKey`,
  `reversesEntryId` on `ReceivablePostingInput` and
  `ReceivableDecreasePostingInput` (extension points for PHASE_07B)
- **Prisma migration** —
  `prisma/migrations/20260709000000_phase_07a_ledger_foundation/migration.sql`
- **ADR-025** — Enterprise Ledger Foundation
- **Unit tests** — 35 new tests: `posting-key.test.ts` (12),
  `ledger-validation.test.ts` (14), `ledger-posting.test.ts` (9)

### Changed

- `src/lib/finance/posting-service.ts` — documentation only (PHASE_07A
  extension-point note); function bodies unchanged
- `PROJECT_BRAIN.md`, `CURRENT_PHASE.md`, `IMPLEMENTATION_STATUS.md`,
  `NEXT_ACTION.md` — reflect PHASE_07A completion
- `TECH_DEBT.md`, `KNOWN_RISKS.md`, `FINANCIAL_INVARIANTS.md`,
  `SYSTEM_CONTEXT.md`, `CLIENT_FEEDBACK_LOG.md` — updated ledger references

### Architecture

- `LedgerEntry` is the future Tier 1 accounting source of truth
  (ADR-024 §2). `Dealer.currentBalance` remains a Tier 3 denormalized
  operational cache.
- `createLedgerEntry` is the SINGLE ledger write path. Only
  `posting-service.ts` may invoke it (from PHASE_07B onwards).
- Append-only invariant enforced by (1) the `postingKey @unique` schema
  constraint, (2) the `assertLedgerAppendOnly` runtime guard, and (3) code
  review discipline. Compensating reversals only — never in-place edits.
- Idempotent posting: retried business actions collapse to the same
  ledger row via deterministic `postingKey`.
- Balance derivation: `balance = previousBalance + debit − credit`.
  Signed to preserve advance credit semantics.
- Extension-ready: opening balance, credit notes, debit notes, journal
  entries, and multi-account GL plug into the same abstraction.

### Verification

- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors (7 pre-existing TanStack Table warnings — TECH_DEBT L12)
- `npx vitest run` — 64 pass / 4 skipped (pre-existing DB integration tests
  requiring `DATABASE_URL`)

### Scope

Foundation layer only. Zero changes to Invoice Engine, Collection Engine,
Order Engine, Delivery Engine, Document Platform, UI, RBAC, localization,
or any feature-level business logic. `posting-service.ts` runtime behavior
is byte-for-byte identical to PHASE_06D.

### Migration

Run the following against every environment (dev, staging, production)
before starting PHASE_07B:

```
npx prisma migrate deploy
npx prisma generate
```

The migration is additive for `LedgerEntry` (no historical rows exist) and
additive for `FinancialReferenceType`. No downtime.

---

## [PHASE_06D.2_ENTERPRISE_DOCUMENT_PLATFORM_DESIGN_FREEZE] — 2026-07-09

### Purpose

Enterprise Document Platform production design freeze. All future printable documents (Invoice, Money Receipt, Delivery Challan, Ledger Statement, Dealer Statement, Credit Note, Return Slip) inherit this design system with zero major UI redesign effort. Presentation layer only — no accounting, posting, workflow, or schema changes.

### Added

- **Design tokens** (`src/lib/documents/design-tokens.ts`) — `DOC_COLORS`, `DOC_TYPOGRAPHY`, `DOC_SPACING`, `DOC_PRODUCT_TABLE_COLS`, `DOC_DATA_TABLE_COLS`
- **`authorizedBy`** field added to `DocumentLabels` (single-signature label)
- **`dealerInfo`** field added to `DocumentLabels` (single B2B dealer section label)
- **EN/BN localization** — `document.invoice.dealerInfo`, `document.invoice.authorizedBy`, updated `pleaseNote` / `pleaseNoteText` / `footerThanks`

### Changed

- **CompanyHeader** — 32pt `font-black` company name; vertical rule separator between brand and address; professional T/E/W address prefixes replacing emoji symbols
- **DocumentTitle** — upgraded to 17pt `font-black` with 0.12em letter-spacing and increased vertical margins
- **InvoiceMetadata** — single "Dealer Information" section (B2B: removed redundant Ship To column); `labels.dealerInfo` replaces `labels.billTo` / `labels.shipTo`
- **DocumentFinancialSummary** — added `divider?: boolean` to `DocumentFinancialLine`; renders a thin separator between line groups
- **FinancialSummary** — divider applied between Invoice Amount group (Subtotal, Grand Total) and Due Summary group (Previous Due, Current Due, Outstanding)
- **document-print.css** — `col-name` expanded to 42%; tabular-nums (`font-variant-numeric: tabular-nums`) on `col-qty`, `col-price`, `col-amount`, `col-ref-amount`; `doc-numeric` utility class; footer blue top bar; padding improvements
- **CompanyFooter** — enterprise layout: 2px blue top bar + "Confidential — For addressee only" left label + thank-you message right-aligned
- **InvoicePrintable** — PaymentTerms section removed; single `DocumentSignature` with `[labels.authorizedBy]`; uses `labels.dealerInfo`

### Deprecated (DocumentLabels)

- `preparedBy` — superseded by `authorizedBy`
- `checkedBy` — superseded by `authorizedBy`
- `authorizedSignature` — superseded by `authorizedBy`
- `paymentTerms` / `paymentTermsText` — removed from invoice print

### Architecture

- Single `InvoicePrintable` pipeline preserved: Preview = Print = PDF
- Document platform primitives strengthened — no Invoice-specific hacks
- Money Receipt pipeline unaffected (backward-compatible changes)
- Financial architecture (ADR-024) unchanged
- Design freeze: future documents require near-zero styling work

### Scope

Presentation layer only. Zero changes to Prisma schema, PostingService, Invoice Engine, validators, or financial calculations.

---

## [PHASE_06D.1_INVOICE_PDF_CLIENT_REVISION] — 2026-07-09

### Purpose

Client-approved invoice layout revision 2 (presentation layer only). Supersedes the fixed 20-row A4 invoice grid with dynamic product rows. No financial, posting, workflow, or schema changes.

### Changed

- **Company header** — enlarged Nazma brand name; WATER TAPS remains subtitle via `getCompanyBranding()`
- **Product table** — dynamic rows only (actual line items); removed 20-row padding and truncation warning
- **Print removals** — discount column, VAT row, Due Date hidden on printable invoice (DTO/calculations unchanged)
- **Sales person** — displays Sales Order creator name (`order.createdBy.name`), not dealer territory
- **Signatures** — blank Prepared By / Checked By / Authorized Signature lines (no printed names)
- **Print CSS** — natural table growth; multi-page print allowed; column widths redistributed

### Architecture

- Single `InvoicePrintable` pipeline preserved: Preview = Print = PDF
- Document platform primitives only — no duplicated templates
- Financial architecture (ADR-024) unchanged

### Files Modified

Document platform components, invoice document loader (`helpers.ts`), types, localization (EN/BN), ADR-017, ADR-018, governance docs.

### Scope

Presentation layer only. Zero changes to Prisma schema, PostingService, Invoice Engine, validators, or financial calculations.

---

## [REPOSITORY_MIGRATION_AND_METADATA_DUMP] — 2026-07-01

### Purpose

Permanent institutional knowledge consolidation after PHASE_06C (Document Platform) and PHASE_06D (Financial Architecture Certification). Architecture metadata extracted from codebase, ADRs, and governance history into dedicated repository memory files for future AI sessions. **No application code, schema, migrations, or business logic changes.**

### Files Created

- `SYSTEM_CONTEXT.md` — high-level ERP architecture, modules, deployment, RBAC, data flow, extension points
- `CLIENT_FEEDBACK_LOG.md` — client request history (implemented, pending, deferred, rejected)
- `FINANCIAL_INVARIANTS.md` — mandatory accounting rulebook
- `TECH_DEBT.md` — deferred improvements (critical / medium / low)
- `KNOWN_RISKS.md` — operational risk register with mitigation status
- `ARCHITECTURE_DECISIONS_REJECTED.md` — rejected designs and rationale

### Files Updated

- `PROJECT_BRAIN.md` — appended PHASE_06A–06D learnings (document platform, money receipt, posting service, allocation, advance payment, ledger design)
- `NEXT_ACTION.md` — roadmap: Invoice PDF Patch → PHASE_07A–07C → Reporting → Analytics → Production Hardening
- `CHANGELOG.md` — this entry

### Architecture Summary

- **Pipeline certified:** Order → Challan → Invoice → Collection → Money Receipt (8.7/10 readiness)
- **Document Platform:** canonical `Document*` primitives; invoice + money receipt on single print pipeline
- **Financial boundary:** `posting-service.ts` sole `Dealer.currentBalance` writer; allocation does not double-post
- **Source of truth:** Ledger (future Tier 1) → documents (Tier 2) → `currentBalance` cache (Tier 3)
- **Next:** Invoice PDF patch polish, then PHASE_07A ledger schema hardening

### Scope

Documentation and repository metadata only. Zero TypeScript, React, Prisma, or UI changes.

---

## [PHASE_06D_FINANCIAL_ARCHITECTURE_CERTIFICATION] — 2026-06-30

### Added

- **ADR-024** — Financial Architecture Certification: full pipeline review, source-of-truth hierarchy, posting strategy, ledger design, dealer statement architecture, allocation/advance certification, reporting readiness, risk register, PHASE_07 breakdown

### Certification Verdict

- Financial architecture **certified** for PHASE_07 Ledger — no refactor of Invoice Engine, Collection Engine, or Financial Posting Service required
- Source of truth: `LedgerEntry` (future authoritative) → financial documents → `Dealer.currentBalance` (operational cache)
- All future financial operations must route through `posting-service.ts`
- Generic `CollectionAllocation` abstraction certified — no redesign for OpeningBalance, CreditNote, DebitNote, JournalEntry
- Advance payment / negative AR balance certified for statement and ledger compatibility
- Overall ERP production readiness score: **8.7 / 10**

### Recommended PHASE_07 Sequence

- **07A** — Ledger schema hardening (`postingKey`, enum alignment)
- **07B** — Ledger posting in `posting-service.ts`
- **07C** — Opening balance
- **07D** — Ledger UI + dealer subledger statement
- **07E** — Reconciliation & backfill
- **07F** — Chart of Accounts foundation (optional)

### Scope

Architecture certification and governance documentation only. No application code, migrations, server actions, or UI.

---

## [PHASE_06C_ENTERPRISE_MONEY_RECEIPT_ENGINE] — 2026-06-30

### Added

- **ERP Document Platform** — canonical primitives: `DocumentTitle`, `DocumentParties`, `DocumentMetadata`, `DocumentTable`, `DocumentFinancialSummary`, `DocumentNotes`, `DocumentSignature`, `DocumentSeal`, `DocumentPrintToolbar`
- **Money Receipt engine** — `MoneyReceiptPrintable`, `MoneyReceiptDocumentPreview`, `mapCollectionToReceiptDocument()`, `loadMoneyReceiptDocument()`
- **Route** — `/collections/[id]/receipt` (preview, print, PDF)
- **`canPrintMoneyReceipt()`** — blocks Draft and Reversed collections
- **`CollectionDocumentActions`** — preview / print / PDF on collection detail
- **ADR-023** — Enterprise Money Receipt Engine architecture
- **Bilingual localization** — `document.receipt.*` keys (EN + BN)

### Changed

- `InvoicePrintable` refactored to compose document platform primitives
- `ProductTable` and `InvoiceMetadata` use shared `DocumentTable` / `DocumentMetadata`
- `CollectionDetailDTO` extended with dealer contact fields for receipt party block
- Collection list print action enabled for printable statuses

### Verification

- `npx prisma generate` — OK
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors

### Scope

- No ledger, dealer statements, due reports, email/SMS, or digital signature logic

---

## [PHASE_06B_ENTERPRISE_COLLECTIONS_UI] — 2026-06-30

### Added

- **Enterprise Collections UI** — list, create/confirm workspace, allocation, detail, reversal
- **Routes** — `/collections`, `/collections/new`, `/collections/[id]`, `/collections/[id]/edit`, `/collections/[id]/allocate`
- **`getDealerCollectionContext()`** — read-only dealer financial summary + allocatable invoices
- **`fetchCollectionHistory()`** — audit timeline on collection detail
- **ADR-022** — Enterprise Collections UI architecture
- **Bilingual localization** — English and Bengali collection strings

### UI Features

- Collection list: search, pagination, sorting, status/payment/dealer/date/advance filters
- Unified Collection Workspace with dealer summary, collection form, allocation table, live summary
- Advance payment info banner and blue advance credit indicator
- Reversal dialog with required reason
- Print placeholder (receipt PDF deferred)

### Verification

- `npx prisma generate` — OK
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors

### Scope

- No backend business logic changes
- No money receipt PDF, ledger, or reports

---

## [PHASE_06A3_FINANCIAL_CONSISTENCY_AUDIT] — 2026-06-30

### Added

- **ADR-021** — Collection Engine financial certification (9.2/10 readiness score)
- **Allocation overpayment guard** — `applyInvoiceAllocation()` rejects when `collectionReceived` would exceed `grandTotal`

### Fixed

- **Invoice allocation cap** — `computeInvoiceOutstanding()` now uses `grandTotal − collectionReceived` instead of `currentDue − collectionReceived`, which double-counted payments and blocked full settlement or allowed overpayment when `previousDue > 0`

### Audit Verdict

- Collection Engine **certified production-ready** for PHASE_06B Collections UI
- All 10 accounting rules verified with evidence
- Statement reconstruction, Ledger readiness, and reporting readiness documented
- Remaining risks: non-blocking (allocation soft-delete, collection concurrency tests)

### Verification

- `npm test` — pass (29 tests)

### Scope

Audit, certification, and one financial hotfix only. No UI, receipt PDF, ledger, or reports.

---

## [PHASE_06A2_COLLECTION_ENGINE_AND_ALLOCATION] — 2026-06-28

### Added

- **Collection server actions** — `createCollection`, `updateCollection`, `confirmCollection`, `cancelDraftCollection`, `reverseCollection`, `getCollection`, `listCollections`, `previewCollectionAllocation`, `allocateCollection`, `deallocateCollection`
- **Generic allocation engine** — `src/lib/collections/allocation-engine.ts` with polymorphic `FinancialReferenceType` (Invoice supported today)
- **Reference resolver** — `src/lib/collections/reference-resolver.ts` for document validation and invoice allocation/reversal
- **Collection workflow guards** — `src/lib/collections/workflow.ts` (Draft → Confirmed → PartiallyAllocated / Allocated → Reversed)
- **Collection number generator** — `COL-000001` sequential (`src/lib/utils/collection-number.ts`)
- **Financial Posting Service** — `postReceivableDecrease()` (cash confirm) and `postReceivableDecreaseReversal()` (collection reversal)
- **Audit events** — `COLLECTION_CREATED`, `COLLECTION_CONFIRMED`, `COLLECTION_ALLOCATED`, `COLLECTION_DEALLOCATED`, `COLLECTION_REVERSED`, `COLLECTION_REVERSED_MISALLOCATION`, `DEALER_BALANCE_DECREASED`
- **ADR-020** — Collection Engine & Allocation architecture
- **Tests** — `src/lib/collections/workflow.test.ts`

### Business Rules

- Cash receipt posted on confirmation; allocation applies pool to invoices without second balance mutation
- `receivedAmount = allocatedAmount + unallocatedAmount` enforced in transactions
- Advance payment supported — negative `Dealer.currentBalance` never rejected
- Collections immutable after confirmation; corrections via reversal only
- Duplicate allocation blocked per `(collectionId, referenceType, referenceId)`

### Verification

- `npx prisma generate` — OK
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors
- `npm test` — pass

### Scope

Backend only. No UI, receipt PDF, reports, dashboards, or LedgerEntry.

---

## [PHASE_06A1_COLLECTIONS_SCHEMA_FOUNDATION] — 2026-06-28

### Added

- **`Collection` model (replaced)** — enterprise cash-receipt design: `collectionNo`, `receivedAmount`, `allocatedAmount`, `unallocatedAmount`, confirmation/reversal metadata
- **`CollectionAllocation` model** — generic polymorphic allocation via `FinancialReferenceType` + `referenceId`
- **Enums** — `CollectionStatus`, `CollectionPaymentMethod`, `FinancialReferenceType`
- **Dealer foundation fields** — `monthlyTarget`, `yearlyTarget`, `totalSales`, `lastCollectionDate`, `lastInvoiceDate`
- **DTO layer** — `src/types/collection.ts` (CollectionDTO, CollectionDetailDTO, CollectionAllocationDTO, DealerFinancialSummaryDTO, AdvancePaymentSummaryDTO, CollectionListItemDTO)
- **Validators** — `src/lib/validators/collection.schema.ts` (create, update, list, identifier, allocation preview, reversal)
- **ADR-019** — Collections Foundation: AR balance semantics, cash pool architecture, generic allocation, advance payment model

### Changed

- **`Dealer.currentBalance`** — formally documented as Accounts Receivable balance (positive: dealer owes; negative: advance/credit)
- **`Invoice`** — removed direct `collections` relation; payments link via `CollectionAllocation`
- **`src/lib/finance/types.ts`** — `FinancialReferenceType` aligned with Prisma enum

### Architecture Notes

- Collection records cash received; allocation is a separate concern (PHASE_06A2)
- `receivedAmount = allocatedAmount + unallocatedAmount` (enforced in future allocation engine)
- Collections immutable after confirmation; corrections via Reversal only
- No server actions, posting, allocation engine, UI, or ledger in this phase

### Verification

- `npx prisma format` — OK
- `npx prisma generate` — OK
- `npx prisma migrate dev` — OK
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors

### Scope

Schema and architecture foundation only. No business logic.

---

## [PHASE_05D3_ENTERPRISE_INVOICE_QA] — 2026-06-27

### Added

- **ADR-018** — Invoice Production Certification (9.0/10 readiness score)
- **`useFormatMoney` hook** — centralized invoice UI money formatting
- **`hasMoneyValue()`** — string-based non-zero money check (no float comparison)
- **Line truncation warning** — screen-only banner when invoice exceeds 20 printable rows
- **Detail financial fields** — `collectionReceived` + `outstanding` on `InvoiceTotalsCard`
- **Issue preview VAT row** — consistent with detail and document surfaces

### Changed

- Payment terms text aligned with `INVOICE_DEFAULT_DUE_DAYS` (30 days)
- Invoice UI components consolidated on `format-money.ts` (removed 4× inline formatters)
- Print CSS resets preview scale transform on print
- Product table — `scope="col"`, `aria-label` for accessibility
- Preview modal — initial focus on close button
- Pipeline timeline — `aria-label`, `aria-current` on PDF step
- BN locale — Bill To / Ship To translated; obsolete PDF placeholder keys removed

### Removed

- Dead `DocumentRenderContext` interface
- Unused `currencyPrefix` label
- Unused `printRootRef` from `useDocumentPrint`
- Obsolete locale keys (`invoice.timeline.pdfFuture`, `invoice.pdf.placeholder*`)

### Verification

- `npx prisma generate` — OK
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors

### Scope

Production QA only. No new business features. Invoice certified for PHASE_06 Collections.

---

## [PHASE_05D2_ENTERPRISE_DOCUMENT_ENGINE] — 2026-06-27

### Added

- **Document Engine** — reusable `DocumentLayout` + section components under `src/components/documents/`
- **InvoicePrintable** — single component for preview, browser print, and Save-as-PDF
- **Invoice preview** — modal on invoice detail via `InvoiceDocumentPreview`
- **Print route** — `/invoices/[id]/print` with print / download toolbar
- **Print CSS** — A4 portrait, fixed 20-row product table, `print-color-adjust: exact`
- **Company branding** — `getCompanyBranding()` in `src/lib/documents/company-branding.ts`
- **Money formatter** — centralized `src/lib/utils/format-money.ts`
- **Logo asset** — `public/branding/nazma-logo.png`
- **ADR-017** — Enterprise Document Engine architecture

### Changed

- `InvoiceDetailDTO` — + dealer address/mobile/email, `outstanding`, `salesPerson`
- `InvoiceActions` — preview, print, and PDF actions (replaces placeholder)
- `InvoiceTimeline` — PDF step marked ready
- `public/locales/en/common.json` & `bn/common.json` — `document.*` keys

### Verification

- `npx prisma generate` — OK
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors

### Scope

Document engine + invoice PDF only. No Collections, Ledger, or Due Reports.

---

## [PHASE_05D1_ENTERPRISE_INVOICE_UI] — 2026-06-25

### Added

- **Invoice List** — `/invoices` with `InvoiceTable`: search, status/dealer/date filters, sorting, pagination, status badges
- **Invoice Detail** — `/invoices/[id]`: header, metadata, dealer, order/challan links, immutable line items, sticky financial summary, audit timeline, PDF placeholder
- **Issue Invoice** — `/invoices/issue`: eligible challan combobox, server financial preview, issue + navigate to detail
- **Challan integration** — `InvoiceActions` + `IssueInvoiceDialog` on confirmed challan detail (`hasInvoice: false`)
- **UI-support actions** — `previewInvoiceFromChallan`, `listInvoiceEligibleChallans`; `getInvoice` attaches `auditHistory`
- **Components** — full `src/components/invoices/*` suite per ADR-016
- **ADR-016** — Enterprise Invoice UI architecture

### Changed

- `InvoiceDetailDTO` — + `auditHistory[]`, preview/eligible challan DTOs
- `middleware.ts` — `/invoices/issue → invoices:create`
- `issueInvoice` — revalidates `/invoices` paths
- `public/locales/en/common.json` & `bn/common.json` — full `invoice.*` keys

### Verification

- `npx prisma generate` — OK
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors (1 pre-existing `useReactTable` warning)

### Scope

UI only. No PDF, Collections, Ledger, or Due Reports.

---

## [PHASE_05C2A_FINANCIAL_CONCURRENCY_HOTFIX] — 2026-06-25

### Fixed

- **Dealer balance lost-update** — pessimistic row lock (`SELECT … FOR UPDATE`) at
  start of `executeIssueInvoiceTransaction()` serializes same-dealer financial mutations
- **Stale `previousDue` / credit TOCTOU** — balance snapshot and credit check occur only
  after dealer lock; post-lock invoice existence re-check for concurrent challan issue
- **Non-atomic balance write** — `postReceivableIncrease()` uses Prisma `{ increment: amount }`
  with `previousBalance` from locked snapshot

### Added

- **`lockDealerForFinancialUpdate()`** — `src/lib/finance/dealer-lock.ts`
- **`executeIssueInvoiceTransaction()`** — extracted single-transaction core in
  `src/lib/invoices/issue-invoice-transaction.ts`
- **Idempotent invoice issue** — existing challan invoice returned on retry; `P2002` on
  `deliveryChallanId` resolves to existing invoice
- **Concurrency integration tests** — `src/lib/invoices/issue-invoice-concurrency.test.ts`
  (parallel same-dealer, credit limit, duplicate challan, sequential retry)

### Verification

- `npx prisma generate` — OK
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors
- `npm test` — pass (integration tests require `DATABASE_URL`)

### Scope

Backend hotfix only. No UI, PDF, Collections, Ledger, or workflow changes.

---

## [PHASE_05C2_FINANCIAL_INTEGRITY_AUDIT] — 2026-06-25

### Added

- **ADR-015** — Pre-production financial integrity audit: 13-section review, production readiness score (7.5/10), mandatory dealer-balance concurrency remediation

### Audit Verdict

- Invoice Engine **architecturally approved** for PHASE_05D and PHASE_06
- **Critical:** concurrent `issueInvoice()` for same dealer can lost-update `Dealer.currentBalance`, corrupt `previousDue`, and bypass credit limit under `READ COMMITTED`
- **Remediation required:** pessimistic dealer row lock or atomic increment (see ADR-015) before high-concurrency production

### Section Summary

| Result | Sections |
|--------|----------|
| PASS | Snapshot integrity, balance write path, current due strategy, transaction boundary, challan→invoice, ledger readiness, audit trail, performance |
| WARNING | Previous due concurrency, credit limit TOCTOU, reporting denormalization, DB locking |
| FAIL | None (one critical defect documented under WARNING with mandatory fix) |

### Scope

Audit and governance only. No application code, UI, or schema changes.

---

## [PHASE_05C1_INVOICE_ENGINE_BACKEND] — 2026-06-25

### Added

- **InvoiceItem model** — immutable line snapshots (`productCode`, `productName`, `unit`, `quantity`, `unitPrice`, `discount`, `lineTotal`); migration `20250625120000_add_invoice_item`
- **Financial Posting Service** — `src/lib/finance/posting-service.ts`: `postReceivableIncrease()` updates `Dealer.currentBalance` + `DEALER_BALANCE_UPDATED` audit (Ledger deferred)
- **Invoice server actions** — `issueInvoice`, `getInvoice`, `listInvoices` in `src/lib/actions/invoices/`
- **Invoice calculator** — `buildInvoiceFromChallanLines()` reuses order Decimal engine; proportional discount from order lines
- **Invoice workflow guards** — `src/lib/invoices/workflow.ts`: Confirmed-only, no duplicate, non-empty challan
- **Invoice number generator** — `INV-000001` sequential (`src/lib/utils/invoice-number.ts`)
- **Domain types** — `src/types/invoice.ts`
- **Validators** — `src/lib/validators/invoice.schema.ts`
- **Tests** — `src/lib/invoices/workflow.test.ts` (workflow, calculator, credit limit)
- **ADR-014** — Invoice Engine backend architecture

### Business Rules

- One Confirmed Delivery Challan → exactly one Invoice (`Invoice.deliveryChallanId` unique)
- Quantities from `DeliveryChallanItem` only; prices from `SalesOrderItem` at issue
- `previousDue` = `Dealer.currentBalance` snapshot before issue
- `currentDue` = `previousDue + grandTotal` (Collections not implemented)
- Credit limit validated only at `issueInvoice()` — rejects with `CREDIT_LIMIT_EXCEEDED`
- `issueInvoice()` creates status `Issued`; VAT = 0

### Audit Events

| Action | AuditLog `action` |
|--------|-------------------|
| Issue invoice | `INVOICE_CREATED` |
| Balance update | `DEALER_BALANCE_UPDATED` |

### Verification

- `npx prisma generate` — OK
- `npx prisma migrate deploy` — OK (when DB available)
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors
- `npm test` — pass

### Scope

Backend only. No Invoice UI, PDF, Collections, or LedgerEntry.

---

## [HOTFIX_ORDERSTATUS_ENUM] — 2026-06-25

### Fixed

- **Production runtime error** — `invalid input value for enum "OrderStatus": "Partially_Delivered"` blocked Delivery Challan create page eligible-order queries.
- **Root cause** — Migration `20250625110000_add_partially_delivered_status` existed in repo and Prisma schema but was never applied to the Docker PostgreSQL database (only `init` + `add_delivery_challan` were recorded in `_prisma_migrations`).

### Applied

- `npx prisma migrate deploy` (Docker app container) — applied `20250625110000_add_partially_delivered_status`
- `npx prisma generate` — Prisma Client regenerated
- `prisma migrate status` — database schema up to date (3/3 migrations)

### Verified

- `SELECT unnest(enum_range(NULL::"OrderStatus"))` — includes `Partially_Delivered`
- Eligible-order query (`Approved` + `Partially_Delivered`) — succeeds (3 Approved orders)
- `/reports` and `/ledger` 404 — navigation placeholders only; modules not yet implemented (PHASE_07 / PHASE_08)

### Scope

Database hotfix only. No new features. No Invoice Engine.

---

## [PHASE_05B_DELIVERY_CHALLAN_UI] — 2026-06-25

### Added

- **Delivery Challan List** — `/delivery-challans` with `ChallanTable`: search, status/dealer/date filters, sorting, pagination, status badges
- **Create Challan** — `/delivery-challans/new`: eligible order combobox, line qty editor with allocatable caps, live fulfillment summary, Save Draft + Confirm Dispatch
- **Challan Detail** — `/delivery-challans/[id]`: header, dealer, order, logistics, enriched product table, audit timeline, confirm/cancel workflow, print
- **Edit Challan** — `/delivery-challans/[id]/edit`: Draft-only; server redirect for Confirmed/Cancelled
- **Components** — `challan-table`, `challan-form`, `challan-detail-view`, `challan-line-editor`, `challan-fulfillment-summary`, `fulfillment-progress-bar`, `challan-workflow-actions`, `challan-history-timeline`, `challan-status-badge`, `eligible-order-combobox`
- **UI-support actions** — `getOrderChallanContext`, `getChallanDetailLines`; `fetchChallanHistory` on detail DTO
- **Client quantity helpers** — `src/lib/delivery/quantity-client.ts` (display-only; server authoritative)
- **Navigation** — Delivery Challans nav item (`orders:view`)
- **ADR-013** — Delivery Challan UI architecture

### Changed

- `DeliveryChallanDetailDTO` — + `remarks`, `confirmedById`, `confirmedByName`, `auditHistory`
- `getDeliveryChallan` — attaches audit history
- Challan mutating actions — revalidate `/delivery-challans` paths
- `middleware.ts` — `/delivery-challans` + `/delivery-challans/new` route permissions
- `public/locales/en/common.json` & `bn/common.json` — full `challan.*` keys

### Verification

- `npx prisma generate` — OK
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors (1 pre-existing useReactTable warning)
- `npm test` — 9/9 pass
- No Prisma schema changes; no Invoice engine

---

## [PHASE_05A2_DELIVERY_CHALLAN_ACTIONS] — 2026-06-25

### Added

- **Server actions** — `createDeliveryChallan`, `updateDeliveryChallan`, `confirmDeliveryChallan`, `cancelDeliveryChallan`, `getDeliveryChallan`, `listDeliveryChallans` in `src/lib/actions/delivery-challans/`
- **Challan number generator** — `src/lib/utils/challan-number.ts` (`CHL-000001` … sequential)
- **Action helpers** — quantity snapshots, fulfillment progress, audit writer, DTO mappers
- **Validators** — `updateDeliveryChallanSchema`, `cancelDeliveryChallanSchema`
- **Workflow tests** — `src/lib/delivery/workflow.test.ts` (9 tests via vitest)
- **`OrderStatus.Partially_Delivered`** — enum value + migration `20250625110000_add_partially_delivered_status`

### Changed

- **`src/lib/delivery/workflow.ts`** — split `computeRemainingQuantity` (display) from `computeAllocatableQuantity` (validation); immutability keyed on confirmed challan count; `assertCanUpdateChallan` / `assertCanCancelChallan`; order status resolves to `Partially_Delivered`
- **`updateOrder`** — `assertOrderLinesMutable` / `assertOrderHeaderMutable` when confirmed challans exist
- **`cancelOrder`** — blocks cancel when confirmed challans exist
- **`getOrder`** — attaches `fulfillment: OrderFulfillmentProgressDTO`
- **`OrderDetailDTO`** — optional `fulfillment` field
- **Localization** — `order.status.Partially_Delivered` (EN + BN)

### Audit Events

| Action | AuditLog `action` |
|--------|-------------------|
| Create challan | `DELIVERY_CHALLAN_CREATED` |
| Update challan | `DELIVERY_CHALLAN_UPDATED` |
| Confirm challan | `DELIVERY_CHALLAN_CONFIRMED` |
| Cancel challan | `DELIVERY_CHALLAN_CANCELLED` |

### Verification

- `npx prisma generate` — OK
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors
- `npm test` — 9/9 pass
- No Invoice / Ledger / Collection / balance mutations in challan actions

### Scope

Backend only. No UI, no Invoice engine.

---

## [PHASE_05A1_DELIVERY_CHALLAN_SCHEMA] — 2026-06-25

### Added

- **`DeliveryChallanStatus` enum** — `Draft`, `Confirmed`, `Cancelled`
- **`DeliveryChallan` model** — `challanNo` (unique), `orderId`, `dealerCode`, `status`, `deliveryMode`, `vehicleNo`, `driverName`, `remarks`, `dispatchedAt`, `createdById`, `confirmedById`, timestamps; indexes on `orderId`, `dealerCode`, `status`, `createdById`, `confirmedById`, `createdAt`, `dispatchedAt`
- **`DeliveryChallanItem` model** — `challanId`, `orderItemId`, `productId`, `quantity Decimal(18,2)`; indexes on `challanId`, `orderItemId`, `productId`; cascade delete from challan header

### Changed

- **`SalesOrder`** — added `deliveryChallans DeliveryChallan[]` one-to-many relation
- **`Invoice`** — added nullable `deliveryChallanId @unique` + `deliveryChallan` relation (one challan → one invoice prep for PHASE_05C)
- **`User`** — added `challansCreated` / `challansConfirmed` back-relations
- **`Dealer`**, **`SalesOrderItem`**, **`Product`** — added delivery challan back-relations

### Migrated (deferred changes bundled)

- **`OrderStatus`** — added `Cancelled` enum value (deferred from PHASE_04A)
- **`Invoice.orderId`** — removed `@unique`, added `@@index([orderId])` (deferred from PHASE_00C)

### Migration

- Baseline `20250625000000_init` marked applied (existing db push schema)
- `20250625100000_add_delivery_challan` applied to Docker Postgres (`nazma-erp-db`)
- `prisma migrate status` — database schema up to date

### Verification

- `npx prisma format` — OK
- `npx prisma generate` — OK
- `npx tsc --noEmit` — 0 errors
- Docker: `DeliveryChallan` + `DeliveryChallanItem` tables confirmed in `nazma_erp`

### Scope

Database only. No server actions, UI, invoice engine, or backend logic changes.

---

## [ADR-012_ARCHITECTURE_REVIEW] — 2026-06-25

### Changed (ADR-012 amended)

- **Quantity semantics split** — `remainingQty` (display) = `ordered − confirmed` only; `allocatableQty` (validation) = `ordered − confirmed − draft`. Draft does not count as delivered.
- **Order immutability refined** — line/header edits blocked after first **Confirmed** challan, not Draft. Amends ADR-011 §10 interpretation.
- **Fulfillment Progress DTO** — documented `OrderLineFulfillmentProgressDTO` and `OrderFulfillmentProgressDTO` with `deliveryPercent` (quantity-weighted at order level).
- **Invoice eligibility** — Draft → no invoice; Confirmed → eligible once; Cancelled → never.

### Scope

Architecture review only. No code, schema, or migration changes.

---

## [PHASE_05A_DELIVERY_CHALLAN_BACKEND] — 2026-06-25

### Added

- **Delivery Challan domain types** — `src/types/delivery-challan.ts`: `DeliveryChallanSummaryDTO`, `DeliveryChallanDetailDTO`, `DeliveryChallanItemDTO`, `OrderFulfillmentProgressDTO`, `OrderLineFulfillmentDTO`, error codes, `ActionResult<T>` envelope
- **Delivery Challan validators** — `src/lib/validators/delivery-challan.schema.ts`: `createDeliveryChallanSchema`, `confirmDeliveryChallanSchema`, `listDeliveryChallansSchema`, `deliveryChallanIdentifierSchema`, `listChallansForOrderSchema`
- **Delivery workflow guards** — `src/lib/delivery/workflow.ts`: `assertCanCreateChallan`, `assertNotOverDelivery`, `assertCanConfirmChallan`, `assertOrderLinesMutable`, `computeRemainingQuantity`, `isOrderFullyDelivered`, `isOrderPartiallyDelivered`, `resolveOrderStatusAfterDelivery`
- **ADR-012** — `docs/ADR/ADR-012-delivery-challan-backend.md`: proposed schema, quantity reconciliation strategy, over-delivery prevention, order completion detection, risks

### Architecture Notes

- **Derived quantities** — `orderedQuantity` from `SalesOrderItem`; `deliveredQuantity` summed from Confirmed challan lines; `remainingQuantity` computed at read time (never stored)
- **Draft challans** lock order line edits; only Confirmed quantities count toward delivery progress
- **Non-financial boundary** — delivery module has no ledger/balance/due/collection imports
- **Schema proposed, not migrated** — `DeliveryChallan`, `DeliveryChallanItem`, `DeliveryChallanStatus` documented in ADR-012; Prisma unchanged in this sub-phase
- **Server actions deferred** — `createChallan`, `confirmChallan`, etc. are the next sub-phase

### Scope

Backend foundation only. No UI, no Invoice engine, no migrations, no Prisma model changes.

---

## [ADR-011_FULFILLMENT_LAYER] — 2026-06-25

### Architecture Milestone: Fulfillment Layer Introduced

The commercial pipeline has been restructured. The direct **Order → Invoice**
path is superseded by a three-layer model:

```
Sales Order  →  Delivery Challan  →  Invoice  →  Collection  →  Ledger  →  Due Report
                 (NON-FINANCIAL)      (FINANCIAL)
```

### Key Decisions (ADR-011)

- **Partial delivery** — one Sales Order may generate multiple Delivery Challans.
- **One Challan → One Invoice** — each confirmed challan produces exactly one invoice.
- **InvoiceItem required** — every invoice must have line items; header-only invoices forbidden.
- **Quantity source** — invoice quantities come from Delivery Challan, not directly from the order.
- **Non-financial boundary** — challans must never affect dealer balance, ledger, due, or collections.
- **Financial boundary** — invoices affect credit exposure, ledger, dealer balance, and due.
- **Logistics ownership** — `vehicleNo`, `driverName`, `deliveryMode` belong to Delivery Challan.
- **Credit limit** — evaluated at invoice issue, not at challan dispatch.
- **Revenue recognition** — at invoice issue, not at order approval or challan dispatch.
- **Order immutability** — order lines become immutable after the first confirmed challan.

### Changed Roadmap

| Old next phase | New sequence |
|----------------|--------------|
| PHASE_05_INVOICE_ENGINE | PHASE_05A Delivery Challan Backend |
| | PHASE_05B Delivery Challan UI |
| | PHASE_05C Invoice Engine |
| | PHASE_05D Invoice UI + PDF |

Invoice Engine **postponed** until the Delivery Challan layer is built.

### Added

- **ADR-011** — `docs/ADR/ADR-011-delivery-challan-fulfillment.md`: fulfillment architecture, partial delivery rules, financial boundaries, credit/revenue policies, order immutability, delivery reporting roadmap.

### Updated Governance Docs

- `PROJECT_BRAIN.md` — Fulfillment Layer, Delivery Challan Module, InvoiceItem requirement, delivery reporting roadmap.
- `CURRENT_PHASE.md` — next phase set to PHASE_05A; order phases marked complete; 05A–05D roadmap added.
- `IMPLEMENTATION_STATUS.md` — architectural decisions table; approved phase sequence.
- `NEXT_ACTION.md` — PHASE_05A implementation goals replace Invoice Engine.

### Scope

Documentation and architecture governance only. No schema changes, no migrations, no application code.

---

## [PHASE_04C_ORDER_COMBOBOX_DIAGNOSTICS] — 2026-06-23

### Fixed

- **DealerCombobox dropdown invisible on Create Order** — `OrderFormSection` used `overflow-hidden`, which clipped the absolutely positioned dealer dropdown at the card border even when React state held dealers (`ready`, `items.length > 0`). Removed `overflow-hidden` from the section shell; the Dealer & Project section now passes `sectionClassName="relative z-20"` so the open list paints above the Order Items card below.
- **DealerCombobox transport / error boundary** — `src/components/orders/dealer-combobox.tsx`: the dealer load previously swallowed failures into `[]` with no `try/catch`. The load is now an explicit state machine (`loading` / `ready` / `error`) that never coerces a failure into an empty list.

### Changed

- `src/components/orders/order-form-section.tsx` — removed `overflow-hidden`; added optional `sectionClassName` prop for stacking when a section hosts popovers.
- `src/components/orders/order-form.tsx` — Dealer & Project section uses `sectionClassName="relative z-20"`.

### Added

- **Transport-aware error classification** — five distinct failure kinds: `ACTION_FAILURE` (typed `{ success: false }` envelope), `NETWORK` (thrown `TypeError`/`fetch`), `PERMISSION` and `SESSION` (`NEXT_REDIRECT`), and `STALE_ACTION` ("Failed to find Server Action … older/newer deployment"). Each maps to a localized message.
- **Actionable error UI** — `role="alert"` state with a localized message and a **Retry** action (or **Refresh page** for a stale Server Action, the only correct recovery for a rotated action id).
- **Dev-only diagnostics** — `logDealerDiagnostic()` logs the failure kind + context via `console.warn`, guarded by `process.env.NODE_ENV === "production"`; no production noise.
- **Localization keys** — `order.form.dealer.error.failed` / `.network` / `.permission` / `.session` / `.stale` / `.retry` / `.refresh` in `public/locales/en/common.json` and `public/locales/bn/common.json`.
- **ADR-010** — `docs/ADR/ADR-010-order-combobox-diagnostics.md`: root cause and the transport/error-boundary decision.

### Root Cause

Two distinct defects, both UI-only:

1. **Visibility (primary on Create Order)** — `OrderFormSection` applied `overflow-hidden` to the card shell. The dealer dropdown is `position: absolute` and opens downward; the list `<ul>` rendered below the section clip edge and was not painted or clickable despite correct React state.
2. **Transport (earlier)** — A stale Server Action reference could throw before returning; missing `try/catch` plus a silent `: []` fallback masked that failure as "No dealers found".

### Verification

- `npx tsc --noEmit` — 0 errors (strict)
- `npx eslint` — 0 errors (3 pre-existing `useReactTable` warnings)
- Dealer dropdown visible and selectable on `/orders/new` after section overflow fix

### Scope

UI-only, additive. No changes to `listDealers`, the Dealer module, the Orders backend, RBAC, or the schema. No Invoice / Collection / Ledger work.

---

## [PHASE_04B_ORDER_UI] — 2026-06-23

### Added

- **Order List** — `src/app/(dashboard)/orders/page.tsx` + `src/components/orders/order-table.tsx`: search, status / dealer / date-range filters, sortable columns, pagination, "Created By" column, status badges
- **Create Order** — `src/app/(dashboard)/orders/new/page.tsx` (+ `page-client.tsx`) and `src/components/orders/order-form.tsx`: dealer selector, project (existing or inline), product line grid with add/remove rows and per-line price override
- **Order Detail** — `src/app/(dashboard)/orders/[id]/page.tsx` (+ `page-client.tsx`) and `src/components/orders/order-detail-view.tsx`: order info, dealer, project, items, financial summary, approval status, audit timeline
- **Edit Order** — `src/app/(dashboard)/orders/[id]/edit/page.tsx` (+ `page-client.tsx`): reuses `OrderForm` in edit mode with status-aware submit; approved orders editable by Manager / Super_Admin
- **Approval UI** — `src/components/orders/approval-actions.tsx`: Approve / Reject / Cancel, shown only when state + role permit, with confirmation dialogs and optional reason; calls existing `approveOrder` / `rejectOrder` / `cancelOrder`
- **Live Financial Summary** — `src/components/orders/order-financial-summary.tsx`: real-time Subtotal / Discount % / Discount Amount / Grand Total, debounced, driven entirely by the server calculator
- **Shared order components** — `order-status-badge.tsx`, `order-empty-state.tsx`, `order-form-section.tsx`, `dealer-combobox.tsx`, `product-line-editor.tsx`, `order-history-timeline.tsx`
- **UI-support server actions** — `src/lib/actions/orders/preview-order-totals.ts` (runs existing `calculateOrderTotals`; converts order-level discount % → per-line amounts) and `src/lib/actions/orders/list-dealer-projects.ts` (read-only active-project list). Both RBAC-guarded by `orders:view`
- **ADR-009** — `docs/ADR/ADR-009-order-ui.md`: UI architecture, approval-workflow UX, pricing-override / discount-percentage rationale

### Changed

- `src/types/order.ts` — added `OrderSummaryDTO.createdByName` (and `OrderDetailDTO.createdByName`); added `OrderLinePreviewDTO` / `OrderTotalsPreviewDTO` for the live preview
- `src/lib/actions/orders/helpers.ts` — `orderSummaryInclude` / `orderDetailInclude` now include `createdBy { id, name }`; DTO serializers populate `createdByName`
- `src/lib/validators/order.schema.ts` — added `previewOrderTotalsSchema` and `dealerProjectsSchema` (+ inferred input types)
- `middleware.ts` — added `/orders/new → orders:create` as a more-specific route before the general `/orders` prefix
- `public/locales/en/common.json` & `public/locales/bn/common.json` — full EN + BN translation keys for the Order UI

### Architecture Notes

- **No client-side money math**: the live summary and submit path both call `previewOrderTotals`, which runs the existing Decimal engine; the per-line discount amounts returned by the preview are the exact values submitted to create/update
- **Order-level discount %** is a UI affordance converted to per-line amounts on the server — no schema change required
- **Hybrid Server/Client**: pages enforce RBAC and pre-load data; client components own interactivity
- **Centralized RBAC**: page guards (`enforcePermission`), middleware, and conditional rendering (`hasPermission`); no inline role checks
- **VAT never shown or computed** (already included in price)

### Verification

- `npx tsc --noEmit` — 0 errors (strict)
- `npx eslint` — 0 errors (3 pre-existing `react-hooks/incompatible-library` warnings on `useReactTable`, shared with the Product/Dealer tables)

---

## [PHASE_04A_ORDER_BACKEND] — 2026-06-23

### Added

- **Order domain types** — `src/types/order.ts`: `OrderSummaryDTO`, `OrderDetailDTO`, `OrderItemDTO`, `ApprovalHistoryDTO`, error codes, `ActionResult<T>`, sort fields (money/quantity exposed as fixed-precision decimal strings)
- **Order validators** — `src/lib/validators/order.schema.ts`: `createOrderSchema`, `updateOrderSchema`, `approveOrderSchema`, `rejectOrderSchema`, `cancelOrderSchema`, `listOrdersSchema`, `orderIdentifierSchema` (localization-key error messages)
- **Financial calculation engine** — `src/lib/utils/order-calculator.ts`: pure, Decimal-only engine (`calculateOrderTotals`, `findInvalidLineIndex`); no float math; VAT always `0.00` (already included in price)
- **Order status workflow** — `src/lib/orders/workflow.ts`: transition matrix + guards (`assertCanApprove`, `assertCanReject`, `assertCanCancel`, `assertCanChangeStatusOnUpdate`, `assertEditable`) raising typed `OrderWorkflowError`
- **Order number generator** — `src/lib/utils/order-number.ts`: sequential `ORD-NNNNNN` codes (transaction-safe, retry on collision)
- **Project code generator** — `src/lib/utils/project-code.ts`: sequential `PRJ-NNNNNN` codes for inline project creation
- **Order server actions** — `src/lib/actions/orders/`: `createOrder`, `updateOrder`, `approveOrder`, `rejectOrder`, `cancelOrder`, `getOrder`, `listOrders` (+ shared `helpers.ts`)
- **Approval audit** — every lifecycle event (CREATE/SUBMIT/UPDATE/APPROVE/REJECT/CANCEL) writes an `AuditLog` row inside the mutation transaction; `ApprovalHistoryDTO` is derived from these rows
- **ADR-008** — `docs/ADR/ADR-008-order-backend.md`: workflow, approval rules, multi-invoice architecture, calculation strategy, and RBAC decisions

### Changed

- `prisma/schema.prisma` — `OrderStatus` enum: added **`Cancelled`** (additive; `Delivered` retained, reserved). No tables, columns, or indexes changed
- `src/lib/permissions.ts` — **Manager** granted `orders:create` and `orders:edit` (in addition to `orders:approve`) per business rules ("Manager can create"; "approved orders may be edited by Manager and Super_Admin")

### Architecture Notes

- **Transaction safety**: `createOrder` validates dealer/project/products, optionally creates an inline project, calculates totals, generates the order number, and persists the order + items + audit entry — all in one `prisma.$transaction`
- **Decimal discipline**: all monetary and quantity math uses `Prisma.Decimal` (`ROUND_HALF_UP`, 2dp); DTOs expose decimal strings; no `number` ever touches money
- **Multi-invoice aware**: cancellation is blocked once any invoice exists; `invoiceCount` surfaced in DTOs (invoice creation itself deferred to PHASE_05)
- **Index review**: existing `SalesOrder` / `SalesOrderItem` indexes fully cover the search dimensions; no new indexes added
- **Centralized RBAC**: every action calls `requirePermission()`; no inline role checks
- **Migration deferred**: the `Cancelled` enum value (and the deferred PHASE_00C invoice-relation change) must be migrated before PHASE_05

### Verification

- `npx prisma generate` — succeeds
- `npx prisma format` — schema valid
- `npx tsc --noEmit` — 0 errors (strict)
- `npx eslint` — 0 errors on all new files
- Logic harness (calculator + workflow + validators) — 22/22 pass

---

## [PHASE_00C_INVOICE_RELATION_CORRECTION] — 2026-06-23

### Changed

- **Invoice ↔ SalesOrder is now one-to-many** — corrected to support the business rule "One SalesOrder may generate multiple Invoices"
- `prisma/schema.prisma` — `Invoice.orderId`: removed `@unique` (column and relation preserved)
- `prisma/schema.prisma` — `Invoice`: added `@@index([orderId])` to preserve FK lookup performance after the implicit unique index was removed
- `prisma/schema.prisma` — `SalesOrder`: changed back-relation `invoice Invoice?` → `invoices Invoice[]`

### Added

- **ADR-007** — `docs/ADR/ADR-007-order-multi-invoice.md`: documents the One Order → Many Invoices decision, scope boundaries, and consequences

### Notes

- `Collection`, `LedgerEntry`, `DueReport`, `Dealer`, `Product`, and `Project` were intentionally NOT modified
- Verified with `npx prisma format` and `npx prisma generate`
- Migration intentionally deferred; Orders module not built in this phase
- Financial reconciliation across multiple invoices per order is application logic (deferred to PHASE_05)

---

## [PHASE_03C_PRODUCT_FORMS] — 2026-06-20

### Added

- **ProductForm** — `src/components/products/product-form.tsx`: Shared create/edit form with money input, toggle, category select, unsaved-change indicator, success feedback, and field-level error display
- **ProductFormSection** — `src/components/products/product-form-section.tsx`: Section card wrapper for grouping product form fields
- **DeactivateProductDialog** — `src/components/products/deactivate-product-dialog.tsx`: Accessible confirmation modal for soft-deactivating a product (isActive = false)
- **New Product page** — `/products/new`: Server Component enforces `products:create`; fetches categories server-side; renders client form
- **Edit Product page** — `/products/[id]/edit`: Server Component enforces `products:edit`; fetches product + categories; renders client form with prefilled values
- **listActiveCategories** — `src/lib/actions/products/list-categories.ts`: Returns active categories alphabetically for the category dropdown
- **ADR-004** — `docs/ADR/ADR-004-product-forms.md`: Documents hybrid page architecture, three-layer RBAC, and soft-delete decision

### Modified

- `src/lib/actions/products/create-product.ts` — `requirePermission("products:create")` guard added at the top of the action
- `src/lib/actions/products/update-product.ts` — `requirePermission("products:edit")` guard added at the top of the action
- `src/components/products/product-table.tsx` — Edit link column added (visible only to `products:edit` users via `useSession`)
- `src/app/(dashboard)/products/page.tsx` — New Product button added (visible only to `products:create` users via `useSession`)
- `middleware.ts` — `/products/new` → `products:create` and `/dealers/new` → `dealers:create` added as more-specific routes before the general view-only prefixes
- `public/locales/en/common.json` — 60+ new keys: `products.form.*`, `products.deactivate.*`, `products.actions.*`, `validation.*` (sku, modelNumber, name, nameBn, categoryId, unit, description)
- `public/locales/bn/common.json` — Bengali translations for all new keys

### Architecture Notes

- **Three-layer RBAC**: middleware prefix → `enforcePermission()` in server component → `requirePermission()` in server action
- **Soft-delete only**: Deactivate sets `isActive = false`; no hard delete exposed in UI; historical data integrity preserved
- **Hybrid page pattern**: Server Component shell for enforcement + data fetch; Client Component for UI + translations
- **Category select**: Populated from live database at request time; only active categories shown

---

## [PHASE_AUTH_02_RBAC] — 2026-06-20

### Added

- **Centralized permission matrix** — `src/lib/permissions.ts` expanded with granular `Resource × Action` permissions for all 11 resources
- **RBAC helpers** — `src/lib/rbac/index.ts`: `canView()`, `canCreate()`, `canEdit()`, `canDelete()`, `canApprove()`, `canWrite()`, `getCapabilities()`, `buildPermissionContext()`
- **Server action guards** — `src/lib/rbac/guards.ts`: `requirePermission()`, `requireAllPermissions()`, `requireAnyPermission()`, `ForbiddenError`, `UnauthorizedError`
- **Server component guards** — `enforcePermission()`, `enforceAuth()`, `checkPermission()` (all in guards.ts)
- **Route-level middleware protection** — 11 route prefixes mapped to permissions; unauthorized → `/access-denied`
- **403 Access Denied page** — `/access-denied`, bilingual (EN/BN), shows user's role, responsive, premium design
- **Real session in DashboardLayout** — dashboard layout now reads `getCurrentUser()` and passes actual `userRole` to `DashboardShell` (was hardcoded `Super_Admin`)
- **RBAC localization keys** — `rbac.*` keys added to English and Bengali locale files

### Modified

- `src/lib/permissions.ts` — Added `Resource`, `Action` types; expanded `Permission` union with 25 granular permissions; corrected `ROLE_PERMISSIONS` for all 4 roles to match official matrix; changed to `import type` for Prisma `UserRole`
- `src/lib/auth/helpers.ts` — Added `requirePermission()` helper
- `middleware.ts` — Added `ROUTE_PERMISSIONS` map and permission check; unauthorized routes redirect to `/access-denied`
- `src/app/(dashboard)/layout.tsx` — Made async; reads session; passes real `userRole` to `DashboardShell`
- `public/locales/en/common.json` — Added `rbac.*` keys
- `public/locales/bn/common.json` — Added `rbac.*` Bengali keys

### Architecture Notes

- Audit-ready: `PermissionCheckContext` type with `checkedAt` field ready for future AuditLog service
- Sidebar and MobileNav already consumed `hasPermission()` — no changes needed; now receive real role from session
- No dealer or product server actions modified

---

## [PHASE_AUTH_01_FOUNDATION] — 2026-06-20

### Added

- **Auth.js v5** (next-auth@beta.31) with Credentials provider
- **bcrypt password hashing** (12 salt rounds) via bcryptjs
- **JWT session strategy** — no database sessions required
- **Login page** (`/login`) — enterprise-quality UI, RHF + Zod, loading state, error messages
- **Route protection middleware** — all dashboard/dealer/product routes require session
- **Super Admin seed** — idempotent, creates `admin@nazma.local` with hashed password
- **Auth helpers** — `getSession`, `getCurrentUser`, `getCurrentRole`, `requireUser`, `requireRole`
- **SessionProvider** — wraps root layout for client-side session access
- **Module augmentation** — `Session`, `User`, `JWT` types extended with `role` and `isActive`
- **Inactive user blocking** — `isActive: false` users receive friendly error on login attempt
- **Auth translation keys** — English and Bengali locale strings for auth module

### Dependencies Added

- `next-auth@^5.0.0-beta.31`
- `bcryptjs@^2.4.3`
- `@auth/prisma-adapter@latest`
- `@types/bcryptjs` (dev)

### Modified

- `prisma/seed.ts` — added `seedAdminUser` call with structured output
- `src/app/layout.tsx` — wrapped with `SessionProvider`
- `public/locales/en/common.json` — added `auth.*` keys
- `public/locales/bn/common.json` — added `auth.*` keys (Bengali)

---

## [PHASE_03A_REVIEW_PRODUCT_SEEDS] — Prior

### Added

- `prisma/seeds/product-categories.ts` — idempotent upsert of 12 categories
- `prisma/seed.ts` — Prisma seed entry point
- `package.json` — `prisma.seed` + `seed` script + `tsx` devDependency

---

## [PHASE_03B_PRODUCT_LIST_UI] — Prior

### Added

- `src/app/(dashboard)/products/page.tsx`
- `src/components/products/product-table.tsx`
- `src/components/products/product-search.tsx`
- `src/components/products/product-status-badge.tsx`
- `src/components/products/product-empty-state.tsx`
- Product translation keys (en + bn)

---

## [PHASE_03A_PRODUCT_BACKEND] — Prior

### Added

- `Category` and `Product` Prisma models
- Product domain types, validators, and CRUD server actions

---

## [PHASE_02C_DEALER_FORMS] — Prior

### Added

- New Dealer form (`/dealers/new`)
- Edit Dealer form (`/dealers/[dealerCode]/edit`)

---

## [PHASE_02B_DEALER_LIST_UI] — Prior

### Added

- Dealer list page with TanStack Table, search, sort, pagination

---

## [PHASE_02A_DEALER_BACKEND] — Prior

### Added

- Dealer domain: types, validators, CRUD server actions

---

## [PHASE_01_FOUNDATION] — Prior

### Added

- Next.js 15+ App Router project scaffold
- Prisma + PostgreSQL setup
- Tailwind CSS + design system
- Dashboard shell layout
- Localization (English + Bengali)
- Dark mode support
