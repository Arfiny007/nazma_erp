# CHANGELOG

All notable changes to Nazma ERP are documented here.

---

## [PHASE_10B] — 2026-07-13 — Enterprise User Management Certification

### Added

- `src/lib/certification/users/` — Rules 1–12 certification module
- `runUserCertification()` / `runUserCertificationWithReport()`
- `UserAuditCoverageReport` — covered / partial / missing for user audit actions
- Repository scans: financial boundary, architecture imports, territory leakage
- Performance audit for list/search/get operations (<1000ms target)
- `user-certification.test.ts` — 20 tests
- ADR-050

### Certified

- Super Admin full lifecycle authority
- Manager SR-only isolation; no activate/disable
- SR self-profile only; Accounts read-only
- Privilege escalation blocked (SR/Manager/Accounts matrix)
- Lifecycle state machine — ARCHIVED terminal; illegal transitions rejected
- All 5 user audit writers present in `user-service.ts`
- No forbidden financial engine imports in user module

### Warnings (non-blocking)

- `mustChangePassword` not enforced at login — PHASE_10C
- `UserActivationToken` writer reserved for PHASE_10C

### Verdict

**470 tests passed / 7 skipped** (+20 new tests) — PHASE_10C (User Activation UX) approved

---

## [PHASE_10A] — 2026-07-13 — Enterprise User Management Foundation

### Added

- `UserLifecycleStatus` enum + additive models: `UserProfile`, `UserInvitation`, `UserActivationToken`
- `User.lifecycleStatus`, `mustChangePassword`, `managerId`, `provisionedById`
- `src/lib/users/` — provisioning service, lifecycle guards, RBAC validation, audit writers
- Server actions: `createUser`, `updateUser`, `activateUser`, `disableUser`, `listUsers`, `getUser`, `searchUsers`
- `/settings/users` — enterprise user console (table, filters, details panel, dialogs)
- Granular permissions replacing `users:manage`
- Audit writers: `USER_CREATED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `USER_ROLE_CHANGED`
- `user-management.test.ts` — 11 tests
- ADR-049

### Architecture

- Lifecycle: `INVITED → PENDING_ACTIVATION → ACTIVE → DISABLED → ARCHIVED`
- Temporary passwords hashed with bcrypt; shown once to administrator
- Territory assignments reuse `UserTerritoryAssignment` + `buildTerritoryScope()`
- Manager: SR draft/create only within assigned territories
- Accounts: read-only list/detail; SR: own profile only

### Verdict

**450 tests passed / 7 skipped** (+11 new tests) — PHASE_10B (User Management Certification) next

---

## [PHASE_09E] — 2026-07-13 — Enterprise Audit Export & Compliance Archive

### Added

- `src/lib/audit/export/` — server-generated PDF, Excel, ZIP compliance packages
- Server actions: `exportAuditPdf`, `exportAuditExcel`, `exportAuditArchive` (`audit:view`)
- UI: `audit-export-menu`, `audit-export-dialog`, `audit-export-progress` on `/audit`
- Dependencies: `exceljs`, `jszip`, `pdfkit`
- `audit-export.test.ts` — 11 tests
- ADR-048

### Architecture

- Single read path: `getAuditConsoleData()` → export composers (no second query layer)
- 10,000 row export cap with `AuditExportSizeLimitError`
- Territory scope and Accounts category restrictions inherited from PHASE_09D
- Compliance archive: `audit-report.pdf`, `audit-records.xlsx`, `compliance-summary.json`

### Verdict

**443 tests passed / 7 skipped** (+11 new tests) — User Management (PHASE_10) next

---

## [PHASE_09D.5] — 2026-07-13 — Enterprise Audit & Compliance Certification

### Added

- `src/lib/certification/audit/` — `runAuditCertification()` Rules 1–10
- `AuditCoverageReport` — covered / partial / missing workflow measurement
- Repository scans: financial immutability, territory leakage, architecture
- Performance audit for audit console loads
- ADR-047

### Verdict

**phase09eApproved: true** — PHASE_09E (Audit Export) approved

---

## [PHASE_09D] — 2026-07-13 — Enterprise Audit Log & Compliance Console

### Added

- `src/lib/audit/` — `AuditRecord` contract, scoped query service, timeline grouping
- `src/components/audit/` — summary cards, server-side filters, table, timeline
- Server action: `getAuditConsole()`
- Routes: `/audit`, `/dashboard/audit`
- `audit:view` permission for Super Admin, Accounts, Manager, SR
- EN/BN localization for audit console
- ADR-046

### Architecture

- Consumes existing `AuditLog` rows only — no duplicate audit generation
- Territory RBAC via `buildTerritoryScope()` + batched entity ID resolution
- Accounts restricted to financial + integrity categories
- SR scoped to assigned dealers and related operational entities
- Server-side search, pagination, and summary counts

### Verdict

**PHASE_09D complete** — Audit Export (PHASE_09E) or User Management next

---

## [PHASE_09C] — 2026-07-13 — Enterprise Territory Map & Geo Visualization

### Added

- `src/lib/dashboard/maps/` — `TerritoryMapNode` contract, batched map service, risk classification
- `src/components/dashboard/maps/` — division/district/territory grid visualization
- Server actions: `getTerritoryMap`, `getManagerTerritoryMap`, `getAccountsTerritoryMap`, `getAdminTerritoryMap`
- Parallel dashboard + analytics + map fetch on `/dashboard`
- EN/BN localization for territory map widgets
- ADR-045

### Architecture

- Sales/collections batched via single `findMany` + in-memory aggregation per territory
- Due from `aggregateTerritoryDue()` analytics path (dealer `currentBalance`)
- Dealer/SR counts via `groupBy` — no N+1 per territory
- Risk classification visualization-only — not persisted
- Territory RBAC via `buildTerritoryScope()` on all map queries

### Verdict

**400 tests passed / 7 skipped** (+19 new tests) — Audit Log UI or PHASE_09D next

---

## [PHASE_09B] — 2026-07-11 — Enterprise Dashboard BI & Analytics

### Added

- `src/lib/dashboard/analytics/` — role-aware BI layer with `DashboardChart` contract
- `src/components/dashboard/charts/` — lightweight SVG chart system (line, bar, pie, area)
- Server actions: `getDashboardAnalytics`, `getSrAnalytics`, `getManagerAnalytics`, `getAccountsAnalytics`, `getAdminAnalytics`
- Parallel dashboard + analytics fetch on `/dashboard`
- EN/BN localization for all chart widgets
- ADR-044

### Architecture

- Sales/collections from operational Prisma aggregates (`Invoice.grandTotal`, `Collection.receivedAmount`)
- Due/aging from Due Report Engine (`getCompanyDueSummary`, dealer aggregation paths)
- Integrity from `getLatestIntegrityScan()`
- Outstanding trend reads `Invoice.currentDue` by issue month — no balance mutation
- Admin `territoryHeatmap` DTO ready for map UI (PHASE_09C)

### Verdict

**381 tests passed / 7 skipped** (+14 new tests) — PHASE_09C (Territory Map) or Audit Log UI next

---

## [PHASE_09A.5] — 2026-07-11 — Enterprise Dashboard Certification

### Added

- `src/lib/certification/dashboard/` — `runDashboardCertification()` with Rules 1–9
- Subsystem scores: security, financial, performance, architecture
- Repository scans: financial authority, territory leakage, architectural imports
- Live performance audit when DATABASE_URL + demo seed available
- ADR-043

### Verdict

**367 tests passed / 7 skipped** (+20 new tests) — **PHASE_09B APPROVED**

---

## [PHASE_09A] — 2026-07-11 — Enterprise Dashboard Foundation

### Added

- `src/lib/dashboard/` — role-aware dashboard read layer with `DashboardPayload` contract
- Server actions: `getDashboard`, `getSrDashboard`, `getManagerDashboard`, `getAccountsDashboard`, `getAdminDashboard`
- `src/components/dashboard/` — enterprise dashboard UI (cards + tables only)
- Production route `/dashboard` with server-side role resolution; `/` redirects to `/dashboard`
- EN/BN localization for all dashboard widgets and KPIs
- ADR-042

### Architecture

- Due/receivable KPIs from Due Report Engine (`getCompanyDueSummary`, `getDueReport`, `getSrDueReport`, `getTerritoryDueReport`)
- Integrity/reconciliation status from Integrity Monitor + Reconciliation Engine
- Invoice/collection totals are operational Prisma aggregates — not balance authority
- Territory RBAC via `buildTerritoryScope()` on all scoped queries

### Verdict

**337 tests passed / 7 skipped** (+20 new tests) — PHASE_09B (charts/BI) or Audit Log UI next

---

## [PHASE_08E.1] — 2026-07-11 — Territory Security Hotfix

### Fixed

- `getDealerCollectionContext()` — added `canAccessDealerByCode` territory gate before financial queries
- Cross-territory collection workspace visibility closed (PHASE_08E finding)

### Added

- `get-dealer-collection-context.test.ts` — 9 territory RBAC tests

### Verdict

Territory security score **10/10** — overall production readiness **9.7/10**

---

## [PHASE_08E] — 2026-07-11 — Enterprise Territory & Due Certification

### Added

- `src/lib/certification/territory/` — `runTerritoryCertification()` with Rules 1–8
- Subsystem scores: territory security, ownership integrity, due accuracy, financial boundary
- Aging vs balance reconciliation with documented delta causes (Rule 7)
- Repository boundary scans (duplicated due logic, rogue territory checks, client-side money math)
- ADR-041

### Verdict

**317 tests passed / 7 skipped** — Territory & due layer certified at 9.6/10

---

## [PHASE_08D] — 2026-07-11 — Enterprise Due Report Engine

### Added

- `src/lib/reports/due/` — read-only due report engine (6 service functions, aging, query, validation)
- Server actions: `getDueReport`, `getTerritoryDueReport`, `getSrDueReport`, `getCompanyDueSummary`, `getDueAgingReport`
- `/reports/due` — enterprise due report page with filters, summary cards, territory/SR/dealer tables
- ADR-040

### Architecture

- `Dealer.currentBalance` authoritative for dealer-level due — no duplicate balance engine
- Invoice outstanding + `dueDate` for aging buckets only
- Territory RBAC via `mergeDealerTerritoryScope()`
- Historical SR attribution via read-only `DealerOwnershipHistory` join at invoice `issueDate`
- Financial engines untouched (posting, ledger, statement, reconciliation, certification)

### Verdict

**299 tests passed / 7 skipped** — PHASE_08E (exports/analytics) or Audit Log UI next

---

## [PHASE_08C] — 2026-07-11 — Enterprise Dealer Ownership & Territory Migration

### Added

- `DealerOwnershipHistory` model — auditable territory timeline
- `src/lib/dealers/ownership/` — assign, transfer, backfill, history queries
- Dealer form geography selects (Division → District → Territory)
- `/dealers/[id]/ownership` ownership timeline UI
- `runDealerOwnershipBackfill()` with migrated/skipped/failed report
- ADR-039

### Architecture

- Organizational layer only — financial records immutable
- Single active ownership per dealer enforced in service layer

### Verdict

**PHASE_08 (Due Reports) NEXT**

---

## [PHASE_08B] — 2026-07-11 — Enterprise Territory RBAC Engine

### Added

- `UserTerritoryAssignment` Prisma model — SR/Manager → Territory mapping
- `src/lib/rbac/territory/` — `buildTerritoryScope`, `canAccess*`, scope merge filters
- Territory scope injection: `listDealers`, `listOrders`, `listCollections`
- Territory gates: `getDealer`, `updateDealer`, `getOrder`, `createOrder`, `getCollection`, statement actions
- Territory assignment server actions + `/settings/territory-assignments` admin UI
- ADR-038 — Enterprise Territory RBAC Engine
- 15+ unit tests in `territory-rbac.test.ts`

### Architecture

- Authorization only — financial engines untouched
- No scattered `if (role === "SR")` — all decisions via `buildTerritoryScope()`

### Verdict

**PHASE_08C (Dealer Ownership) NEXT**

---

## [PHASE_08A] — 2026-07-11 — Enterprise Geography Foundation

### Added

- `Division`, `District`, `Territory` Prisma models
- `Dealer.divisionId`, `districtId`, `territoryId` FKs (nullable)
- Bangladesh seed: 8 divisions, 64 districts, 64 default territories
- Geography server actions + cascading select components
- `/settings/geography`, `/settings/territories` admin pages

---

## [PHASE_07F] — 2026-07-10 — Enterprise Financial System Certification

### Added

- `runFinancialCertification()` — full enterprise financial certification entry point
- Rules 1–10 verification across all financial subsystems
- Repository boundary grep, concurrency/sensitivity/immutability/performance checks
- `FinancialCertificationReport` with subsystem scores, risks, manual checks
- ADR-037 — Enterprise Financial System Certification
- 12 unit tests in `financial-certification.test.ts`

### Architecture

- Read-only verification — reuses reconciliation, statement, integrity monitor
- No modifications to posting engines, document platform, or schema
- Live database checks require reachable `DATABASE_URL`

### Verification

- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors
- `npx vitest run` — 245 passed / 7 skipped (12 new tests)

### Verdict

**PHASE_08 (Due Reports) APPROVED**

---

## [PHASE_07E5] — 2026-07-10 — Financial Integrity Operations Console

### Added

- Production Financial Integrity Console at `/ledger/integrity`
- Header, summary cards, scan history, manual scan, dealer drill-down
- Client-side dealer filters (status, search; date future-ready)
- ADR-036 — Financial Integrity Operations Console
- 11 presentation tests in `integrity-console.test.ts`

### Architecture

- Presentation only — consumes `FinancialIntegrityScan` + reconciliation DTOs
- GREEN/YELLOW overall status from persisted scan counts
- Reuses `runFinancialIntegrityScan()` and `getReconciliationSummary()`

### Verification

- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors
- `npx vitest run` — 233 passed / 7 skipped (11 new tests)

---

## [PHASE_07E4] — 2026-07-10 — Scheduled Financial Integrity Monitor

### Added

- `runFinancialIntegrityScan()` — orchestrates `reconcileAllDealers()` and persists scan summary
- `getLatestIntegrityScan()` / `listIntegrityScans()` — scan history queries
- `FinancialIntegrityScan` Prisma model + migration
- Dev page `/ledger/integrity` — latest scan, history table, manual run button
- ADR-035 — Scheduled Financial Integrity Monitor
- 11 unit tests in `ledger-monitor.test.ts`

### Architecture

- Orchestration only — reuses PHASE_07E3 reconciliation engine
- Persists summary counts only — no per-dealer report rows
- No cron / workers configured — callable entry point for future infra
- Financial administration RBAC (`invoices:create`)

### Verification

- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors
- `npx vitest run` — 222 passed / 7 skipped (11 new tests)

---

## [PHASE_07E3] — 2026-07-10 — Enterprise Reconciliation Engine

### Added

- `reconcileDealer()` / `reconcileAllDealers()` — read-only integrity verification
- `getReconciliationSummary()` — full report with per-dealer rows
- Dev page `/ledger/reconciliation` — summary cards + dealer table
- ADR-034 — Enterprise Reconciliation Engine
- 10 unit tests in `ledger-reconciliation.test.ts`

### Architecture

- Read-only — never mutates `LedgerEntry` or `Dealer.currentBalance`
- Detects CONSISTENT, DRIFT, MISSING_LEDGER, CORRUPTED_CHAIN
- Reuses PHASE_07A chain validation helpers

---

## [PHASE_07E2] — 2026-07-10 — Enterprise Historical Ledger Replay Engine

### Added

- `replayDealerLedger()` — idempotent historical reconstruction of missing `LedgerEntry` rows
- `executeLedgerBackfill()`, `previewLedgerReplay()`, `getReplayStatus()` server actions
- Dev page `/ledger/backfill` — Replay, Preview, Status controls per dealer
- ADR-033 — Enterprise Historical Ledger Replay Engine
- 15 unit tests in `ledger-backfill.test.ts`

### Architecture

- Replay uses `createLedgerEntry()` + `buildLedgerPostingKey()` — no posting logic duplication
- Strict order: Opening Balance → Invoices → Collections → Reversals
- Parity verified after replay; transaction rolls back on mismatch
- Never mutates `Dealer.currentBalance`

---

## [PHASE_07E1_HISTORICAL_LEDGER_DISCOVERY_ENGINE] — 2026-07-10

### Purpose

Identify dealers that require historical ledger reconstruction before any
PHASE_07E replay or backfill executes. Discovery only — no repair, no replay,
no mutation.

### Added

- **Backfill discovery module** (`src/lib/ledger/backfill/`):
  - `getLedgerBackfillCandidates()` — scans all dealers
  - Classification: `NO_LEDGER`, `PARTIAL_LEDGER`, `CACHE_DRIFT`, `RECONCILED`
  - Batched read queries for invoice/collection/ledger counts
- **Server action** — `getLedgerBackfillCandidates` with `ledger:view` RBAC
- **Dev page** — `/ledger/backfill` simple verification table
- **Unit tests** — 8 Vitest cases covering all discovery rules
- **ADR-032** — Enterprise Ledger Backfill Discovery

### Architecture

- Read-only boundary — no `LedgerEntry` creation, no `posting-service.ts`
- Discovery rules are pure functions in `ledger-backfill-validation.ts`
- PHASE_07E2 replay must consume this module — no duplicate classification

### Verification

- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors
- `npx vitest run` — 186 passed / 7 skipped (8 new tests)

---

## [PHASE_07D3_ENTERPRISE_DEALER_STATEMENT_DOCUMENT_PLATFORM] — 2026-07-10

### Purpose

Create printable Dealer Statements using the existing Document Platform and
`DealerStatementDTO`. Document composition only — no financial logic, posting
changes, or read-engine redesign.

### Added

- **Statement document module** (`src/components/documents/statement/`):
  - `DealerStatementPrintable` — composes DocumentLayout + platform primitives
  - `statement-mapper.ts` — DTO → printable payload (formatting only)
  - `StatementTable`, `StatementSummary`, `StatementNotes`
  - `DealerStatementDocumentPreview` — print preview modal
- **Print fetch helper** — `fetchDealerStatementForPrint()` merges paginated DTO pages
- **Print Statement button** on `/ledger` — fetch DTO → preview → `window.print()`
- **Document platform extensions** — `DocumentTable` statement variant,
  `allowPageBreak`, row accent classes; `DOC_STATEMENT_TABLE_COLS` token
- **EN/BN localization** — `document.statement.*` keys
- **Presentation tests** — 7 Vitest cases (mapper, merge, accents, summary)
- **ADR-031** — Enterprise Dealer Statement Document Platform

### Architecture

- Single pipeline: `DealerStatementDTO` → mapper → Document Platform → print
- Running balance and totals rendered verbatim — never recalculated in React
- Preview = Print = PDF via vector HTML/CSS only

### Verification

- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors
- `npx vitest run` — 178 passed / 7 skipped (7 new presentation tests)

### Next

**PHASE_07E — Reconciliation & Backfill**

---

## [PHASE_07D2_ENTERPRISE_DEALER_STATEMENT_UI] — 2026-07-09

### Purpose

Convert the PHASE_07D1 Dealer Statement read engine into a production-grade
enterprise screen at `/ledger`. Presentation only — no accounting logic,
financial mutations, posting changes, or LedgerEntry modifications.

### Added

- **Production route `/ledger`** — `enforcePermission("ledger:view")` +
  enterprise Dealer Statement workspace
- **UI components** (`src/components/ledger/`):
  - Header — dealer name/code, current balance, period, integrity badge
  - Filters — dealer combobox, date range, quick presets; future-ready
    posting type / reference type / text search
  - Summary cards — opening, debit, credit, closing, transaction count
    (DTO fields only)
  - Ledger table — Date, Posting Type, Reference No/Type, Description,
    Debit, Credit, Running Balance, Created By
  - Row accents, posting/reference badges, skeletons, empty states, alerts
- **EN/BN localization** — full `ledgerStatement.*` production key set
- **Presentation tests** — 13 Vitest cases (payload, accents, presets,
  empty/populated/pagination/dealer-switch contracts)
- **ADR-030** — Enterprise Dealer Statement UI

### Removed

- `/ledger/demo` — obsolete after production UI

### Architecture

- Single read path unchanged: `LedgerEntry` → statement service → DTO → UI
- Running balance rendered verbatim from DTO — never recomputed in React
- Future filters collected in UI but omitted from payload until backend support

### Verification

- `npx tsc --noEmit` — 0 errors
- `npx eslint` on new ledger UI files — 0 errors
- `npx vitest run` — 171 passed / 7 skipped (13 new presentation tests)

### Next

**PHASE_07E — Reconciliation & Backfill**; statement PDF/Excel composer later

---

## [PHASE_07D1_ENTERPRISE_DEALER_SUBLEDGER_FOUNDATION] — 2026-07-09

### Purpose

Build the read-only Dealer Subledger Foundation — a reusable statement engine
that every future UI, PDF, Excel, Email, and Reporting module consumes
without redesign. `LedgerEntry` is the sole authoritative source; running
balances are copied verbatim from `LedgerEntry.balance` and never
recomputed. No PDF, reports, exports, dashboards, printing, or reconciliation
jobs in this phase.

### Added

- **`src/lib/ledger/statement/`** — read engine module:
  - `getDealerStatement()` — paginated statement with opening balance for
    range, rows, totals, pagination, and ledger integrity metadata
  - `getDealerStatementSummary()` — compact totals + date bounds
  - `statement-query.ts` — Prisma read queries only (`Dealer`, `LedgerEntry`,
    `OpeningBalance`)
  - `statement-mapper.ts` — pure `LedgerEntry` → `StatementRow` projection
  - `statement-validation.ts` — dealer, date range, pagination guards
  - `statement-errors.ts` — typed error hierarchy
- **Server actions** — `getDealerStatement`, `getDealerStatementSummary`
  (`ledger:view` RBAC; Decimal → string DTO mappers)
- **Transport DTOs** — `src/types/ledger-statement.ts`
- **Zod schemas** — `src/lib/validators/ledger-statement.schema.ts`
- **Dev verification UI** — `/ledger/demo` (dealer select, date range, statement
  table — not production UI)
- **EN/BN localization** — `ledgerStatement.*` keys
- **Tests** — 13 statement service tests + 6 validation tests (in-memory stub)
- **ADR-029** — Enterprise Dealer Subledger Foundation

### Architecture

- Single read path: `LedgerEntry` → statement service → DTO → consumers
- Running balance = `LedgerEntry.balance` verbatim (never recomputed)
- Opening Balance = first `LedgerEntry` when dealer initialized (no special math)
- Ledger integrity validated via `validateDealerLedgerChain()` in statement meta
- Invoice/Collection NOT queried for amounts — ledger is authoritative

### Verification

- `npx tsc --noEmit` — 0 errors
- `npx eslint .` — 0 errors on new files
- `npx vitest run` — 158 passed / 7 skipped (19 new tests)

### Next

**PHASE_07D2 — Production Ledger UI + document platform statement composer**

---

## [PHASE_07C_ENTERPRISE_FINANCIAL_INITIALIZATION_ENGINE] — 2026-07-09

### Purpose

Build the Financial Initialization Platform, with Opening Balance as its
first workflow — a permanent, reusable ERP platform (not a one-off CRUD
feature) designed to also host future Bulk Opening Balance Import, ERP
Migration, Company Initialization, Branch Initialization, and Fiscal Year
Initialization. `PostingService` is never bypassed.

### Added

- **`OpeningBalance` model** — `dealerCode @unique` (every dealer
  initialized exactly once), `OpeningBalanceStatus` (`Draft` → `Validated` →
  `Posted` → `Locked`), `OpeningBalanceSource` (`Manual` / `CsvImport` /
  `ExcelImport` / `ErpMigration`)
- **`postOpeningBalance()`** — new function in `posting-service.ts`, the
  Financial Initialization Engine's only entry point into the posting
  boundary. Reuses `createLedgerEntry`, `lockDealerForFinancialUpdate`,
  `assertLedgerBalanceMatchesCache`, and `AuditLog` — zero new mutation
  primitives. Asserts `previousBalance = 0.00` before posting. Skips
  `LedgerEntry` creation for zero-amount opening balances (audit + status
  transition only).
- **Producer-agnostic core engine** (`src/lib/finance/initialization/`) —
  `createOpeningBalanceRecord`, `validateOpeningBalanceRecord`,
  `postOpeningBalanceRecord`, `postOpeningBalanceBatch` (shipped now,
  reserved for future bulk import — zero engine changes anticipated)
- **Orchestration layer** (`opening-balance-service.ts`,
  `initialization-status.ts`) — wraps the core in `prisma.$transaction`,
  dealer existence/uniqueness checks, DTO mapping
- **5 server actions** — `createOpeningBalanceDraft`,
  `validateOpeningBalance`, `postOpeningBalance`, `getInitializationStatus`,
  `listUninitializedDealers`
- **Enterprise 6-step wizard UI** — `/opening-balances` (dealer selection) →
  `/opening-balances/new` (Dealer Selection → Entry → Validation →
  Confirmation → Posting → Success), with resume support for in-progress
  drafts
- **RBAC** — reuses `invoices:create` (Super_Admin, Accounts);
  `permissions.ts` NOT modified
- **EN/BN localization** — full opening balance UI key set
- **Tests** — 11 new workflow unit tests, 31 new validation-guard unit
  tests, 6 new `postOpeningBalance` posting-service unit tests, 2 new
  live-database concurrency integration tests
- **ADR-028** — Enterprise Financial Initialization Engine

### Fixed

- **Concurrent posting race** — `postOpeningBalanceRecord()` checked
  `Locked` status only at function entry, before acquiring the dealer lock.
  A losing concurrent poster could observe the winner's committed non-zero
  balance after acquiring the lock and fail loudly with `INTERNAL_ERROR`
  instead of replaying idempotently. Fixed by re-checking `Locked` status
  immediately after `lockDealerForFinancialUpdate()` — same idiom as
  `issue-invoice-transaction.ts`'s post-lock idempotent challan check. Found
  and fixed via this phase's own live-database concurrency test before
  reaching production.

### Verification

- Live end-to-end smoke test against real PostgreSQL: draft → validate →
  post → idempotent replay → duplicate-initialization correctly rejected →
  dealer removed from uninitialized list
- Live concurrency integration tests: duplicate draft race (exactly one
  survives), duplicate post race (exactly one `LedgerEntry`, idempotent
  outcome on both callers)
- `npx tsc --noEmit` — 0 errors
- `npx eslint .` — 0 errors (pre-existing warnings unrelated)
- `npx vitest run` — 141 passed / 5 skipped (pre-existing, unrelated —
  logged as TECH_DEBT C8)
- `npx next build` — succeeds; `/opening-balances*` compile as dynamic routes

### Related Finding (logged, not fixed — outside scope)

- `issue-invoice-concurrency.test.ts` and
  `ledger-reconciliation.integration.test.ts` use `it.skipIf(!integrationReady)`
  where `integrationReady` is set inside an async `beforeAll` — Vitest
  evaluates the condition at describe-time, before `beforeAll` runs, so
  these tests always skip regardless of database availability. This
  phase's own integration test uses the correct runtime `ctx.skip()`
  pattern. Logged as TECH_DEBT C8; pre-existing files not modified
  (outside PHASE_07C's forbidden-files / scope boundaries).

### Next

**PHASE_07D — Dealer Subledger & Statement Engine** (ledger list/detail
routes, dealer subledger statement, document platform statement composer)

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
