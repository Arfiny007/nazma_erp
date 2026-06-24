# NEXT ACTION

## Current State

PHASE_05A2_DELIVERY_CHALLAN_ACTIONS is **complete**:

- Six server actions: create / update / confirm / cancel / get / list
- `CHL-NNNNNN` challan number generator
- Workflow aligned to ADR-012 (split `remainingQty` vs `allocatableQty`, confirmed-only order lock)
- Order status sync: `Approved → Partially_Delivered → Delivered`
- Order integration: fulfillment on `getOrder`, line lock on `updateOrder`, dispatch block on `cancelOrder`
- Audit events in `AuditLog`
- `OrderStatus.Partially_Delivered` enum + migration
- `npm test` — 9 workflow tests pass
- `npx tsc --noEmit` / `npx eslint` — pass

**Not yet built:** Delivery Challan UI, Invoice Engine, Collections, Ledger, Due.

---

## Next Phase: PHASE_05B — Delivery Challan UI

### Objective

Build the Delivery Challan UI on top of the existing backend.

### Implementation Goals

1. Create challan from approved order (line picker with allocatable qty)
2. Challan list with search / filters / pagination
3. Challan detail + confirm / cancel actions
4. Fulfillment progress on order detail
5. EN + BN localization for all challan strings

### Out of Scope

- Invoice creation (PHASE_05C)
- Invoice UI / PDF (PHASE_05D)
- Collections, Ledger, Due Reports

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |

---

## Notes

- Delivery Challan is NON-FINANCIAL — no balance / ledger / due side effects
- Apply migration `20250625110000_add_partially_delivered_status` before using Partially_Delivered status
- Never expose raw Prisma errors to the client (use typed `ActionResult` envelope)
