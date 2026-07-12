## Project Name

Nazma Water Taps ERP

Brand:
Nazma Metal Industries

---

## Business Domain

Manufacturing and distribution of premium brass bathroom fittings.

Customers:

* Dealers
* Retail distributors
* Project contractors

---

## Core Modules

Priority Order:

1. Authentication
2. RBAC
3. Dealer Management
4. Product Management
5. Sales Orders
6. **Fulfillment Layer** (Delivery Challan)
7. Invoice Engine
8. Collections
9. Ledger
10. **Due Reports** ✅ (PHASE_08D)
11. Audit Logs ✅ (PHASE_09D)
12. Audit Export ✅ (PHASE_09E)
13. User Management Foundation ✅ (PHASE_10A)
14. User Management Certification ✅ (PHASE_10B)

---

## Territory RBAC (PHASE_08B)

Enterprise authorization layer on top of flat role permissions:

```
Bangladesh → Division → District → Territory → SR/Manager → Dealer
```

| Role | Territory scope |
|------|-----------------|
| Super_Admin | ALL |
| Accounts | ALL |
| Manager | Assigned territories |
| SR | Assigned territories |

All territory decisions flow through `src/lib/rbac/territory/` — never scattered role checks in pages.

Assignment admin: `/settings/territory-assignments`. See ADR-038.

### Dealer Ownership (PHASE_08C)

`DealerOwnershipHistory` tracks territory assignment over time. Transfers close the prior record (`effectiveTo`, `isActive=false`) and append a new row. Financial documents are never rewritten. Backfill migrates legacy `district`/`territory` text to structured FKs. See ADR-039.

---

## Commercial → Fulfillment → Financial Pipeline

The approved end-to-end workflow:

```
Sales Order
  → Delivery Challan   (NON-FINANCIAL — logistics)
  → Invoice            (FINANCIAL — receivables)
  → Collection
  → Ledger
  → Due Report
```

Key rules:

* One Sales Order may generate **multiple Delivery Challans** (partial delivery).
* One Delivery Challan generates **exactly one Invoice**.
* Invoice quantities come from Delivery Challan quantities, not directly from the order.
* **InvoiceItem is required** on every invoice — header-only invoices are forbidden.
* Delivery Challan must **never** affect dealer balance, ledger, due, or collections.
* Invoice **must** affect credit exposure, ledger, dealer balance, and due.

See ADR-011 for the full fulfillment architecture.

---

## Delivery Challan Module

The Delivery Challan is the logistics document that records physical shipment.

Ownership:

| Concern | Owner |
|---------|-------|
| Shipped quantities | Delivery Challan |
| Vehicle / driver / delivery mode | Delivery Challan |
| Revenue & receivables | Invoice (+ InvoiceItem) |
| Payment receipt | Collection |

Delivery Challan is **non-financial**. It exists to bridge the approved order
and the financial invoice without prematurely creating receivables.

---

## User Roles

Super_Admin

Manager

Accounts

SR

---

## Financial Philosophy

The ERP is accounting-sensitive.

Every **invoice** must eventually affect:

* Dealer Balance
* Due Amount
* Ledger Entries

Every **collection** must eventually affect:

* Dealer Balance
* Ledger Entries

**Delivery Challans are explicitly excluded** from all financial side effects.

No orphan financial records allowed.

---

## Localization

Supported languages:

* English
* Bengali

Switching language should not require page refresh.

---

## UI Philosophy

Enterprise SaaS

Characteristics:

* Clean spacing
* Premium typography
* High-density data tables
* Elegant dashboards
* Modern cards
* Smooth interactions

---

## Delivery Reporting — Future Roadmap

Post-invoice phases will add operational reporting on top of the challan layer:

* Delivery register (all challans, filterable by date / dealer / vehicle / status)
* Pending dispatch report (approved orders with undelivered quantities)
* Fulfillment rate dashboard (% delivered vs ordered)
* Challan PDF (printable dispatch document for driver / gate pass)

These depend on PHASE_05A–05D completion. See ADR-011 §Future Roadmap.

---

## Long-Term Goal

The codebase should be reusable as a multi-company ERP platform in future versions.

---

## Architecture Maturity (as of PHASE_07F — 2026-07-10)

**Overall ERP production readiness: 9.3 / 10** (ADR-037)

The commercial → fulfillment → financial → document pipeline is **production-certified** for controlled deployment:

```
Sales Order → Delivery Challan → Invoice → Collection → Allocation → Money Receipt → Dealer Statement (UI + Print)
```

**Certified subsystems:** Orders (9.0), Delivery (9.0), Invoice (9.0), Collections (9.2), Money Receipt (9.0), Document Engine (9.0), Financial Initialization (9.2), Dealer Statement UI (9.2), Dealer Statement Document (9.2).

**Not yet built:** Statement Excel/email export, credit notes, due reports, management dashboards, bulk opening balance import UI.

**Blocking defects:** None for Order → Invoice → Collection → Ledger posting → Opening Balance → Dealer Statement read + UI + printable document pipeline.

**Opening Balance:** SHIPPED (PHASE_07C) per ADR-028. **Dealer Subledger Foundation:** SHIPPED (PHASE_07D1) per ADR-029. **Dealer Statement UI:** SHIPPED (PHASE_07D2) per ADR-030. **Dealer Statement Document:** SHIPPED (PHASE_07D3) per ADR-031. **Ledger Backfill Discovery:** SHIPPED (PHASE_07E1) per ADR-032. **Historical Replay Engine:** SHIPPED (PHASE_07E2) per ADR-033. **Reconciliation Engine:** SHIPPED (PHASE_07E3) per ADR-034. **Integrity Monitor:** SHIPPED (PHASE_07E4) per ADR-035. **Integrity Console:** SHIPPED (PHASE_07E5) per ADR-036. **Financial System Certification:** SHIPPED (PHASE_07F) per ADR-037 — **PHASE_08 APPROVED**.

---

## PHASE_07F — Enterprise Financial System Certification

**Status:** COMPLETE (2026-07-10)

Full enterprise financial certification before PHASE_08. Proves accounting
correctness, ledger immutability, replay safety, statement trustworthiness,
concurrency patterns, and audit completeness — without new business features.

| Change | Detail |
|--------|--------|
| Certification service | `runFinancialCertification()` in `src/lib/finance/certification/` |
| Rules 1–10 | Cache parity, sum parity, chain, replay idempotency, opening balance, statement, document pipeline, audit, posting boundary, immutability |
| Report | `FinancialCertificationReport` — scores, risks, manual checks |
| Tests | 12 unit tests |
| ADR | `docs/ADR/ADR-037-enterprise-financial-system-certification.md` |
| Verdict | **PHASE_08 (Due Reports) APPROVED** |

---

---

---

---

## PHASE_07E5 — Financial Integrity Operations Console

**Status:** COMPLETE (2026-07-10)

Production operations console at `/ledger/integrity`. Answers "Is the
accounting system healthy?" Presentation only.

| Change | Detail |
|--------|--------|
| Console UI | `src/components/ledger/integrity/` |
| Route | `/ledger/integrity` — replaces dev tooling |
| Data sources | `FinancialIntegrityScan` + `getReconciliationSummary()` |
| Manual scan | `runFinancialIntegrityScan()` action |
| Status | GREEN when no drift/missing/corruption; else YELLOW |
| Tests | 11 presentation tests |
| ADR | `docs/ADR/ADR-036-financial-integrity-operations-console.md` |

---

## PHASE_07E4 — Scheduled Financial Integrity Monitor

**Status:** COMPLETE (2026-07-10)

Automated integrity scan orchestration. Calls `reconcileAllDealers()` and
persists repository-wide summary counts to `FinancialIntegrityScan`. No cron,
dashboards, or notifications in this phase.

| Change | Detail |
|--------|--------|
| Monitor service | `runFinancialIntegrityScan()` in `src/lib/ledger/monitor/` |
| Persistence | `FinancialIntegrityScan` — summary counts + timing only |
| Server actions | `runFinancialIntegrityScan`, `getLatestIntegrityScan`, `listIntegrityScans` |
| Dev UI | `/ledger/integrity` — latest scan, history, manual run |
| RBAC | `invoices:create` (financial administration) |
| Tests | 11 unit tests |
| ADR | `docs/ADR/ADR-035-scheduled-financial-integrity-monitor.md` |

---

## PHASE_07E3 — Enterprise Reconciliation Engine

**Status:** COMPLETE (2026-07-10)

Read-only integrity verification for every dealer subledger. Detects drift,
missing ledger history, and corrupted chains. Never mutates financial data.

| Change | Detail |
|--------|--------|
| Reconciliation engine | `reconcileDealer()` / `reconcileAllDealers()` in `src/lib/ledger/reconciliation/` |
| Rules | Cache parity, sum parity, chain integrity |
| Status | `CONSISTENT`, `DRIFT`, `MISSING_LEDGER`, `CORRUPTED_CHAIN` |
| Server actions | `reconcileDealer`, `reconcileAllDealers`, `getReconciliationSummary` |
| Dev UI | `/ledger/reconciliation` — summary cards + dealer table |
| Tests | 10 unit tests |
| ADR | `docs/ADR/ADR-034-enterprise-reconciliation-engine.md` |

---

## PHASE_07E2 — Historical Ledger Replay Engine

**Status:** COMPLETE (2026-07-10)

Idempotent reconstruction of missing `LedgerEntry` rows for dealers flagged
by PHASE_07E1 discovery. Never mutates `Dealer.currentBalance`.

| Change | Detail |
|--------|--------|
| Replay engine | `replayDealerLedger()` in `src/lib/ledger/backfill/` |
| Write path | `createLedgerEntry()` + `buildLedgerPostingKey()` only |
| Order | Opening Balance → Invoices → Collections → Reversals |
| Parity | `LedgerEntry.balance == Dealer.currentBalance`; rollback on mismatch |
| Server actions | `executeLedgerBackfill`, `previewLedgerReplay`, `getReplayStatus` |
| Dev UI | `/ledger/backfill` — Replay / Preview / Status per dealer |
| Tests | 15 unit tests |
| ADR | `docs/ADR/ADR-033-enterprise-historical-ledger-replay-engine.md` |
| Verdict | **PHASE_07E3 (Scheduled Reconciliation Job) NEXT** |

---

## PHASE_07E1 — Historical Ledger Discovery Engine

**Status:** COMPLETE (2026-07-10)

Read-only discovery module. Answers which dealers require historical ledger
reconstruction. No repair, no replay, no mutation.

| Change | Detail |
|--------|--------|
| Discovery engine | `getLedgerBackfillCandidates()` in `src/lib/ledger/backfill/` |
| Rules | `NO_LEDGER`, `PARTIAL_LEDGER`, `CACHE_DRIFT`, `RECONCILED` |
| Dev page | `/ledger/backfill` — simple verification table |
| Tests | 8 unit tests |
| ADR | `docs/ADR/ADR-032-enterprise-ledger-backfill-discovery.md` |
| Verdict | **PHASE_07E2 (Historical Replay Engine) NEXT** |

---

## PHASE_07D3 — Enterprise Dealer Statement Document Platform

**Status:** COMPLETE (2026-07-10)

Printable Dealer Statements via the Document Platform. Document composition
only — consumes `DealerStatementDTO` exactly as shipped in PHASE_07D1.
Never recalculates running balances or monetary totals.

| Change | Detail |
|--------|--------|
| Composer | `DealerStatementPrintable` — DocumentLayout + platform primitives |
| Mapper | `mapDealerStatementToDocument()` — formatting only |
| Print flow | `/ledger` Print Statement → fetch full DTO → preview → `window.print()` |
| Table | Date, Posting Type, Reference No, Description, Debit, Credit, Running Balance |
| Summary | Opening, debit, credit, closing, transaction count from DTO |
| Accents | Opening (blue), Collection (green), Reversal (amber) — presentation only |
| Tests | 7 document presentation tests |
| ADR | `docs/ADR/ADR-031-enterprise-dealer-statement-document-platform.md` |
| Verdict | **PHASE_07E (Reconciliation & Backfill) NEXT**; Excel/email deferred |

---

## PHASE_07D2 — Enterprise Dealer Statement UI

**Status:** COMPLETE (2026-07-09)

Production Dealer Statement screen at `/ledger`. Presentation only —
consumes `getDealerStatement()` exactly as shipped in PHASE_07D1. Never
recalculates running balances or monetary totals in React.

| Change | Detail |
|--------|--------|
| Route | `/ledger` — `ledger:view` RBAC; dense enterprise ERP layout |
| Components | `src/components/ledger/` — header, filters, cards, table, badges, skeleton, empty, alert |
| Data path | `getDealerStatement()` server action only |
| Integrity | Green / amber badge from `meta.ledgerIntegrity.isConsistent` |
| Future filters | Posting type / reference type / search UI present; payload omits until backend support |
| Removed | `/ledger/demo` obsolete verification page |
| Tests | 13 presentation helper tests |
| ADR | `docs/ADR/ADR-030-enterprise-dealer-statement-ui.md` |
| Verdict | **PHASE_07E (Reconciliation & Backfill) NEXT**; PDF/Excel composer deferred |

---

## PHASE_07D1 — Enterprise Dealer Subledger Foundation

**Status:** COMPLETE (2026-07-09)

Read-only Dealer Statement engine — the single source every future statement
consumer (UI, PDF, Excel, Email, Reports) must call. Never mutates financial
data; never calls posting functions.

| Change | Detail |
|--------|--------|
| Read engine | `src/lib/ledger/statement/` — `getDealerStatement()`, `getDealerStatementSummary()` |
| Data source | `LedgerEntry` authoritative; `Dealer` + `OpeningBalance` metadata only |
| Running balance | Copied verbatim from `LedgerEntry.balance` — never recomputed |
| Integrity | `validateDealerLedgerChain()` exposed in `meta.ledgerIntegrity` |
| Server actions | `getDealerStatement`, `getDealerStatementSummary` — `ledger:view` RBAC |
| Dev UI | `/ledger/demo` — lightweight verification page (not production UI) |
| Tests | 19 new unit tests (statement service + validation) |
| ADR | `docs/ADR/ADR-029-enterprise-dealer-subledger-foundation.md` |
| Verdict | **PHASE_07D2 (Production Ledger UI) APPROVED** |

---

## PHASE_07C — Enterprise Financial Initialization Engine

**Status:** COMPLETE (2026-07-09)

Financial Initialization Platform — Opening Balance is its first workflow,
designed for reuse by future Bulk Opening Balance Import, ERP Migration,
Company Initialization, Branch Initialization, and Fiscal Year
Initialization. `PostingService` is never bypassed.

| Change | Detail |
|--------|--------|
| State machine | `NotInitialized → Draft → Validated → Posted+Locked`; `OpeningBalance` model, `dealerCode @unique` (every dealer initialized exactly once) |
| `postOpeningBalance()` | New function in `posting-service.ts` — reuses `createLedgerEntry`, dealer row lock, cache/ledger parity, audit; zero new mutation primitives |
| Producer-agnostic core | `src/lib/finance/initialization/` — `source: Manual \| CsvImport \| ExcelImport \| ErpMigration`; `postOpeningBalanceBatch()` shipped for future bulk import |
| Server actions | `createOpeningBalanceDraft`, `validateOpeningBalance`, `postOpeningBalance`, `getInitializationStatus`, `listUninitializedDealers` |
| Enterprise wizard | `/opening-balances` → `/opening-balances/new` — Dealer Selection → Entry → Validation → Confirmation → Posting → Success |
| RBAC | Reuses `invoices:create` (Super_Admin, Accounts) — `permissions.ts` unmodified |
| Concurrency defect found + fixed | Losing concurrent poster now re-checks `Locked` status AFTER acquiring the dealer lock (same idiom as `issue-invoice-transaction.ts`) — closes a real race proven live before the fix and proven fixed after |
| Tests | 44 new unit tests + 2 live-database concurrency integration tests (actually execute — see TECH_DEBT C8) |
| ADR | `docs/ADR/ADR-028-enterprise-financial-initialization-engine.md` |
| Verdict | **PHASE_07D (Dealer Subledger & Statement Engine) APPROVED** |

---

## PHASE_07B.5 — Enterprise Financial Integrity Certification

**Status:** COMPLETE (2026-07-09)

Chief ERP architecture audit before Opening Balance. Full financial path
certified; one defect remediated; repository-wide reconciliation tests shipped.

| Change | Detail |
|--------|--------|
| Repository grep | No `Dealer.currentBalance` bypass; no ledger UPDATE/DELETE in app code |
| Reconciliation helpers | `validateDealerLedgerChain`, `assertDealerLedgerIntegrity`, `reconcileAllDealers` |
| Defect fix | `assertDealerLedgerReconciled` — empty ledger only when cache = 0 |
| Tests | 9 unit + 1 integration reconciliation tests |
| Scores | Financial 9.3/10; Production 9.1/10 |
| ADR | `docs/ADR/ADR-027-enterprise-financial-integrity-certification.md` |
| Verdict | **Opening Balance (PHASE_07C) APPROVED** |

---

## Document Platform Architecture (PHASE_05D2, PHASE_06C)

ADR-017 established the invoice document engine. PHASE_06C upgraded it into a **reusable ERP Document Platform**.

### Canonical primitives (`src/components/documents/`)

| Primitive | Role |
|-----------|------|
| `DocumentLayout` | A4 shell + `extensionSlot` |
| `CompanyHeader` / `CompanyFooter` | Branding via `getCompanyBranding()` |
| `DocumentTitle` | Centered document heading |
| `DocumentParties` | Bill To / Received From |
| `DocumentMetadata` | Reference + labeled fields |
| `DocumentTable` | Generic print-safe grid |
| `DocumentFinancialSummary` | Server-sourced monetary lines |
| `DocumentNotes` | Remarks / terms |
| `DocumentSignature` / `DocumentSeal` | Authorization areas |
| `DocumentPrintToolbar` | Preview/print actions |

### Document composers

| Document | Component | Route |
|----------|-----------|-------|
| Invoice | `InvoicePrintable` | `/invoices/[id]/print` |
| Money Receipt | `MoneyReceiptPrintable` | `/collections/[id]/receipt` |
| Dealer Statement | `DealerStatementPrintable` | `/ledger` (print preview modal) |

**Hard rules:** No client money math. Preview = Print = PDF. Vector HTML/CSS only (no html2canvas). Enterprise blue `#1a5dad`. Max 20 invoice rows per A4 page.

See ADR-017, ADR-023.

---

## Money Receipt Engine (PHASE_06C)

Accountant-grade money receipt for every **confirmed** collection (not Draft or Reversed).

| Layer | Artifact |
|-------|----------|
| Loader | `loadMoneyReceiptDocument()` |
| Mapper | `mapCollectionToReceiptDocument()` |
| Printable | `MoneyReceiptPrintable` |
| Guard | `canPrintMoneyReceipt()` |

Receipt number = `collectionNo`. Shows received, allocated, advance (unallocated), allocation table, payment method.

See ADR-023.

---

## Financial Posting Service (PHASE_05C1, PHASE_05C2A, PHASE_06A2)

**Location:** `src/lib/finance/posting-service.ts`

**Mandate:** ALL balance mutations route through this module. Direct `Dealer.currentBalance` updates from feature code are forbidden. As of PHASE_07B, `posting-service.ts` is ALSO the sole write path into `LedgerEntry` — every receivable event produces exactly one immutable `LedgerEntry`.

| Function | Event | Side effects |
|----------|-------|--------------|
| `postReceivableIncrease()` | Invoice issue | Dealer balance ↑ + LedgerEntry (Issue, Debit) + parity assertion + audit |
| `postReceivableDecrease()` | Collection confirm | Dealer balance ↓ + LedgerEntry (Collection, Credit) + parity assertion + audit |
| `postReceivableDecreaseReversal()` | Collection reverse | Dealer balance ↑ + LedgerEntry (Reversal, Debit, `reversesEntryId`) + parity assertion + audit |
| `postOpeningBalance()` (PHASE_07C) | Opening balance posting | Dealer balance ± amount + LedgerEntry (OpeningBalance, Debit/Credit by sign) + parity assertion + audit; no LedgerEntry when amount = 0 |

**Concurrency:** `lockDealerForFinancialUpdate()` — `SELECT … FOR UPDATE` before every financial mutation.

**Idempotency:** `postingKey @unique` collapses P2002 replays into a no-op when the payload matches; raises `LedgerDuplicatePostingError` on drift.

**Future:** `postCreditNote()`, `postInvoiceReversal()`, `postJournalEntry()`, `postManualAdjustment()` — all plug into `createLedgerEntry` without redesign.

See ADR-014, ADR-015, ADR-024.

---

## Collection Allocation Abstraction (PHASE_06A1, PHASE_06A2)

Collections record **cash received**; allocation is a separate concern.

### Cash pool model

```
receivedAmount = allocatedAmount + unallocatedAmount
```

- Cash posted **once** on collection confirmation (`postReceivableDecrease()`).
- Allocation moves pool to invoices — **no second balance post**.

### Generic `FinancialReferenceType`

| Type | Handler status |
|------|----------------|
| `Invoice` | ✅ Implemented |
| `OpeningBalance` | ✅ Implemented (PHASE_07C) — via `postOpeningBalance()`, not allocation |
| `CreditNote` | Reserved |
| `DebitNote` | Reserved |
| `ManualAdjustment` | Reserved |
| `JournalEntry` | Reserved |

Polymorphic `CollectionAllocation(referenceType, referenceId)`. Certified extensible without redesign (ADR-024).

See ADR-019, ADR-020, ADR-021.

---

## Advance Payment Model (PHASE_06A2, PHASE_06B)

| Concern | Behavior |
|---------|----------|
| Overpayment | Allowed — full cash posted on confirm |
| Negative AR | `Dealer.currentBalance` may go negative (company owes dealer) |
| Pool | Unallocated amount remains in collection until allocated |
| UI | Blue "Advance Credit" badge — not error styling |
| Money receipt | Advance-retained message when no allocations |

Negative balance = advance credit, not data error. Certified for ledger and statement compatibility (ADR-024).

---

## Source-of-Truth Hierarchy (ADR-024)

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

`Dealer.currentBalance` is a **denormalized AR cache** — fast lookup and credit limit — reconcilable to ledger. Not primary accounting truth.

---

## Future Ledger Architecture (PHASE_07 — designed, not implemented)

### PHASE_07 breakdown (ADR-024)

| Phase | Scope |
|-------|-------|
| 07A | Ledger schema hardening (`postingKey`, enum alignment) |
| 07B | Ledger posting in `posting-service.ts` |
| 07C | Opening balance — ✅ COMPLETE (ADR-028) |
| 07D | Ledger UI + dealer subledger statement |
| 07E | Reconciliation & backfill |
| 07F | Chart of Accounts foundation (optional) |

### Dealer statement (hybrid)

- **Running balance:** `LedgerEntry` (authoritative once posted)
- **Line detail:** Documents (Invoice, Collection, future notes)
- **Pre-ledger fallback:** Document replay formula cross-checked against `currentBalance`

### Ledger principles

- Append-only entries; compensating reversals via `reversesEntryId`
- Posted only from `posting-service.ts`
- Dealer AR subledger first; full multi-account GL later
- `LedgerEntry.balance` must equal `Dealer.currentBalance` after each post

**No refactor required** of Invoice Engine, Collection Engine, or posting service boundaries — extend only.

---

## Current Implementation Status Summary

| Module | Status |
|--------|--------|
| Auth + RBAC | ✅ Complete |
| Dealers | ✅ Complete |
| Products | ✅ Complete |
| Sales Orders | ✅ Complete |
| Delivery Challans | ✅ Complete |
| Invoice Engine + UI + PDF | ✅ Complete |
| Collections Engine + UI | ✅ Complete |
| Money Receipt | ✅ Complete |
| Document Platform | ✅ Complete |
| Financial Architecture Certification | ✅ Complete (PHASE_06D) |
| Ledger Foundation | ✅ Complete (PHASE_07A) |
| Ledger Posting Integration | ✅ Complete (PHASE_07B) — wired in `posting-service.ts`; parity asserted every commit |
| Financial Integrity Certification | ✅ Complete (PHASE_07B.5) — ADR-027; Opening Balance approved |
| Financial Initialization Engine (Opening Balance) | ✅ Complete (PHASE_07C) — ADR-028; enterprise wizard UI; PHASE_07D1 approved |
| Dealer Subledger Foundation (Statement Read Engine) | ✅ Complete (PHASE_07D1) — ADR-029; read-only `getDealerStatement()` |
| Dealer Statement UI | ✅ Complete (PHASE_07D2) — ADR-030; production `/ledger` |
| Dealer Statement Document | ✅ Complete (PHASE_07D3) — ADR-031; printable via Document Platform |
| Ledger Backfill Discovery | ✅ Complete (PHASE_07E1) — ADR-032; read-only `getLedgerBackfillCandidates()` |
| Ledger Historical Replay | ✅ Complete (PHASE_07E2) — ADR-033; `replayDealerLedger()` |
| Ledger Reconciliation Engine | ✅ Complete (PHASE_07E3) — ADR-034; read-only `reconcileDealer()` |
| Due Reports | ✅ Complete (PHASE_08D) — ADR-040 |
| Enterprise Dashboard Foundation | ✅ Complete (PHASE_09A) — ADR-042; role-aware `/dashboard` |
| Enterprise Dashboard Certification | ✅ Complete (PHASE_09A.5) — ADR-043; PHASE_09B approved |
| Enterprise Dashboard BI & Analytics | ✅ Complete (PHASE_09B) — ADR-044; SVG charts on `/dashboard` |
| Enterprise Territory Map & Geo Visualization | ✅ Complete (PHASE_09C) — ADR-045; grid map on `/dashboard` |
| Audit Log & Compliance Console | ✅ Complete (PHASE_09D) — ADR-046; read-only `/audit` |
| Audit & Compliance Certification | ✅ Complete (PHASE_09D.5) — ADR-047; `runAuditCertification()` |
| Audit Export & Compliance Archive | ✅ Complete (PHASE_09E) — ADR-048; PDF/Excel/ZIP |
| User Management Foundation | ✅ Complete (PHASE_10A) — ADR-049; `/settings/users` |
| User Management Certification | ✅ Complete (PHASE_10B) — ADR-050; `runUserCertification()` |

---

## Governance Repository (PHASE_06D metadata dump)

Permanent institutional knowledge files (2026-07-01):

| File | Purpose |
|------|---------|
| `SYSTEM_CONTEXT.md` | Session bootstrap — full ERP context |
| `CLIENT_FEEDBACK_LOG.md` | Client request history |
| `FINANCIAL_INVARIANTS.md` | Mandatory accounting rules |
| `TECH_DEBT.md` | Deferred improvements |
| `KNOWN_RISKS.md` | Risk register |
| `ARCHITECTURE_DECISIONS_REJECTED.md` | Rejected designs + rationale |

---

## Next Priorities (post PHASE_07E1)

1. **Statement Excel / Email Export** — same `DealerStatementDTO`, toolbar actions only
2. **PHASE_08** — Due reports and aging
3. **Bulk Opening Balance Import** — file parser + import UI on top of the shipped `postOpeningBalanceBatch()` engine
4. **Reporting** — due reports, cash book, territory analytics
5. **Analytics** — management dashboards
6. **Final Production Hardening** — collection concurrency tests, DB-level ledger immutability (optional), deployment checklist

See `NEXT_ACTION.md` for immediate implementation goals.

---

## PHASE_06D.1 — Invoice PDF Client Revision (Revision 2)

**Status:** COMPLETE (2026-07-09)

Client-approved presentation-only invoice layout revision. No financial, posting, or workflow changes.

| Change | Detail |
|--------|--------|
| Company header | Enlarged `shortDisplayName` (Nazma); tagline (WATER TAPS) as subtitle |
| Product table | Dynamic rows only — no 20-row padding; table grows naturally |
| Removed from print | Discount column, VAT row, Due Date (DTO/calculations unchanged) |
| Sales person | Sales Order `createdBy.name` — not dealer territory |
| Signatures | Blank Prepared By / Checked By / Authorized Signature lines |
| Pipeline | Preview = Print = PDF via single `InvoicePrintable` |

Supersedes fixed 20-row invoice requirement (ADR-017, ADR-018). See ADR-017 amendment and ADR-018 revision.

---

## PHASE_07A — Enterprise Ledger Foundation

**Status:** COMPLETE (2026-07-09)

Ledger accounting foundation on top of the PHASE_06D-certified financial
architecture. Foundation only — no UI, no reports, no posting wiring, no data
migration.

| Change | Detail |
|--------|--------|
| `LedgerEntry` model hardened | `referenceType` → `FinancialReferenceType` enum; `postingType`, `postingDate`, `postingKey @unique`, `referenceNo`, `reversesEntryId`, `createdById` added; composite indexes on `(dealerCode, transactionDate)` and `(dealerCode, postingDate)` |
| `LedgerPostingType` enum | `Issue`, `Collection`, `Reversal`, `OpeningBalance`, `CreditNote`, `DebitNote`, `ManualAdjustment`, `JournalEntry`, `Adjustment` |
| `FinancialReferenceType` | Extended with `Collection`; allocation runtime guards unchanged |
| `src/lib/ledger/` | 9 files — posting-key, types, errors, validation, posting contracts, service, reconciliation, opening-balance, index |
| PostingKey abstraction | `ledger:<referenceType>:<referenceId>:<postingType>[:<sequence>]` — deterministic, idempotent |
| `createLedgerEntry` | Single ledger write path — validates input, builds row, inserts, handles `P2002` idempotently |
| Reconciliation helpers | `reconcileDealerLedger`, `replayDealerLedgerBalance`, `assertDealerLedgerReconciled` |
| Opening balance builders | `buildOpeningBalancePosting`, `buildOpeningBalancePostingKey` (PHASE_07C-ready) |
| PostingService extension | Optional `postingType`, `transactionDate`, `postingKey`, `reversesEntryId` on `ReceivablePostingInput`/`ReceivableDecreasePostingInput`; bodies unchanged (PHASE_07B consumes) |
| Tests | 35 new unit tests (posting-key, validation, posting/reversal, opening balance) |
| Prisma migration | `20260709000000_phase_07a_ledger_foundation/migration.sql` |
| ADR | `docs/ADR/ADR-025-enterprise-ledger-foundation.md` |

**Design freeze:** every future financial module (opening balance, credit
notes, debit notes, journal entries, dealer statements, trial balance, chart
of accounts) plugs into `createLedgerEntry` via `posting-service.ts` without
redesigning existing boundaries.

---

## PHASE_07B — Enterprise Ledger Posting Engine

**Status:** COMPLETE (2026-07-09)

The ledger foundation is now wired. `posting-service.ts` is the sole write
path into `LedgerEntry`. Every receivable event produces exactly one
immutable journal row; `LedgerEntry.balance` is asserted equal to
`Dealer.currentBalance` on every commit. No business workflow, UI, or
schema change.

| Change | Detail |
|--------|--------|
| `postReceivableIncrease` | Inserts `LedgerEntry(postingType=Issue, Debit=amount)` under caller's transaction; parity asserted |
| `postReceivableDecrease` | Inserts `LedgerEntry(postingType=Collection, Credit=amount)` when `applyDealerBalance = true`; parity asserted; short-circuits (no balance / no ledger) for allocation |
| `postReceivableDecreaseReversal` | Inserts `LedgerEntry(postingType=Reversal, Debit=amount, reversesEntryId=<original>)`; parity asserted |
| Allocation | Unchanged — still skips balance path and ledger path (cash already posted on confirm) |
| Reference correction | `postReceivableDecrease`/`Reversal` now pass `FINANCIAL_REFERENCE_COLLECTION` (ADR-024 §10) |
| Audit payload | Cross-references `ledgerEntryId`, `ledgerPostingKey`, `ledgerPostingType`, `ledgerIsNew`, `ledgerReversesEntryId` |
| Idempotency | `postingKey @unique` — retries collapse to a no-op ledger insert when the payload matches |
| Concurrency | Existing dealer row lock + atomic ± + `postingKey` unique constraint |
| Tests | 12 new posting-service unit tests + 7 new ledger-service unit tests + concurrency suite extended with ledger assertions |
| ADR | `docs/ADR/ADR-026-enterprise-ledger-posting-engine.md` |

**Accounting integrity milestone:** the ERP now has a permanent,
append-only accounting subledger backing every dealer receivable
mutation. Suitable for statutory-grade audit trails and enterprise
reconciliation once PHASE_07E backfill lands.

---

## PHASE_06D.2 — Enterprise Document Platform Design Freeze

**Status:** COMPLETE (2026-07-09)

Production design freeze. All future printable documents inherit this enterprise visual language. No financial, posting, or workflow changes.

| Change | Detail |
|--------|--------|
| Design tokens | `src/lib/documents/design-tokens.ts` — `DOC_COLORS`, `DOC_TYPOGRAPHY`, `DOC_SPACING`, `DOC_PRODUCT_TABLE_COLS`, `DOC_DATA_TABLE_COLS` |
| CompanyHeader | 32pt `font-black` company name; vertical rule separator; T/E/W professional address prefixes |
| DocumentTitle | 17pt `font-black`, 0.12em letter-spacing; stronger visual separation |
| InvoiceMetadata | Single "Dealer Information" section — no redundant Ship To (B2B only) |
| Product table CSS | `col-name` → 42%; tabular-nums on all numeric columns |
| Financial summary | `divider` flag on `DocumentFinancialLine`; groups Invoice Amount vs Due Summary |
| Signature | Single "Authorized By" blank line — replaces three-signature block |
| Notes | "Terms & Conditions" with professional business language |
| Footer | Blue top bar + "Confidential" left + thank-you right |
| PaymentTerms | Removed from invoice print (no due date = no payment terms) |
| DocumentLabels | `authorizedBy` and `dealerInfo` fields added; old fields deprecated |
| Pipeline | Preview = Print = PDF via single `InvoicePrintable` |

**Design freeze status:** Every future printable document (Delivery Challan, Ledger Statement, Dealer Statement, Credit Note, Return Slip) must inherit the document platform tokens and primitives with near-zero additional styling.
