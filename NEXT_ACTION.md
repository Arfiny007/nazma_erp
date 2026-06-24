# NEXT ACTION

## Current State

PHASE_05A1_DELIVERY_CHALLAN_SCHEMA is **complete**:

- `DeliveryChallanStatus` enum, `DeliveryChallan`, `DeliveryChallanItem` models in Prisma
- `SalesOrder.deliveryChallans` relation added
- `Invoice.deliveryChallanId` nullable FK prepared (one challan → one invoice)
- Deferred migrations applied: `OrderStatus.Cancelled`, `Invoice.orderId` index (non-unique)
- Migration `20250625100000_add_delivery_challan` applied to Docker Postgres
- `npx prisma format`, `npx prisma generate`, `npx tsc --noEmit` — all pass

PHASE_05A foundation (DTOs, validators, workflow guards, ADR-012) was delivered earlier.

**Not yet built:** server actions, challan number generator, order-workflow integration,
`workflow.ts` alignment to amended ADR, unit tests.

---

## Outstanding

- **Server actions** — `createChallan`, `confirmChallan`, `getChallan`, `listChallans`, `listChallansForOrder`
- **Challan number generator** — `CHL-NNNNNN` (`src/lib/utils/challan-number.ts`)
- **Order integration** — `assertOrderLinesMutable` in `updateOrder`; fulfillment progress in `getOrder`
- **Workflow alignment** — split `remainingQty` vs `allocatableQty` per ADR-012 amendment
- **InvoiceItem model** — PHASE_05C (not this phase)
- **Logistics field removal from Invoice** — PHASE_05C data migration

---

## Next Sub-Phase: PHASE_05A2 — Server Actions + Order Integration

### Objective

Complete the Delivery Challan backend by wiring server actions and integrating
challan-aware guards into the order module.

### Implementation Goals

1. **Challan number generator** — `CHL-NNNNNN` sequential codes (`src/lib/utils/challan-number.ts`).
2. **Server actions** — `createChallan`, `confirmChallan`, `getChallan`, `listChallans`,
   `listChallansForOrder`; all RBAC-guarded, transaction-safe.
3. **Order integration** — call `assertOrderLinesMutable(confirmedChallanCount)` in
   `updateOrder`; extend `assertCanCancel` to block confirmed challans; populate
   `OrderFulfillmentProgressDTO` in `getOrder` per ADR-012 §10.
4. **Align workflow** — split `computeRemainingQuantity` (display) from
   `computeAllocatableQuantity` (validation); immutability keyed on confirmed count.
5. **Audit** — challan CREATE / CONFIRM events in `AuditLog` inside transactions.
6. **Unit tests** — workflow guards + over-delivery scenarios.

### Then: PHASE_05B_DELIVERY_CHALLAN_UI

Create challan from approved order, list, detail, dispatch workflow.

### Out of Scope

- Invoice creation (PHASE_05C)
- Invoice UI / PDF (PHASE_05D)
- Collections, Ledger, Due Reports

### Guard Usage Pattern

```typescript
// In Server Component pages (page.tsx)
import { enforcePermission } from "@/lib/rbac/guards";
await enforcePermission("orders:view");

// In Server Actions
import { requirePermission } from "@/lib/rbac/guards";
const user = await requirePermission("orders:create");

// Workflow guards (delivery module)
import {
  assertCanCreateChallan,
  assertNotOverDelivery,
  assertCanConfirmChallan,
} from "@/lib/delivery/workflow";
```

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |

---

## Notes

- Delivery Challan is NON-FINANCIAL — no balance / ledger / due side effects
- Never expose raw Prisma errors to the client (use typed `ActionResult` envelope)
- Never use `any` type
- Money/quantity at API boundary: fixed-precision decimal strings only
