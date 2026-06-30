# NEXT ACTION

## Current State

PHASE_06D_FINANCIAL_ARCHITECTURE_CERTIFICATION is **complete**:

- Full financial pipeline certified (Order → Challan → Invoice → Collection → Posting)
- Source of truth: `LedgerEntry` (future authoritative) + documents + `Dealer.currentBalance` (cache)
- Financial Posting Service mandated for all future financial operations
- Ledger architecture designed — extend existing `posting-service.ts`, no refactor
- Dealer statement: hybrid (ledger running balance + document line detail)
- Generic allocation certified — no redesign required for future reference types
- Advance payment / negative AR certified
- Overall ERP readiness: **8.7 / 10**
- ADR-024 created

**Not yet built:** Ledger posting, opening balance, credit notes, dealer statements, due reports.

---

## Next Steps

Roadmap after PHASE_06D (Financial Architecture Certification):

### 1. Invoice PDF Patch Upgrade

Use client feedback to refine printable invoice layout:

- Typography (title, body, table row sizes)
- Spacing and margins (A4 padding, section gaps)
- Visual polish (enterprise blue bars, alignment, density)
- **Document platform only** — compose existing `Document*` primitives
- **No duplicated templates** — single `InvoicePrintable` pipeline
- **No business logic changes**

See `CLIENT_FEEDBACK_LOG.md` entry #34.

### 2. PHASE_07A — Ledger Schema Hardening

Prepare immutable ledger architecture:

- Extend `LedgerEntry`: `postingKey`, `referenceNo`, `postingType`, `postingDate`, `reversesEntryId`, `createdById`
- Align `referenceType` to `FinancialReferenceType` enum
- Add `@@unique([postingKey])` for idempotency
- Opening balance document type preparation
- Reference abstraction alignment with `CollectionAllocation`
- Journal architecture design (append-only, compensating reversals)
- Prisma migration only — no posting logic yet

### 3. PHASE_07B — Ledger Engine

- `createLedgerEntry()` inside `posting-service.ts`
- Wire into `postReceivableIncrease`, `postReceivableDecrease`, `postReceivableDecreaseReversal`
- Running balance per dealer; assert `LedgerEntry.balance === Dealer.currentBalance`
- Integration tests

### 4. PHASE_07C — Ledger UI

- Ledger list / detail routes
- Dealer subledger statement (hybrid: ledger balance + document lines)
- Document platform statement composer
- Print / PDF via existing document pipeline

### 5. Reporting

- Due reports and aging (PHASE_08)
- Cash book, collection register
- Territory / area analytics
- Sales reports from `InvoiceItem` snapshots

### 6. Analytics

- Management dashboard KPIs
- Dealer analytics (`totalSales`, targets)
- Fulfillment rate reporting

### 7. Final Production Hardening

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
