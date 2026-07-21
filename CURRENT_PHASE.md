# CURRENT_PHASE.md

Current Phase:

PHASE_12B.1 — Territory Product Sales Filter Query Hotfix

Status:

PHASE_12B.1 CERTIFIED

---

# PHASE_12B.1 — Territory Product Sales Filter Query Hotfix

Status: CERTIFIED (2026-07-20)

## Objectives completed

* Fixed dynamic SQL filter aliasing: `eligible_invoice_items` predicates use `ii`/`p`/`c`, never unavailable `eii`
* Explicit `buildEligibleInvoiceItemFilters()` query-stage builder
* Regression tests for productId / categoryId / productSearch aliases
* Certification RULE_PRODUCT_SALES_16
* ADR-061 query-stage filter alias section

## Explicitly NOT Changed

* InvoiceItem source of truth
* Territory attribution / dealer ownership logic
* Dashboard analytics architecture
* RBAC architecture
* Decimal quantity handling
* posting-service, dealer-lock, ledger engines

## Prior Phase

**PHASE_12B FULLY CERTIFIED** (2026-07-20)

**PHASE_12A.1 FULLY CERTIFIED** (2026-07-20) — SR Performance Filter Stabilization & Split Print
