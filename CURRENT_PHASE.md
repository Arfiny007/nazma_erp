# CURRENT_PHASE.md

Current Phase:

PHASE_12B.2 — Territory Product Sales Print Document

Status:

PHASE_12B.2 CERTIFIED

---

# PHASE_12B.2 — Territory Product Sales Print Document

Status: CERTIFIED (2026-07-21)

## Objectives completed

* Print route `/reports/product-sales-by-territory/print?mode=report`
* Document Platform components under `src/components/documents/product-sales-territory/`
* Print consumes certified `getTerritoryProductSalesReport` (same filters, totals, RBAC)
* Permission reuse: `reports:territory-product-sales:view` (no second print permission)
* Certification RULE_PRODUCT_SALES_17
* ADR-061 print document section

## Explicitly NOT Changed

* Product Sales query architecture / InvoiceItem aggregation
* Territory attribution / dealer ownership logic
* Dashboard analytics architecture
* Territory RBAC architecture
* Financial engines (posting-service, dealer-lock, ledger)

## Prior Phase

**PHASE_12B.1 CERTIFIED** (2026-07-20) — Territory Product Sales Filter Query Hotfix

**PHASE_12B FULLY CERTIFIED** (2026-07-20)

**PHASE_12A.1 FULLY CERTIFIED** (2026-07-20) — SR Performance Filter Stabilization & Split Print
