# NEXT ACTION

## Current State

PHASE_06D.2_ENTERPRISE_DOCUMENT_PLATFORM_DESIGN_FREEZE is **complete**:

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

Roadmap after PHASE_06D.1:

### 1. PHASE_07A — Ledger Schema Hardening

Prepare immutable ledger architecture:

- Extend `LedgerEntry`: `postingKey`, `referenceNo`, `postingType`, `postingDate`, `reversesEntryId`, `createdById`
- Align `referenceType` to `FinancialReferenceType` enum
- Add `@@unique([postingKey])` for idempotency
- Opening balance document type preparation
- Reference abstraction alignment with `CollectionAllocation`
- Journal architecture design (append-only, compensating reversals)
- Prisma migration only — no posting logic yet

### 2. PHASE_07B — Ledger Engine

- `createLedgerEntry()` inside `posting-service.ts`
- Wire into `postReceivableIncrease`, `postReceivableDecrease`, `postReceivableDecreaseReversal`
- Running balance per dealer; assert `LedgerEntry.balance === Dealer.currentBalance`
- Integration tests

### 3. PHASE_07C — Ledger UI

- Ledger list / detail routes
- Dealer subledger statement (hybrid: ledger balance + document lines)
- Document platform statement composer
- Print / PDF via existing document pipeline

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
