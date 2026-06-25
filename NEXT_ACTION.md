# NEXT ACTION

## Current State

PHASE_05B_DELIVERY_CHALLAN_UI is **complete**:

- Routes: `/delivery-challans`, `/new`, `/[id]`, `/[id]/edit`
- List with search / filters / pagination / sorting
- Create from Approved / Partially_Delivered orders with allocatable qty caps
- Detail with fulfillment visualization, audit timeline, confirm/cancel
- Edit Draft-only; Confirmed read-only
- RBAC reuses `orders:view` / `orders:create` / `orders:edit`
- EN + BN `challan.*` localization
- ADR-013 created

**Not yet built:** Invoice Engine, Invoice UI, Collections, Ledger, Due.

### Hotfix applied (2026-06-25)

Migration `20250625110000_add_partially_delivered_status` deployed to Docker PostgreSQL. `OrderStatus.Partially_Delivered` now exists in DB; Delivery Challan eligible-order queries work. Sidebar links `/reports` and `/ledger` 404 because those modules are not implemented yet (PHASE_07 / PHASE_08) — not Delivery Challan defects.

---

## Next Phase: PHASE_05C — Invoice Engine

### Objective

Generate invoices from **Confirmed** delivery challans with mandatory `InvoiceItem` rows.

### Implementation Goals

1. `createInvoice` from confirmed challan (one challan → one invoice)
2. InvoiceItem lines sourced from challan quantities; unit prices from order lines
3. Credit-limit check at invoice issue
4. Ledger / balance / due side effects (financial boundary per ADR-011)

### Out of Scope

- Invoice UI / PDF (PHASE_05D)
- Collections, Due Reports

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |

---

## Notes

- Delivery Challan is NON-FINANCIAL — no balance / ledger / due side effects
- Confirmed challans with `hasInvoice: false` are invoice-eligible (PHASE_05C)
- Never expose raw Prisma errors to the client (use typed `ActionResult` envelope)
