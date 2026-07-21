# NEXT ACTION

## Current State

**PHASE_12B.2 CERTIFIED** (2026-07-21)

- Print document for Territory Product Sales via Document Platform
- Shared report DTO: screen totals == print totals
- Certification: RULE_PRODUCT_SALES_01–17, `phase12bApproved: true`, version `12B.2.0`
- Route: `/reports/product-sales-by-territory/print?mode=report`

---

## Next Steps

### 1. Git commit for PHASE_12B + 12B.1 + 12B.2

- Commit territory product sales module + filter hotfix + print document + ADR-061 + governance
- Do not include `.env`, secrets, or `tmp-cert-*` evidence scratch files

### 2. Follow-on candidates

- Dashboard / report Excel exports (product sales + SR performance)
- Production SMTP + notification worker scheduling
- Client demo dry-run across core modules

### Explicitly Out of Scope (until respective phase)

- Product revenue / margin / COGS analytics
- Returns / credit notes
- Inventory stock ledger
- SMS / Twilio / push notification center

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |
| Manager | manager1@nazma.test | Demo123! |
| SR | sr1@nazma.test | Demo123! |
| Accounts | accounts1@nazma.test | Demo123! |

---

## Notes

* Sold quantity = `SUM(InvoiceItem.quantity)` only — never order or challan quantities
* Sale date = `Invoice.issueDate`
* Territory from ownership history as-of issue date; fallback diagnostics when missing
* Print is a presentation extension only — never separate SQL/aggregation/RBAC
