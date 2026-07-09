# CURRENT_PHASE.md



Current Phase:



PHASE_07D1_ENTERPRISE_DEALER_SUBLEDGER_FOUNDATION



Status:



COMPLETE



---



## Roadmap — Fulfillment, Invoicing & Collections



| Phase | Description | Status |

|-------|-------------|--------|

| PHASE_04A_ORDER_BACKEND | Sales Order backend | ✅ COMPLETE |

| PHASE_04B_ORDER_UI | Sales Order UI | ✅ COMPLETE |

| PHASE_04C_ORDER_COMBOBOX_DIAGNOSTICS | DealerCombobox fix | ✅ COMPLETE |

| PHASE_05A_DELIVERY_CHALLAN_BACKEND | Delivery Challan backend (validators, DTOs, workflow guards) | ✅ COMPLETE |

| PHASE_05A1_DELIVERY_CHALLAN_SCHEMA | Delivery Challan Prisma schema + migration | ✅ COMPLETE |

| PHASE_05A2_DELIVERY_CHALLAN_ACTIONS | Server actions, challan number generator, order integration | ✅ COMPLETE |

| PHASE_05B_DELIVERY_CHALLAN_UI | Delivery Challan UI (create from order, list, detail, dispatch) | ✅ COMPLETE |

| PHASE_05C1_INVOICE_ENGINE_BACKEND | Invoice backend from confirmed challan (+ mandatory InvoiceItem) | ✅ COMPLETE |

| PHASE_05C2_FINANCIAL_INTEGRITY_AUDIT | Pre-production accounting review; ADR-015 | ✅ COMPLETE |

| PHASE_05C2A_FINANCIAL_CONCURRENCY_HOTFIX | Dealer row lock, atomic balance, idempotency, concurrency tests | ✅ COMPLETE |

| PHASE_05D1_ENTERPRISE_INVOICE_UI | Invoice list, detail, issue workflow (UI only — no PDF) | ✅ COMPLETE |

| PHASE_05D2_ENTERPRISE_DOCUMENT_ENGINE | Printable invoice document engine (preview, print, PDF) | ✅ COMPLETE |

| PHASE_05D3_ENTERPRISE_INVOICE_QA | Production QA certification before Collections | ✅ COMPLETE |

| PHASE_06A1_COLLECTIONS_SCHEMA_FOUNDATION | Collections schema, DTOs, validators, ADR-019 | ✅ COMPLETE |

| PHASE_06A2_COLLECTION_ENGINE_AND_ALLOCATION | Collection server actions, allocation engine, posting, reversal | ✅ COMPLETE |

| PHASE_06A3_FINANCIAL_CONSISTENCY_AUDIT | Pre-UI financial certification; ADR-021 | ✅ COMPLETE |

| PHASE_06B_ENTERPRISE_COLLECTIONS_UI | Collection list, workspace, allocation UI, reversal UX | ✅ COMPLETE |

| PHASE_06C_ENTERPRISE_MONEY_RECEIPT_ENGINE | Document platform upgrade + Money Receipt printable | ✅ COMPLETE |

| PHASE_06D_FINANCIAL_ARCHITECTURE_CERTIFICATION | Pre-ledger ERP financial architecture review; ADR-024 | ✅ COMPLETE |

| **PHASE_06D.1_INVOICE_PDF_CLIENT_REVISION** | Client-approved invoice layout revision 2 (presentation only) | **✅ COMPLETE** |
| **PHASE_06D.2_ENTERPRISE_DOCUMENT_PLATFORM_DESIGN_FREEZE** | Enterprise design system freeze — design tokens, header, title, financial summary grouping, single signature, professional notes, enterprise footer, rebalanced table, single dealer section | **✅ COMPLETE** |
| **PHASE_07A_ENTERPRISE_LEDGER_FOUNDATION** | Ledger schema hardening + strongly typed posting-key abstraction + immutable ledger service + reconciliation + opening-balance builders (foundation only — no UI, no reports, no wired posting) | **✅ COMPLETE** |
| **PHASE_07B_LEDGER_POSTING_INTEGRATION** | `createLedgerEntry` wired into `postReceivableIncrease` / `postReceivableDecrease` / `postReceivableDecreaseReversal`; `LedgerEntry.balance == Dealer.currentBalance` asserted every commit; append-only; compensating reversal; concurrency + idempotency tests | **✅ COMPLETE** |
| **PHASE_07B.5_ENTERPRISE_FINANCIAL_INTEGRITY_CERTIFICATION** | Chief ERP architecture audit of full financial path; repository grep; reconciliation tests; `assertDealerLedgerReconciled` tightened; ADR-027; Opening Balance approved | **✅ COMPLETE** |
| **PHASE_07C_ENTERPRISE_FINANCIAL_INITIALIZATION_ENGINE** | Financial Initialization Platform — Opening Balance workflow (state machine, `postOpeningBalance()`, enterprise wizard UI); reusable for future bulk import / ERP migration / company / branch / fiscal year initialization; ADR-028 | **✅ COMPLETE** |
| **PHASE_07D1_ENTERPRISE_DEALER_SUBLEDGER_FOUNDATION** | Read-only Dealer Statement engine — `getDealerStatement()` / `getDealerStatementSummary()`; `LedgerEntry`-authoritative running balance; server actions; `/ledger/demo` dev verification; ADR-029 | **✅ COMPLETE** |



---



# PHASE_06D.1_INVOICE_PDF_CLIENT_REVISION



Status: COMPLETE



## Objectives



Revise the enterprise invoice printable layout per latest client feedback.
Presentation-layer changes only — no accounting, posting, workflow, or schema changes.



* Enlarge company name hierarchy (Nazma + WATER TAPS subtitle)

* Dynamic product rows (no fixed 20-row padding)

* Remove discount column, VAT row, and Due Date from print

* Sales person = Sales Order creator (not dealer territory)

* Blank signature areas (Prepared By / Checked By / Authorized Signature)

* Maintain Preview = Print = PDF single pipeline



### Completion Criteria



* Company name enlarged; subtitle aligned: ✓

* Dynamic row generation; no placeholder rows: ✓

* Discount column removed from print: ✓

* VAT row removed from print: ✓

* Due Date removed from print: ✓

* Sales person shows SR (order creator) name: ✓

* Signature areas blank: ✓

* Preview == Print == PDF: ✓

* No business or financial logic changes: ✓

* ADR-017 / ADR-018 updated: ✓

* Governance docs updated: ✓



### Explicitly NOT Changed



* Prisma schema, PostingService, Invoice Engine, validators, workflow

* Financial calculations (subtotal, grandTotal, previousDue, currentDue, outstanding)

* Database fields and DTO monetary fields



---



---



# PHASE_06D.2_ENTERPRISE_DOCUMENT_PLATFORM_DESIGN_FREEZE

Status: COMPLETE

## Objectives

Production design freeze for the Enterprise Document Platform before the Ledger phase begins.
Presentation-layer changes only — no accounting, posting, workflow, or schema changes.

* Design tokens file — single source of truth for all document visual constants
* Enterprise CompanyHeader redesign — enlarged company name (32pt black), improved hierarchy, vertical rule separator, professional address block (T/E/W prefix style)
* Stronger DocumentTitle — 17pt font-black, 0.12em tracking, increased vertical spacing
* Simplified dealer section — single "Dealer Information" block (B2B ERP; no redundant Ship To column)
* Rebalanced product table — Product Name column expanded to 42% (was 34%); compact numeric columns
* Tabular numerals — font-variant-numeric: tabular-nums on qty/price/amount/financial columns
* Grouped financial summary — visual divider between Invoice Amount group and Due Summary group
* Single Authorized By signature — replaces three-signature block (Prepared By, Checked By, Authorized Signature)
* Professional notes — business-grade Terms & Conditions replacing consumer-oriented text
* Enterprise footer — blue bar + left "Confidential" label + right thank-you message
* PaymentTerms section removed — no orphan sections

### Completion Criteria

* Design tokens file created: ✓
* Enterprise header improved: ✓
* Document title strengthened: ✓
* Dealer section simplified (single B2B block): ✓
* Product table rebalanced (42% name column): ✓
* Tabular numerals on numeric columns: ✓
* Financial summary grouped (divider between Invoice Amount / Due Summary): ✓
* Payment terms removed from invoice print: ✓
* Professional notes (Terms & Conditions): ✓
* Single Authorized By signature: ✓
* Enterprise footer (blue bar + confidential + message): ✓
* DocumentLabels updated (authorizedBy, dealerInfo fields): ✓
* EN/BN localization updated: ✓
* Preview == Print == PDF: ✓
* No business or financial logic changes: ✓
* `npx tsc --noEmit` — 0 errors: ✓
* `npx eslint` — 0 errors: ✓
* Governance docs updated: ✓

### Explicitly NOT Changed

* Prisma schema, PostingService, Invoice Engine, validators, workflow
* Financial calculations (subtotal, grandTotal, previousDue, currentDue, outstanding)
* Database fields and DTO monetary fields
* Money Receipt pipeline (DocumentFinancialSummary changes are backward-compatible)

---



---

# PHASE_07A_ENTERPRISE_LEDGER_FOUNDATION

Status: COMPLETE (2026-07-09)

## Objectives

Deliver a permanent, extension-ready accounting foundation on top of the
certified PHASE_06D pipeline. Foundation only — no posting wiring, no UI,
no reports, no data migration.

* Harden `LedgerEntry` model per ADR-024 §11 (enums, `postingKey`,
  `postingType`, `postingDate`, `referenceNo`, `reversesEntryId`,
  `createdById`, composite indexes)
* Introduce strongly typed `PostingKey` abstraction with deterministic,
  idempotent builder
* Replace loose `String referenceType` with `FinancialReferenceType` enum;
  extend enum with `Collection`
* Introduce `LedgerPostingType` enum for accounting events
* Prepare `posting-service.ts` inputs for ledger hooks (types extended;
  bodies unchanged)
* Ship immutable ledger posting contracts (`LedgerPostingInput`,
  `LedgerEntryCreateData`, `buildReversalPosting`)
* Ship `createLedgerEntry` — the SINGLE ledger write path (idempotent,
  balance-asserting, append-only)
* Ship reconciliation helpers (`reconcileDealerLedger`,
  `replayDealerLedgerBalance`, `assertDealerLedgerReconciled`)
* Ship opening-balance infrastructure (`buildOpeningBalancePosting`,
  `buildOpeningBalancePostingKey`)
* Document architecture, posting strategy, append-only policy, and future
  extension points in ADR-025

## Completion Criteria

* `LedgerEntry` schema hardened + Prisma migration authored: ✓
* `LedgerPostingType` enum + `FinancialReferenceType.Collection` added: ✓
* `PostingKey` builder/parser/predicate: ✓
* `createLedgerEntry` with `postingKey` idempotency + balance derivation: ✓
* Compensating reversal contract (`buildReversalPosting`,
  `reversesEntryId`): ✓
* Reconciliation helpers (single-dealer scope): ✓
* Opening balance builders (sign-aware, deterministic key): ✓
* `posting-service.ts` inputs extended with optional ledger metadata: ✓
* ADR-025 authored: ✓
* Governance docs updated: ✓
* `npx tsc --noEmit` — 0 errors: ✓
* `npx eslint` — 0 errors: ✓
* `npx vitest run` — 64 passed, 4 skipped (pre-existing DB integration
  tests requiring `DATABASE_URL`): ✓

## Explicitly NOT Changed

* `posting-service.ts` function bodies — PHASE_07B wires
  `createLedgerEntry`
* Invoice Engine, Collection Engine, Delivery Engine, Order Engine
* Document platform, UI, RBAC, localization
* Financial calculations, dealer balance semantics
* Existing enum members and allocation runtime guards

---

## Next Phase

**PHASE_07B_LEDGER_POSTING_INTEGRATION** — Call `createLedgerEntry` inside
`postReceivableIncrease`, `postReceivableDecrease`, and
`postReceivableDecreaseReversal`; assert `LedgerEntry.balance =
Dealer.currentBalance` after each post. Integration tests mirror the
PHASE_05C2A invoice concurrency suite.

---

# PHASE_07B_LEDGER_POSTING_INTEGRATION

Status: COMPLETE (2026-07-09)

## Objectives

Wire the PHASE_07A ledger foundation into the Financial Posting Service so
that every receivable event permanently creates an immutable
`LedgerEntry`, without changing any caller, business workflow, UI, or
schema.

* `createLedgerEntry` invoked from `postReceivableIncrease`,
  `postReceivableDecrease`, and `postReceivableDecreaseReversal`
* `LedgerEntry.balance == Dealer.currentBalance` asserted on every
  commit via `assertLedgerBalanceMatchesCache`
* Compensating reversal — collection reverse links `reversesEntryId` to
  the canonical Collection posting when it exists
* Semantic correction — collection cash-receipt postings now use
  `FinancialReferenceType.Collection` (ADR-024 §10 low-priority item)
* PostingService remains the sole mutation boundary for balances AND
  the sole write path into `LedgerEntry`
* Ledger append-only preserved — `assertLedgerAppendOnly` + reviewer
  discipline; no `ledgerEntry.update` / `delete` in code
* Idempotency preserved — deterministic `postingKey @unique` collapses
  replays into no-ops
* Concurrency invariants preserved — dealer row lock, atomic increment,
  single-transaction commit
* Audit rows carry `ledgerEntryId`, `ledgerPostingKey`,
  `ledgerPostingType`, `ledgerIsNew`, `ledgerReversesEntryId`

## Completion Criteria

* Invoice creates LedgerEntry (postingType = Issue, Debit): ✓
* Collection confirm creates LedgerEntry (postingType = Collection, Credit): ✓
* Collection reverse creates compensating LedgerEntry (postingType = Reversal, Debit) with `reversesEntryId`: ✓
* `LedgerEntry.balance == Dealer.currentBalance` asserted on every post: ✓
* Duplicate posting prevented via `postingKey @unique`: ✓
* Allocation continues to skip balance + ledger: ✓
* Dealer row lock preserved: ✓
* Decimal (18, 2) preserved: ✓
* Transactions atomic: ✓
* Concurrency + idempotency tests extended: ✓
* `npx tsc --noEmit` — 0 errors: ✓
* `npx eslint` — 0 errors: ✓
* `npx vitest run` — 83 passed, 4 skipped (pre-existing DB integration tests): ✓
* ADR-026 authored: ✓
* Governance docs updated: ✓

## Explicitly NOT Changed

* Prisma schema, migrations
* Invoice Engine, Collection Engine, Delivery Engine, Order Engine
* Document platform, UI, RBAC, localization
* Public caller signatures of `postReceivable*` functions
* Financial calculations, dealer balance semantics
* Allocation engine's balance semantics (allocation still skips balance path)

---

## Next Phase

**PHASE_07C_OPENING_BALANCE** — `openDealerBalance()` server action and
`postOpeningBalance()` in `posting-service.ts` using the PHASE_07A
opening-balance builders. **Approved by ADR-027.** Then PHASE_07D (Ledger UI +
dealer statement), PHASE_07E (reconciliation + backfill).

---

# PHASE_07B.5_ENTERPRISE_FINANCIAL_INTEGRITY_CERTIFICATION

Status: COMPLETE (2026-07-09)

## Objectives

Chief ERP Architecture Audit before Opening Balance. Certify every financial
path from Invoice through PostingService, LedgerEntry, Dealer.currentBalance,
and Audit. No feature work.

* Full repository grep for balance/ledger bypass and float arithmetic
* Verify append-only ledger, PostingKey idempotency, running balance chain
* Verify transaction atomicity, allocation non-posting, reversal compensating model
* Stress/concurrency review (invoice integration tests + posting unit tests)
* Implement repository-wide reconciliation tests
* Remediate any architectural weakness found
* Document certification in ADR-027

## Completion Criteria

* PostingService sole writer for `Dealer.currentBalance` and `LedgerEntry`: ✓
* No ledger UPDATE/DELETE in application code: ✓
* PostingKey deterministic; replay safe; drift rejected: ✓
* Running balance = previous + debit − credit: ✓
* Cache/ledger parity on every commit: ✓
* Allocation skips balance and ledger: ✓
* Decimal(18,2) in financial paths: ✓
* `assertDealerLedgerReconciled` tightened (empty ledger only when cache = 0): ✓
* `validateDealerLedgerChain`, `assertDealerLedgerIntegrity`, `reconcileAllDealers`: ✓
* `ledger-reconciliation.test.ts` (9 unit tests): ✓
* `ledger-reconciliation.integration.test.ts` (DB scan): ✓
* ADR-027 authored: ✓
* Governance docs updated: ✓
* Opening Balance (PHASE_07C) approved: ✓

## Explicitly NOT Changed

* Prisma schema, migrations
* Invoice Engine, Collection Engine, posting-service public API
* UI, reports, opening balance implementation

---

## Next Phase (superseded header retained for history)

**PHASE_07C_OPENING_BALANCE** — see below.

---

# PHASE_07C_ENTERPRISE_FINANCIAL_INITIALIZATION_ENGINE

Status: COMPLETE (2026-07-09)

## Objectives

Build the Financial Initialization Platform, with Opening Balance as its
first workflow. Never bypass `PostingService`. Design for reuse by future
Bulk Opening Balance Import, ERP Migration, Company Initialization, Branch
Initialization, and Fiscal Year Initialization workflows.

* Permanent state machine: `NotInitialized → Draft → Validated →
  Posted+Locked`
* `OpeningBalance` model (`dealerCode @unique` — every dealer initialized
  exactly once); `OpeningBalanceStatus` / `OpeningBalanceSource` enums
* `postOpeningBalance()` in `posting-service.ts` — reuses `createLedgerEntry`,
  `assertLedgerBalanceMatchesCache`, dealer row lock, and audit logging;
  zero new mutation primitives
* Producer-agnostic core engine (`src/lib/finance/initialization/`) —
  `source: Manual | CsvImport | ExcelImport | ErpMigration` designed in from
  day one; `postOpeningBalanceBatch()` shipped for future bulk import
* Idempotency via `postingKey`; initialization lock via `dealerCode @unique`
  + `assertDealerNotInitialized`
* Five server actions: `createOpeningBalanceDraft`, `validateOpeningBalance`,
  `postOpeningBalance`, `getInitializationStatus`, `listUninitializedDealers`
* Enterprise wizard UI (`/opening-balances`, `/opening-balances/new`) — Dealer
  Selection → Entry → Validation → Confirmation → Posting → Success
* Live-database concurrency tests found and fixed a real race condition in
  `postOpeningBalanceRecord()` (see ADR-028 §6.2) before production

## Completion Criteria

* `OpeningBalance` model + enums + migration: ✓
* `postOpeningBalance()` posts exactly one `LedgerEntry` (or none for
  amount = 0): ✓
* `PostingService` remains sole mutation boundary: ✓
* `Dealer.currentBalance` matches Ledger on every commit: ✓
* Initialization occurs only once (app + DB level, proven under
  concurrency): ✓
* PostingKey prevents duplicates (proven under concurrency): ✓
* Draft / Validation never touch balance or ledger: ✓
* Audit created on every post, including zero-amount: ✓
* Enterprise wizard UI — 6-step accountant workflow: ✓
* RBAC reuses `invoices:create` (no `permissions.ts` change): ✓
* EN/BN localization: ✓
* `npx tsc --noEmit` — 0 errors: ✓
* `npx eslint .` — 0 errors: ✓
* `npx vitest run` — 141 passed / 5 skipped (pre-existing, unrelated): ✓
* `npx next build` — succeeds; `/opening-balances*` routes compile: ✓
* Live end-to-end smoke test against real PostgreSQL: ✓
* ADR-028 authored: ✓
* Governance docs updated: ✓

## Explicitly NOT Changed

* Invoice Engine, Collection Engine, Order Engine, Delivery Engine
* `posting-service.ts`'s three existing functions (byte-for-byte unchanged)
* `src/lib/ledger/` posting/validation functions
* Document Platform, RBAC matrix (`permissions.ts`), Reporting, Dashboard

---

# PHASE_07D1_ENTERPRISE_DEALER_SUBLEDGER_FOUNDATION

Status: COMPLETE (2026-07-09)

## Objectives

Build the read-only Dealer Subledger Foundation — a reusable statement engine
that every future UI, PDF, Excel, Email, and Reporting module consumes
without redesign. Never mutate financial data; never call posting functions.

* `src/lib/ledger/statement/` — `getDealerStatement()`, `getDealerStatementSummary()`
* Running balance copied verbatim from `LedgerEntry.balance` — never recomputed
* Opening Balance visible as first `LedgerEntry` when dealer is initialized
* Ledger integrity validated read-only via `validateDealerLedgerChain()`
* Server actions with `ledger:view` RBAC and transport-safe DTOs
* Lightweight dev verification page at `/ledger/demo`
* Unit tests for all required scenarios

## Completion Criteria

* Read-only architecture — no writes in statement module: ✓
* No balance mutation / no `LedgerEntry` creation: ✓
* Running balance from `LedgerEntry.balance`: ✓
* Opening Balance row visible when initialized: ✓
* Invoice + Collection row mapping from ledger: ✓
* Date filtering + pagination + totals: ✓
* Empty ledger / future dealer handled gracefully: ✓
* Server actions `getDealerStatement` + `getDealerStatementSummary`: ✓
* `/ledger/demo` dev verification page: ✓
* ADR-029 authored: ✓
* Governance docs updated: ✓
* `npx tsc --noEmit` — 0 errors: ✓
* `npx eslint .` — 0 errors: ✓
* `npx vitest run` — 158 passed / 7 skipped: ✓

## Explicitly NOT Changed

* Invoice Engine, Collection Engine, PostingService, Delivery, Order
* Document Platform (production statement composer deferred to PHASE_07D2)
* RBAC matrix (`permissions.ts`)
* Reconciliation jobs, PDF, Excel, exports, dashboards, reports

---

## Next Phase

**PHASE_07D2_PRODUCTION_LEDGER_UI** — Production Ledger list/detail routes,
dealer subledger statement UI, document platform statement composer.
Print/PDF via existing document pipeline. Consumes `getDealerStatement()` —
no duplicate query logic. **Approved by ADR-029.**
