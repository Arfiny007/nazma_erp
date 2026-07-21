# NEXT ACTION

## Current State

**PHASE_12B.1 CERTIFIED** (2026-07-20)

- Hotfix: dynamic report filters use `ii`/`p`/`c` inside `eligible_invoice_items` (never `eii`)
- Certification: RULE_PRODUCT_SALES_01–16, `phase12bApproved: true`, version `12B.1.1`
- Gates: Prisma / tsc / eslint / vitest 654+7 / build / docker — all exit 0
- Runtime SQL product/category/search OK; browser smoke 34/34 including product filter
- `RUNNING_IMAGE_MATCH=true` (`sha256:7c717dc55cb3…`)

---

## Next Steps

### 1. Git commit for PHASE_12B + PHASE_12B.1

- Commit territory product sales module + filter alias hotfix + ADR-061 + governance
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
* Dynamic filters are query-stage-aware (`buildEligibleInvoiceItemFilters`)
