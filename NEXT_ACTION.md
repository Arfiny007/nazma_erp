# NEXT ACTION

## Current State

PHASE_07A_ENTERPRISE_LEDGER_FOUNDATION is **complete** (2026-07-09):

- `LedgerEntry` model hardened — `referenceType` enum, `postingType`,
  `postingDate`, `postingKey @unique`, `referenceNo`, `reversesEntryId`,
  `createdById`, composite indexes
- `LedgerPostingType` enum introduced; `FinancialReferenceType` extended
  with `Collection`
- `src/lib/ledger/` foundation module: posting-key builder, immutable
  posting contracts, `createLedgerEntry` (idempotent, balance-asserting,
  append-only), reconciliation helpers, opening-balance builders
- `posting-service.ts` inputs extended with optional ledger metadata
  (bodies unchanged — PHASE_07B consumes)
- 35 new unit tests; 64 total pass, 4 skipped (pre-existing DB integration
  tests)
- Prisma migration `20260709000000_phase_07a_ledger_foundation/migration.sql`
  authored (apply via `npx prisma migrate deploy`)
- ADR-025 authored; governance docs updated

Financial architecture (ADR-024) is unchanged. Foundation is production-ready
for PHASE_07B wiring.

PHASE_06D.2_ENTERPRISE_DOCUMENT_PLATFORM_DESIGN_FREEZE remains complete:

- Enterprise Document Platform has reached **Production Design Freeze** status
- Design tokens (`src/lib/documents/design-tokens.ts`) introduced — single source of truth for all document visual constants
- CompanyHeader: 32pt font-black company name, vertical rule separator, professional T/E/W address block
- DocumentTitle: 17pt font-black, 0.12em letter-spacing, stronger visual weight
- InvoiceMetadata: single "Dealer Information" section (B2B ERP — no redundant Ship To)
- Product table: col-name expanded to 42%; tabular-nums on numeric columns
- Financial summary: visual divider groups Invoice Amount vs Due Summary
- Single "Authorized By" signature block replaces three-signature layout
- Professional "Terms & Conditions" notes replace consumer-oriented text
- PaymentTerms section removed from invoice print
- Enterprise footer: blue top bar + "Confidential — For addressee only" + thank-you message
- Preview = Print = PDF preserved via single pipeline
- Money Receipt pipeline unaffected (DocumentFinancialSummary changes backward-compatible)
- No financial, posting, or workflow changes

PHASE_06D.1 invoice layout revision remains valid.
PHASE_06D financial architecture certification remains valid (8.7 / 10).

**Not yet built:** Ledger posting, opening balance, credit notes, dealer statements, due reports.

---

## Next Steps

Roadmap after PHASE_07A:

### 1. Apply the PHASE_07A Migration

Before starting PHASE_07B, apply the schema hardening in every environment:

```
npx prisma migrate deploy
npx prisma generate
```

The migration is additive for the `LedgerEntry` table (no historical rows
exist yet) and additive for the `FinancialReferenceType` enum. Zero
downtime.

### 2. PHASE_07B — Ledger Posting Integration

- Wire `createLedgerEntry` inside `postReceivableIncrease`,
  `postReceivableDecrease`, `postReceivableDecreaseReversal`
- Compute `previousBalance` from last `LedgerEntry` (or `Dealer.currentBalance`
  during migration)
- Assert `LedgerEntry.balance === Dealer.currentBalance` via
  `assertLedgerBalanceMatchesCache`
- Concurrency integration tests mirroring PHASE_05C2A
- Semantic correction: `postReceivableDecrease` referenceType →
  `Collection` (ADR-024 §10 low-priority item)

### 3. PHASE_07C — Opening Balance

- `openDealerBalance()` server action + Zod validator
- `postOpeningBalance()` in `posting-service.ts` (uses
  `buildOpeningBalancePosting` from `@/lib/ledger`)
- `FinancialReferenceType.OpeningBalance` handler in allocation engine
- Migration path for existing dealers with non-zero `currentBalance`

### 4. PHASE_07D — Ledger UI

- Ledger list / detail routes
- Dealer subledger statement (hybrid: ledger balance + document lines)
- Document platform statement composer
- Print / PDF via existing document pipeline

### 5. PHASE_07E — Reconciliation & Backfill

- Backfill script: replay invoices + collections → ledger entries for
  existing data
- Reconciliation job using `reconcileDealerLedger` /
  `replayDealerLedgerBalance` / `assertDealerLedgerReconciled`
- Optional scheduled integrity check

### 4. Reporting

- Due reports and aging (PHASE_08)
- Cash book, collection register
- Territory / area analytics
- Sales reports from `InvoiceItem` snapshots

### 5. Analytics

- Management dashboard KPIs
- Dealer analytics (`totalSales`, targets)
- Fulfillment rate reporting

### 6. Final Production Hardening

- Balance reconciliation job (`currentBalance` vs ledger vs document replay)
- Collection concurrency integration tests
- Composite database indexes for reporting
- Deployment checklist (credential rotation, migration pipeline)
- Optional: credit note / invoice void workflow

### Explicitly Out of Scope (until respective phase)

- Chart of Accounts / full GL (Trial Balance, P&L, Balance Sheet) — PHASE_07F+
- Email/SMS document delivery

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |
| Accounts | (seed if needed) | — |

---

## Notes

- `Dealer.currentBalance` = AR cache (positive: dealer owes; negative: advance/credit) — reconcile to ledger in PHASE_07E
- All balance mutations must continue through `posting-service.ts` only
- Collection allocation does not post balance — cash posted on confirm only (by design)
- Delivery Challan remains NON-FINANCIAL
