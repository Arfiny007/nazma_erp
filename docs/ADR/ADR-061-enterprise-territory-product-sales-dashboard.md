# ADR-061 — Enterprise Territory-wise Product Sales Report & Dashboard Analytics

**Status:** Accepted  
**Date:** 2026-07-20  
**Phase:** PHASE_12B — Territory-wise Product Sales Report & Dashboard Analytics

## Context

Operations need to know which products sold, in what quantity, in which
territory, over a selected date range — without redesigning certified
financial, territory, dashboard, or document engines.

## Decision

### Definition of sold quantity

```text
Sold Quantity = SUM(InvoiceItem.quantity)
```

for eligible issued financial invoices only.

Source of truth is the immutable `InvoiceItem` snapshot (`productCode`,
`productName`, `unit`, `quantity`). Sales Order and Delivery Challan
quantities are never used.

### Invoice eligibility

Include invoices whose `status` is in:

`Issued | Paid | Partial | Overdue`

(same set as dashboard / ledger operational sales aggregates).

Exclude `Draft`. There is no Cancelled/Void invoice status in schema.

Sale date field: `Invoice.issueDate` (not `issuedAt`).

Date window:

```text
issueDate >= startOfDay(from)
issueDate <  startOfDay(to + 1 day)
```

Parsed via `parseLocalDateOnly` — never timezone-shifting
`new Date("YYYY-MM-Day")`.

### Historical territory attribution

`Invoice` has **no** territory snapshot. Attribution precedence:

1. `DealerOwnershipHistory` effective at `issueDate`:
   `effectiveFrom <= issueDate` AND (`effectiveTo IS NULL` OR `effectiveTo > issueDate`)
2. Deterministic pick: `ORDER BY effectiveFrom DESC, id DESC`, keep rank 1
3. Fallback: current `Dealer.territoryId` with diagnostics
4. Exclude when neither history nor current territory exists

Join path: `Invoice.dealerCode` → `Dealer` → `DealerOwnershipHistory.dealerId`.

Each `InvoiceItem` is attributed exactly once (window rank = 1) or excluded.

Diagnostics DTO:

```ts
{
  missingHistoricalTerritoryCount,
  ambiguousHistoricalOwnershipCount,
  currentTerritoryFallbackCount,
  excludedRecordCount
}
```

### Territory RBAC

Permission: `reports:territory-product-sales:view`

| Role | Access |
|------|--------|
| Super_Admin | Allowed — all territories |
| Manager | Allowed — assigned territories |
| SR | Allowed — assigned territories (certified Territory RBAC) |
| Accounts | Denied |

Scope via `buildTerritoryScope` + server predicates. SR visibility follows
territory assignment (same as due/dashboard), not a separate ownership-only
narrowing for this aggregate report. Foreign `territoryId` is rejected.

### Decimal quantity handling

All aggregation uses `Prisma.Decimal`. DTOs transport `toFixed(2)` strings.
Dashboard chart converts via `decimalToChartValue` only at the visual
boundary; `valueLabel` preserves the exact string for tooltips.

### Query strategy

Parameterized `prisma.$queryRaw` + `Prisma.sql` CTE:

1. Eligible invoice items
2. Historical ownership interval join
3. Rank-1 attribution
4. Group by territory + product

Companion distinct invoice/dealer count query. No `$queryRawUnsafe`,
`$executeRaw`, or ADR-059 unsafe `groupBy` + `_count.id`.

### Query-stage filter aliases (PHASE_12B.1)

Dynamic product/category/search predicates are applied inside
`eligible_invoice_items` and must use that CTE’s aliases only:

| Stage | Allowed aliases | Example |
|-------|-----------------|---------|
| `eligible_invoice_items` | `ii`, `i`, `d`, `p`, `c` | `ii."productId"` |
| `historical_attribution` | `eii` | `eii."dealerId"` |
| `attributed` | `ha` | `ha."resolvedTerritoryId"` |

`buildEligibleInvoiceItemFilters()` is the eligible-stage builder. It must
never emit `eii.*` — that alias does not exist until the next CTE.
Certification RULE_PRODUCT_SALES_16 enforces this.

### Dashboard integration

Additive chart on certified Dashboard Analytics:

- id: `topProductsByQuantity`
- Top 10 by sold quantity for current month + authenticated scope
- Horizontal SVG bar chart
- Link: View territory breakdown → report with current filters

Shared service: `getTopSellingProductsByTerritory`.

### Explicit non-goals

Revenue/margin/COGS, returns/credit notes, inventory, forecasting, Excel/PDF
export, new chart libraries, territory/ownership/financial engine redesigns.

## Consequences

- Route `/reports/product-sales-by-territory` under Reports nav
- Certification: `runTerritoryProductSalesCertification()` RULE_PRODUCT_SALES_01–16
- Frozen financial engines remain untouched
- PHASE_12B.1 hotfix: query-stage-aware dynamic filter aliases
