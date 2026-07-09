# ADR-031: Enterprise Dealer Statement Document Platform — PHASE_07D3

Date: 2026-07-10

Status: ACCEPTED

Phase: PHASE_07D3_ENTERPRISE_DEALER_STATEMENT_DOCUMENT_PLATFORM

Builds on: ADR-017, ADR-029, ADR-030

---

## Context

PHASE_07D1 (ADR-029) shipped the read-only Dealer Statement engine.
PHASE_07D2 (ADR-030) shipped the production `/ledger` UI. The ERP still
lacked printable Dealer Statements integrated with the Enterprise Document
Platform.

This ADR records **PHASE_07D3 only** — document composition from the existing
`DealerStatementDTO`. No financial logic, posting changes, or read-engine
redesign.

**Explicitly out of scope:** Excel export, email delivery, CSV, reconciliation,
backfill, schema changes, permissions matrix changes.

---

## Executive Summary

**Verdict: PRINTABLE DEALER STATEMENT SHIPPED**

Dealer Statements now compose through the shared Document Platform:
`DealerStatementDTO` → statement mapper → `DealerStatementPrintable` → preview
modal → `window.print()`. Preview = Print = PDF via vector HTML/CSS only.

---

## 1. Architectural Boundary

```
LedgerEntry
    ↓
Dealer Statement Service   (PHASE_07D1 — unchanged)
    ↓
DealerStatementDTO
    ↓
Statement Mapper           (PHASE_07D3 — formatting only)
    ↓
Document Platform          (DocumentLayout + primitives)
    ↓
Preview / Print / PDF
```

| Rule | Enforcement |
|------|-------------|
| DTO is sole input | `mapDealerStatementToDocument()` accepts `DealerStatementDTO` only |
| No Prisma in document layer | Print fetch uses `getDealerStatement()` server action |
| No balance recalculation | Running balance, totals, closing from DTO fields verbatim |
| Reuse document platform | `DocumentLayout`, `CompanyHeader`, `DocumentTable`, etc. |
| No duplicate CSS/layout | Extends `document-print.css` + `design-tokens.ts` only |

---

## 2. Module Layout

```
src/components/documents/statement/
├── dealer-statement-printable.tsx      # Composer
├── dealer-statement-document-preview.tsx
├── statement-table.tsx
├── statement-summary.tsx
├── statement-notes.tsx
├── statement-mapper.ts
├── statement-types.ts
├── dealer-statement-document.test.ts
└── index.ts

src/lib/documents/
└── fetch-dealer-statement-for-print.ts # Paginated fetch merge for print
```

Print is triggered from `/ledger` via **Print Statement** — fetches full DTO
(pages merged client-side), opens preview, user prints.

---

## 3. Document Composition

| Region | Source |
|--------|--------|
| Header | `CompanyHeader`, `DocumentTitle` |
| Metadata | Dealer name/code, period, print date, current balance, integrity |
| Table | Date, Posting Type, Reference No, Description, Debit, Credit, Running Balance |
| Summary | `openingBalanceForRange`, `totals.*`, `meta.currentBalance`, `totals.entryCount` |
| Notes | Ledger integrity status |
| Signature / Footer | Shared platform components |

Row accents (Opening = blue, Collection = green, Reversal = amber) are
presentation-only CSS classes on print rows.

---

## 4. Print Pipeline

1. User clicks **Print Statement** on `/ledger`
2. `fetchDealerStatementForPrint()` calls `getDealerStatement()` with
   `pageSize = 200`, merges all pages
3. `DealerStatementDocumentPreview` renders `DealerStatementPrintable`
4. User clicks Print → `window.print()` (Save as PDF in browser)

No html2canvas, screenshots, or rasterization. Long statements paginate
naturally across A4 pages (`allowPageBreak` on statement table).

---

## 5. Platform Extensions (Minimal)

| Primitive | Change |
|-----------|--------|
| `DocumentTable` | Optional `variant="statement"`, `getRowClassName`, `allowPageBreak` |
| `design-tokens.ts` | `DOC_STATEMENT_TABLE_COLS` |
| `document-print.css` | Statement table columns + row accent classes |

No forked layout components. No `DealerStatementPrintableV2`, `LedgerTemplate`,
or duplicate CSS files.

---

## 6. Closing Balance Semantics

Same as ADR-030: closing balance displays `meta.currentBalance` (Tier-3 AR
cache asserted equal to ledger on every post). Opening for range =
`openingBalanceForRange`. Per-row truth = `runningBalance` verbatim.

---

## 7. Testing Strategy

Vitest presentation tests (`dealer-statement-document.test.ts`):

- Statement with / without opening balance
- Summary field sourcing from DTO
- Row accent mapping for print
- Empty statement
- Long statement page merge (`mergeDealerStatementPages`)
- Large transaction history (600 rows)

PH [`DocumentTable`](../../src/components/documents/sections/document-table.tsx) extension is covered indirectly via mapper tests; PHASE_07D1 engine tests remain financial truth suite.

---

## 8. Future Extension Points

| Extension | Hook |
|-----------|------|
| Excel / email export | Same `DealerStatementDTO` + toolbar action |
| Dedicated print route | `/ledger/print?dealerCode=…` embeds same `DealerStatementPrintable` |
| Filter-aware print | Extend print fetch payload when read engine accepts filters |
| Closing-for-range field | Add to statement service + swap summary field |

---

## 9. Verification Evidence

- Document platform reused — no duplicate composers or CSS forks
- DTO consumed directly — no Prisma, no money math in React
- Running balance untouched in table render
- Multi-page print via natural table pagination
- Preview = Print = PDF single pipeline
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 errors
- `npx vitest run` — all tests pass

---

## 10. Decision

**APPROVED.** PHASE_07D3 printable Dealer Statement document platform is
complete. **PHASE_07E (Reconciliation & Backfill)** is the next financial
engineering priority.
