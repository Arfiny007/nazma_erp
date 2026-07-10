# ADR-040: Enterprise Due Report Engine

**Status:** Accepted  
**Date:** 2026-07-11  
**Phase:** PHASE_08D

## Context

PHASE_08A–08C delivered geography hierarchy, territory RBAC, and dealer ownership history. The financial pipeline (posting, ledger, statement, reconciliation, certification) is certified at 9.3/10 (ADR-037).

Enterprise operations require due visibility:

- Which dealers owe money?
- Which territories have the highest due?
- Which SRs are underperforming in collections?
- How much money is overdue?

A second balance engine must not be introduced.

## Decision

### Read-only Due Report module: `src/lib/reports/due/`

| Function | Purpose |
|----------|---------|
| `getDueReport()` | Paginated dealer due list |
| `getDealerDueReport()` | Single dealer row |
| `getTerritoryDueReport()` | Division / district / territory aggregation |
| `getSrDueReport()` | SR aggregation via active ownership |
| `getCompanyDueSummary()` | Company-wide totals + aging |
| `getDueAgingReport()` | Invoice aging buckets |

### Financial source of truth

```
LedgerEntry → Dealer.currentBalance → Due Reports
```

- Dealer-level due/advance: `Dealer.currentBalance` read verbatim (positive = due, negative = advance).
- Aging buckets: invoice outstanding (`grandTotal − collectionReceived`) classified by `dueDate` days overdue.
- Aging does NOT recompute dealer balances.
- `DueReport` Prisma model remains unused — reserved for future scheduled snapshots.

### Territory RBAC

All queries merge `buildTerritoryScope()` via `mergeDealerTerritoryScope()`. Server actions require `reports:view`.

### Ownership attribution

- Current SR/territory display: active `DealerOwnershipHistory` row.
- Historical invoice aging by SR: read-only join on ownership effective at `invoice.issueDate`.
- Invoices and collections are never modified.

### Integrity badge

List views use batch cache-parity check (last `LedgerEntry.balance` vs `Dealer.currentBalance`). Single-dealer reads use full `reconcileDealerLedger`.

### UI

Dev/production page at `/reports/due` — summary cards, filters, dealer table, territory/SR tables. No charts, PDF, or Excel.

## Non-goals (PHASE_08D)

Dashboards, analytics, BI, exports, dealer profile analytics, targets, `DueReport` snapshot population.

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| LedgerEntry writes | No |
| Statement engine | No |
| Reconciliation engine | No |
| Integrity monitor | No |
| Financial certification | No |
| Audit engine | No |

## Consequences

- Due reports are always consistent with ledger-certified balances.
- Invoice aging may not equal dealer balance when opening balances or unallocated collections exist — by design.
- Future PHASE_08E+ may add exports and scheduled `DueReport` snapshots without redesigning this read engine.
