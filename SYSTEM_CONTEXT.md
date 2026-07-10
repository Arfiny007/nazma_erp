# System Context — Nazma Water Taps ERP

Definitive engineering context for AI sessions and new maintainers.

Read this document first. Then consult `PROJECT_BRAIN.md`, `CURRENT_PHASE.md`, and relevant ADRs.

**Last updated:** 2026-07-10 (PHASE_07E5 — Financial Integrity Operations Console)  
**Current phase:** PHASE_07E5 complete → Next: Cron / notifications / repair follow-ons  
**Production readiness:** 9.1 / 10 (ADR-027 … ADR-035, ADR-036)

---

## 1. Project Overview

Nazma Water Taps ERP is a production-grade B2B ERP for **Nazma Metal Industries** — manufacturer and distributor of premium brass bathroom fittings.

| Attribute | Value |
|-----------|-------|
| Domain | Dealer management, sales orders, fulfillment, invoicing, collections, ledger (planned) |
| Customers | Dealers, retail distributors, project contractors |
| Languages | English + Bengali (no page refresh on switch) |
| Deployment | Docker-first; Netlify-compatible Next.js |
| Long-term goal | Reusable multi-company ERP platform |

---

## 2. Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js App Router, React 19, TypeScript strict |
| Styling | Tailwind CSS, Shadcn UI |
| Forms | React Hook Form + Zod |
| Tables | TanStack Table |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Auth | Auth.js v5, JWT sessions, bcrypt |
| Money | Prisma `Decimal(18,2)` — never JS `number` |
| Testing | Vitest |
| i18n | `public/locales/{en,bn}/common.json` |

---

## 3. User Roles

| Role | Typical responsibilities |
|------|--------------------------|
| Super_Admin | Full system access |
| Manager | Order approval, edits, oversight |
| Accounts | Invoices, collections, financial documents |
| SR | Sales orders, dealer interaction (no invoice issue) |

**RBAC:** centralized `src/lib/permissions.ts`; `requirePermission()` on actions; `enforcePermission()` on pages; middleware route guards.

---

## 4. Business Workflow

### Commercial → Fulfillment → Financial Pipeline

```
Sales Order (commercial)
    ↓
Delivery Challan (logistics — NON-FINANCIAL)
    ↓
Invoice (financial — receivables created)
    ↓
Collection (cash receipt)
    ↓
Allocation (apply cash to invoices)
    ↓
Money Receipt (printable proof)
    ↓
Ledger (PHASE_07 — not yet implemented)
    ↓
Due Report (PHASE_08 — not yet implemented)
```

### Cardinality Rules

| Relationship | Rule |
|--------------|------|
| Order → Challan | One-to-many (partial delivery) |
| Challan → Invoice | One-to-one |
| Order → Invoice | One-to-many (via challans) |
| Collection → Allocation | One-to-many (polymorphic references) |

See ADR-011 for fulfillment architecture.

---

## 5. Financial Workflow

### When Money Moves

| Event | Balance effect | Posting function |
|-------|----------------|------------------|
| Invoice issue | + `grandTotal` | `postReceivableIncrease()` |
| Collection confirm | − `receivedAmount` | `postReceivableDecrease()` |
| Collection reverse | + `receivedAmount` | `postReceivableDecreaseReversal()` |
| Allocation | None on balance | Pool + invoice fields only |

### Advance Payment

- Dealer pays more than immediate invoice allocation → `Dealer.currentBalance` goes **negative** (company owes dealer).
- Unallocated cash remains in collection pool.
- Future invoices consume credit without new cash collection.

### Credit Limit

- Checked **only** at invoice issue.
- `projectedExposure = currentBalance + grandTotal` under dealer row lock.

---

## 6. Module Map

| Module | Status | Key routes |
|--------|--------|------------|
| Auth + RBAC | ✅ Complete | `/login`, `/access-denied` |
| Dealers | ✅ Complete | `/dealers` |
| Products | ✅ Complete | `/products` |
| Sales Orders | ✅ Complete | `/orders` |
| Delivery Challans | ✅ Complete | `/delivery-challans` |
| Invoices | ✅ Complete | `/invoices`, `/invoices/issue`, `/invoices/[id]/print` |
| Collections | ✅ Complete | `/collections`, `/collections/[id]/allocate` |
| Money Receipt | ✅ Complete | `/collections/[id]/receipt` |
| Ledger Foundation | ✅ Complete (PHASE_07A) | `src/lib/ledger/*` |
| Ledger Posting Integration | ✅ Complete (PHASE_07B) — wired into `posting-service.ts`; no UI/reports yet | `src/lib/finance/posting-service.ts` |
| Financial Integrity Certification | ✅ Complete (PHASE_07B.5) — repository audit; reconciliation tests; ADR-027 | `src/lib/ledger/ledger-reconciliation.ts` |
| Financial Initialization Engine (Opening Balance) | ✅ Complete (PHASE_07C) — state machine, `postOpeningBalance()`, enterprise wizard; ADR-028 | `src/lib/finance/initialization/`, `/opening-balances` |
| Dealer Subledger Foundation (Statement Read Engine) | ✅ Complete (PHASE_07D1) — read-only `getDealerStatement()`; ADR-029 | `src/lib/ledger/statement/` |
| Dealer Statement UI | ✅ Complete (PHASE_07D2) — production `/ledger`; ADR-030 | `src/components/ledger/`, `/ledger` |
| Dealer Statement Document | ✅ Complete (PHASE_07D3) — printable via Document Platform; ADR-031 | `src/components/documents/statement/` |
| Ledger Backfill Discovery | ✅ Complete (PHASE_07E1) — read-only `getLedgerBackfillCandidates()`; ADR-032 | `src/lib/ledger/backfill/`, `/ledger/backfill` |
| Ledger Historical Replay | ✅ Complete (PHASE_07E2) — `replayDealerLedger()` via `createLedgerEntry`; ADR-033 | `src/lib/ledger/backfill/`, `/ledger/backfill` |
| Ledger Reconciliation Engine | ✅ Complete (PHASE_07E3) — read-only `reconcileDealer()`; ADR-034 | `src/lib/ledger/reconciliation/`, `/ledger/reconciliation` |
| Financial Integrity Monitor | ✅ Complete (PHASE_07E4) — `runFinancialIntegrityScan()`; ADR-035 | `src/lib/ledger/monitor/` |
| Financial Integrity Console | ✅ Complete (PHASE_07E5) — production `/ledger/integrity`; ADR-036 | `src/components/ledger/integrity/` |
| Due Reports | ❌ Not built | — |
| Audit Log UI | ❌ Not built | — |
| User Management | ❌ Not built | — |

---

## 7. Document Platform Architecture

**Location:** `src/components/documents/`, `src/lib/documents/`

### Primitives (shared)

`DocumentLayout`, `CompanyHeader`, `CompanyFooter`, `DocumentTitle`, `DocumentParties`, `DocumentMetadata`, `DocumentTable`, `DocumentFinancialSummary`, `DocumentNotes`, `DocumentSignature`, `DocumentSeal`, `DocumentPrintToolbar`

### Document Composers

| Document | Component | Route |
|----------|-----------|-------|
| Invoice | `InvoicePrintable` | `/invoices/[id]/print` |
| Money Receipt | `MoneyReceiptPrintable` | `/collections/[id]/receipt` |
| Dealer Statement | `DealerStatementPrintable` | `/ledger` (print preview modal) |

### Pipeline

```
Server DTO → mapper → Printable component → preview modal / print route → window.print()
```

**Rules:** No client money math. Preview = Print = PDF. Vector HTML/CSS only. Max 20 invoice line rows per A4 page.

### Branding

- `src/lib/documents/company-branding.ts` → `getCompanyBranding()`
- Logo: `public/branding/nazma-logo.png`
- Enterprise blue: `#1a5dad` (`--doc-enterprise-blue`)

See ADR-017, ADR-023.

---

## 8. Financial Posting Service

**Location:** `src/lib/finance/posting-service.ts`  
**Mandate:** ALL balance mutations go through this module.

| Function | Trigger |
|----------|---------|
| `postReceivableIncrease()` | Invoice issue |
| `postReceivableDecrease()` | Collection confirm |
| `postReceivableDecreaseReversal()` | Collection reverse |

**Concurrency:** `lockDealerForFinancialUpdate()` — `SELECT … FOR UPDATE` in `dealer-lock.ts`

**PHASE_07A (shipped):** ledger foundation module `src/lib/ledger/` — posting-key builder, immutable posting contracts, `createLedgerEntry` service, reconciliation helpers, opening-balance builders. Posting service inputs extended with optional ledger metadata.

**PHASE_07B (shipped):** `createLedgerEntry` wired inside all three receivable functions. Every posting now inserts an immutable `LedgerEntry` and asserts `LedgerEntry.balance == Dealer.currentBalance` via `assertLedgerBalanceMatchesCache`. Compensating reversal via `postingType = Reversal` + `reversesEntryId`. Idempotent under retry via `postingKey @unique`. Collection cash-receipt `referenceType` corrected to `Collection` (ADR-024 §10).

**PHASE_07C (shipped):** `postOpeningBalance()` added — the Financial Initialization Engine's only entry point into the posting boundary. Reuses `createLedgerEntry`, dealer row lock, cache/ledger parity, and audit; asserts `previousBalance = 0.00` before posting (opening balance is a dealer's first-ever posting). No `LedgerEntry` for zero-amount opening balances (audit + status transition only).

**PHASE_07D1 (shipped):** `src/lib/ledger/statement/` — read-only Dealer Statement engine. `getDealerStatement()` / `getDealerStatementSummary()` project paginated rows from `LedgerEntry`; running balance copied verbatim from `LedgerEntry.balance`; ledger integrity validated via `validateDealerLedgerChain()`; server actions at `src/lib/actions/ledger-statement/`. No PDF, reports, exports, or ledger writes.

**PHASE_07D2 (shipped):** Production Dealer Statement UI at `/ledger` — header, filters, summary cards, ledger table, integrity badge. Consumes `getDealerStatement()` only; no money math in React. ADR-030.

**PHASE_07D3 (shipped):** Printable Dealer Statement via Document Platform — `DealerStatementPrintable`, statement mapper, print preview from `/ledger`. Preview = Print = PDF. ADR-031. Excel/email export deferred.

**PHASE_07E3 (shipped):** `src/lib/ledger/reconciliation/` — read-only Enterprise Reconciliation Engine. `reconcileDealer()` / `reconcileAllDealers()` verify cache parity, sum parity, and chain integrity. Dev page `/ledger/reconciliation`. Never mutates financial data. ADR-034.

**PHASE_07E4 (shipped):** `src/lib/ledger/monitor/` — Scheduled Financial Integrity Monitor. `runFinancialIntegrityScan()` orchestrates `reconcileAllDealers()` and persists `FinancialIntegrityScan` summary history. ADR-035.

**PHASE_07E5 (shipped):** Production Financial Integrity Console at `/ledger/integrity` — header, summary cards, scan history, manual scan, dealer drill-down. Presentation only. ADR-036.

**Future:** Cron wiring, notifications, repair tools, Excel/email statement export; PHASE_07F Chart of Accounts (optional).

---

## 9. Allocation Engine

**Location:** `src/lib/collections/allocation-engine.ts`, `reference-resolver.ts`

- Polymorphic `CollectionAllocation(referenceType, referenceId)`
- `FinancialReferenceType`: Invoice, OpeningBalance (implemented); CreditNote, DebitNote, ManualAdjustment, JournalEntry (reserved). Opening Balance never posts via allocation — only via `postOpeningBalance()`.
- Pool invariant: `receivedAmount = allocatedAmount + unallocatedAmount`
- Allocatable cap: `grandTotal − collectionReceived` per invoice
- **No balance posting on allocation** (cash posted on confirm only)

See ADR-019, ADR-020, ADR-024.

---

## 10. Dealer Balance Model

| Field | Semantics |
|-------|-----------|
| `Dealer.currentBalance` | AR cache: positive = dealer owes; negative = advance credit |
| `Dealer.creditLimit` | Maximum exposure at invoice issue |
| `Invoice.previousDue` | Snapshot of balance before this invoice |
| `Invoice.currentDue` | Running due on this invoice (reduced by allocation) |
| `Invoice.collectionReceived` | Sum allocated to this invoice |
| `Collection.receivedAmount` | Total cash received |
| `Collection.unallocatedAmount` | Advance pool remainder |

### Source-of-Truth Hierarchy (ADR-024)

1. **Tier 1 — Authoritative:** `LedgerEntry` (append-only journal subledger; populated as of PHASE_07B)
2. **Tier 2 — Document truth:** Invoice, InvoiceItem, Collection, CollectionAllocation
3. **Tier 3 — Operational cache:** `Dealer.currentBalance`, invoice due fields, collection pool fields — asserted equal to Tier 1 on every commit

---

## 11. Key Domain Models (Prisma)

| Model | Role |
|-------|------|
| `SalesOrder` / `SalesOrderItem` | Commercial commitment |
| `DeliveryChallan` / `DeliveryChallanItem` | Logistics (non-financial) |
| `Invoice` / `InvoiceItem` | Receivable document + immutable line snapshots |
| `Collection` / `CollectionAllocation` | Cash receipt + polymorphic application |
| `Dealer` | Customer master + AR cache |
| `LedgerEntry` | Append-only journal subledger (populated on every receivable event as of PHASE_07B; opening balance as of PHASE_07C) |
| `OpeningBalance` | Financial Initialization record — `Draft → Validated → Posted+Locked`; `dealerCode @unique` (PHASE_07C) |
| `AuditLog` | Append-only event trail |

---

## 12. Server Action Architecture

| Pattern | Convention |
|---------|------------|
| Location | `src/lib/actions/{module}/` |
| Guards | `requirePermission()` at action entry |
| Validation | Zod schemas in `src/lib/validators/` |
| Response | `ActionResult<T>` envelope with typed error codes |
| Workflow | `src/lib/{module}/workflow.ts` guards before mutations |
| Transactions | `prisma.$transaction` for all financial mutations |
| DTOs | `src/types/{module}.ts` — money as decimal strings |
| Revalidation | `revalidatePath()` on mutating actions |

**Financial mutations:** always include dealer lock → document persist → posting service → audit log in one transaction.

---

## 13. Deployment Topology

```
┌─────────────────────────────────────────┐
│  Netlify / Docker host                  │
│  ┌───────────────────────────────────┐  │
│  │  Next.js App (App Router)         │  │
│  │  Server Components + Actions      │  │
│  │  Middleware (auth + RBAC)         │  │
│  └───────────────┬───────────────────┘  │
│                  │ Prisma                │
│  ┌───────────────▼───────────────────┐  │
│  │  PostgreSQL 16                    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

- Local dev: `docker compose up` (app + PostgreSQL)
- Migrations: `prisma migrate deploy`
- No separate PDF server; browser print for documents

---

## 14. Module Dependencies

```
Auth/RBAC ──► all modules
Dealers ──► Orders, Challans, Invoices, Collections
Products ──► Orders, Challans, Invoices
Orders ──► Delivery Challans ──► Invoices
Invoices ──► Collections (via allocation)
Collections ──► Money Receipt (document only)
Finance/posting-service ◄── Invoices, Collections
Documents ◄── Invoices, Collections (read-only DTO mapping)
Ledger (future) ◄── posting-service
```

**Hard boundary:** Delivery module must never import `src/lib/finance/`.

---

## 15. Integration Boundaries

| Boundary | Rule |
|----------|------|
| Delivery ↔ Finance | Zero imports; challan never mutates balance |
| Allocation ↔ Posting | Allocation never calls posting service for balance |
| UI ↔ Money | React displays server-formatted strings only |
| Documents ↔ Calculation | Mappers format; never recalculate totals |
| Ledger (future) | Written only from `posting-service.ts` |

---

## 16. Data Flow (Financial)

```
issueInvoice()
  → lockDealerForFinancialUpdate()
  → build Invoice + InvoiceItem snapshots
  → postReceivableIncrease()
      ├── Dealer.currentBalance += grandTotal (atomic, drift-checked)
      ├── createLedgerEntry(postingType=Issue, Debit=grandTotal)
      └── assertLedgerBalanceMatchesCache
  → AuditLog (INVOICE_CREATED, DEALER_BALANCE_UPDATED + ledgerEntryId)
  → commit

confirmCollection()
  → lockDealerForFinancialUpdate()
  → Collection status → Confirmed
  → postReceivableDecrease(referenceType=Collection)
      ├── Dealer.currentBalance -= receivedAmount (atomic, drift-checked)
      ├── createLedgerEntry(postingType=Collection, Credit=receivedAmount)
      └── assertLedgerBalanceMatchesCache
  → AuditLog (COLLECTION_CONFIRMED, DEALER_BALANCE_DECREASED + ledgerEntryId)
  → commit

reverseCollection()
  → lockDealerForFinancialUpdate()
  → per-allocation invoice field reversal
  → postReceivableDecreaseReversal(referenceType=Collection)
      ├── Dealer.currentBalance += receivedAmount (atomic, drift-checked)
      ├── createLedgerEntry(postingType=Reversal, Debit=receivedAmount,
      │                    reversesEntryId=<original Collection entry>)
      └── assertLedgerBalanceMatchesCache
  → Collection status → Reversed
  → AuditLog (COLLECTION_REVERSED + ledgerEntryId + ledgerReversesEntryId)
  → commit

allocateCollection()
  → lockDealerForFinancialUpdate()
  → CollectionAllocation rows
  → Invoice.collectionReceived / currentDue update
  → pool invariant check
  → NO posting service balance call
  → NO ledger entry (cash already posted on confirm)
  → commit

postOpeningBalanceRecord()  [PHASE_07C]
  → assertValidatedForPosting() / assertNotLocked()
  → lockDealerForFinancialUpdate()
  → re-check Locked status AFTER lock (idempotent replay — ADR-028 §6.2)
  → assertPreviousBalanceZero(lockedDealer.currentBalance)
  → postOpeningBalance()  [posting-service.ts]
      ├── Dealer.currentBalance += amount (atomic; skipped if amount = 0)
      ├── createLedgerEntry(postingType=OpeningBalance, sign-aware) — skipped if amount = 0
      └── assertLedgerBalanceMatchesCache
  → OpeningBalance.status → Posted + Locked (same transaction)
  → AuditLog (DEALER_OPENING_BALANCE_POSTED + ledgerEntryId)
  → commit
```

---

## 17. Completed Phases

| Phase | Description |
|-------|-------------|
| PHASE_01 | Foundation, localization |
| PHASE_02 | Dealer backend + UI |
| PHASE_03 | Product backend + UI |
| PHASE_00B/00C | Schema hardening, invoice relation fix |
| PHASE_AUTH | Authentication + RBAC |
| PHASE_04 | Sales Order backend + UI |
| PHASE_05A–05B | Delivery Challan backend + UI |
| PHASE_05C1–05C2A | Invoice engine + financial audit + concurrency hotfix |
| PHASE_05D1–05D3 | Invoice UI + document engine + production QA |
| PHASE_06A1–06A3 | Collections schema + engine + financial certification |
| PHASE_06B | Collections UI |
| PHASE_06C | Money Receipt + document platform upgrade |
| PHASE_06D | Financial architecture certification (ADR-024) |
| PHASE_07A | Enterprise Ledger Foundation (ADR-025) |
| PHASE_07B | Enterprise Ledger Posting Engine (ADR-026) |
| PHASE_07B.5 | Enterprise Financial Integrity Certification (ADR-027) |
| PHASE_07C | Enterprise Financial Initialization Engine — Opening Balance (ADR-028) |
| PHASE_07D1 | Enterprise Dealer Subledger Foundation — read-only statement engine (ADR-029) |
| PHASE_07D2 | Enterprise Dealer Statement UI — production `/ledger` (ADR-030) |
| PHASE_07D3 | Enterprise Dealer Statement Document Platform — printable via Document Platform (ADR-031) |

---

## 18. Outstanding Phases

| Phase | Description |
|-------|-------------|
| Invoice PDF Patch | Layout polish from client feedback (document platform only) |
| Statement Document Composer | ~~Printable / PDF from `DealerStatementDTO`~~ ✅ PHASE_07D3 |
| PHASE_07E1 Backfill Discovery | ~~Identify dealers requiring ledger reconstruction~~ ✅ PHASE_07E1 |
| PHASE_07E2 Historical Replay | ~~Replay invoices/collections → ledger entries~~ ✅ PHASE_07E2 |
| PHASE_07E3 Reconciliation Engine | ~~Read-only integrity detection~~ ✅ PHASE_07E3 |
| PHASE_07E4 Integrity Monitor | ~~Automated scan + persisted history~~ ✅ PHASE_07E4 |
| PHASE_07E5 Integrity Console | ~~Production operations console~~ ✅ PHASE_07E5 |
| Statement Excel / Email | Excel export / email delivery from same DTO |
| PHASE_07F | Chart of Accounts foundation (optional) |
| PHASE_08 | Due reports |
| Reporting / Analytics | Operational and management reports |
| Final Production Hardening | Concurrency tests, reconciliation, deployment checklist |

---

## 19. Architecture Philosophy

- **Separation of concerns** — logistics ≠ receivables ≠ cash ≠ application
- **Immutable financial documents** — corrections via reversal/compensation, never in-place edits
- **Single posting boundary** — all balance mutations through posting service
- **Snapshot discipline** — historical documents stable regardless of master data changes
- **Extension over rewrite** — polymorphic allocation, posting service callbacks, document platform primitives
- **Certify before build** — architecture ADRs before implementation phases

---

## 20. Financial Safety Rules (Quick Reference)

See `FINANCIAL_INVARIANTS.md` for full rulebook.

- Never use JS `number` for money
- Never mutate `Dealer.currentBalance` outside posting service
- Never import finance into delivery challan code
- Never calculate money in React components
- Always `prisma.$transaction` for financial mutations
- Always `lockDealerForFinancialUpdate()` before balance operations
- Never edit issued invoice lines or confirmed collection headers
- Allocation never posts balance — cash posts on confirm only
- Invoice quantities from challan only
- Reversals are compensating transactions only

---

## 21. Production Readiness (ADR-024)

**Overall score: 9.1 / 10** (ADR-027)

| Subsystem | Score |
|-----------|-------|
| Orders | 9.0 |
| Delivery | 9.0 |
| Invoice | 9.0 |
| Collections | 9.2 |
| Money Receipt | 9.0 |
| Document Engine | 9.0 |
| Financial Posting | 9.3 |
| Ledger | 9.3 |
| Financial Initialization | 9.2 |
| Reporting Readiness | 7.0 |

**Suitable for controlled production:** Order → Challan → Invoice → Collection → Money Receipt → Opening Balance pipeline.

**Not yet production-ready:** Statement Excel/email export, due reports, credit notes, dashboards, statutory financial statements, bulk opening balance import UI.

**Blocking defects:** None for Order → Invoice → Collection → Ledger posting → Opening Balance → Dealer Statement read + UI + printable document pipeline as of PHASE_07D3.

**PHASE_07E1 (Backfill Discovery):** SHIPPED per ADR-032. **PHASE_07E2 (Historical Replay):** SHIPPED per ADR-033. **PHASE_07E3 (Reconciliation Engine):** SHIPPED per ADR-034. **PHASE_07E4 (Integrity Monitor):** SHIPPED per ADR-035. **PHASE_07E5 (Integrity Console):** SHIPPED per ADR-036.

---

## 22. Critical File Locations

| Concern | Path |
|---------|------|
| Posting service | `src/lib/finance/posting-service.ts` |
| Dealer lock | `src/lib/finance/dealer-lock.ts` |
| Invoice workflow | `src/lib/invoices/workflow.ts` |
| Collection workflow | `src/lib/collections/workflow.ts` |
| Allocation engine | `src/lib/collections/allocation-engine.ts` |
| Reference resolver | `src/lib/collections/reference-resolver.ts` |
| Invoice issue | `src/lib/actions/invoices/issue-invoice.ts` |
| Document branding | `src/lib/documents/company-branding.ts` |
| Invoice mapper | `src/lib/documents/map-invoice-document.ts` |
| Receipt mapper | `src/lib/documents/map-collection-receipt.ts` |
| Print CSS | `src/components/documents/styles/document-print.css` |
| Dealer statement read engine | `src/lib/ledger/statement/` — `getDealerStatement()` |
| Ledger backfill discovery | `src/lib/ledger/backfill/` — `getLedgerBackfillCandidates()` |
| Dealer statement actions | `src/lib/actions/ledger-statement/` |
| Dealer statement UI | `src/components/ledger/`, `/ledger` |
| Dealer statement document | `src/components/documents/statement/` |
| Ledger reconciliation | `src/lib/ledger/reconciliation/` — `reconcileAllDealers()` |
| Financial integrity monitor | `src/lib/ledger/monitor/` — `runFinancialIntegrityScan()` |
| Financial integrity console | `src/components/ledger/integrity/` — `/ledger/integrity` |
| Statement print fetch | `src/lib/documents/fetch-dealer-statement-for-print.ts` |
| Permissions | `src/lib/permissions.ts` |
| RBAC guards | `src/lib/rbac/guards.ts` |
| Schema | `prisma/schema.prisma` |

---

## 23. Future Extension Points

| Extension | Hook |
|-----------|------|
| Bulk opening balance import / ERP migration | `postOpeningBalanceBatch()` + `OpeningBalanceSource.CsvImport/ExcelImport/ErpMigration` — shipped PHASE_07C, needs only a file parser + import UI |
| Company / Branch / Fiscal Year Initialization | New orchestration module beside `opening-balance-service.ts`, same core-engine idiom |
| Credit notes | `FinancialReferenceType.CreditNote` + `postCreditNote()` |
| Dealer statement | `getDealerStatement()` read engine (PHASE_07D1) + production UI `/ledger` (PHASE_07D2) + printable document (PHASE_07D3) |
| Challan PDF | `DocumentLayout` + challan sections (ADR-023) |
| Company settings | Override `getCompanyBranding()` |
| Multi-company | Tenant isolation on top of clean module boundaries |

---

## 24. ADR Index (Key References)

| ADR | Topic |
|-----|-------|
| ADR-007 | One order → many invoices |
| ADR-011 | Fulfillment pipeline (challan layer) |
| ADR-012 | Delivery challan backend design |
| ADR-014 | Invoice engine |
| ADR-015 | Financial integrity audit |
| ADR-017 | Enterprise document engine |
| ADR-018 | Invoice production certification |
| ADR-019 | Collections foundation |
| ADR-020 | Collection engine |
| ADR-021 | Collection financial certification |
| ADR-023 | Money receipt engine |
| ADR-024 | Financial architecture certification |
| ADR-025 | Enterprise Ledger Foundation (PHASE_07A) |
| ADR-026 | Enterprise Ledger Posting Engine (PHASE_07B) |
| ADR-027 | Enterprise Financial Integrity Certification (PHASE_07B.5) |
| ADR-028 | Enterprise Financial Initialization Engine (PHASE_07C) |
| ADR-029 | Enterprise Dealer Subledger Foundation (PHASE_07D1) |
| ADR-030 | Enterprise Dealer Statement UI (PHASE_07D2) |
| ADR-031 | Enterprise Dealer Statement Document Platform (PHASE_07D3) |
| ADR-032 | Enterprise Ledger Backfill Discovery (PHASE_07E1) |
| ADR-033 | Enterprise Historical Ledger Replay Engine (PHASE_07E2) |
| ADR-034 | Enterprise Reconciliation Engine (PHASE_07E3) |
| ADR-035 | Scheduled Financial Integrity Monitor (PHASE_07E4) |
| ADR-036 | Financial Integrity Operations Console (PHASE_07E5) |

---

## 25. Session Bootstrap Checklist

1. Read `SYSTEM_CONTEXT.md` (this document)
2. Read `CURRENT_PHASE.md` for active phase
3. Read `NEXT_ACTION.md` for immediate tasks
4. Read `IMPLEMENTATION_STATUS.md` for verification state
5. Read `PROJECT_BRAIN.md` for business domain
6. Read `prisma/schema.prisma` before any schema work
7. Read relevant ADR before modifying a module
8. Never violate `FINANCIAL_INVARIANTS.md`
9. Check `TECH_DEBT.md` and `KNOWN_RISKS.md` before architectural changes
10. Check `CLIENT_FEEDBACK_LOG.md` for business intent behind features
11. Check `ARCHITECTURE_DECISIONS_REJECTED.md` before proposing rejected patterns

---

## 26. Governance Documents

| Document | Purpose |
|----------|---------|
| `CLIENT_FEEDBACK_LOG.md` | Permanent client change history |
| `FINANCIAL_INVARIANTS.md` | Mandatory accounting rules |
| `TECH_DEBT.md` | Deferred improvements register |
| `KNOWN_RISKS.md` | Production risk register |
| `ARCHITECTURE_DECISIONS_REJECTED.md` | Rejected designs and rationale |
| `SYSTEM_CONTEXT.md` | This document — session bootstrap |
| `CURRENT_PHASE.md` | Active phase status |
| `IMPLEMENTATION_STATUS.md` | Verification evidence |
| `NEXT_ACTION.md` | Immediate next steps |
| `CHANGELOG.md` | Release history |
| `docs/ADR/*.md` | Architecture decision records |
