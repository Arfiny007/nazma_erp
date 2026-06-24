# NEXT ACTION

## Current State

PHASE_05A_DELIVERY_CHALLAN_BACKEND **foundation** is delivered:

- DTOs, error codes, and action result types (`src/types/delivery-challan.ts`)
- Zod validation contracts (`src/lib/validators/delivery-challan.schema.ts`)
- Workflow + quantity guards (`src/lib/delivery/workflow.ts`)
- Schema design documented in ADR-012 (not migrated)
- ADR-012 created

**Not yet built:** server actions, Prisma models, migrations, order-workflow
integration in `updateOrder`, challan number generator, unit tests.

**ADR-012 amended (architecture review 2026-06-25):**
- Split `remainingQty` (display, confirmed only) vs `allocatableQty` (validation, includes draft reservation)
- Order immutability triggers on **Confirmed** challans only — Draft is abandonable
- Fulfillment Progress DTO structure (§10) and Invoice eligibility workflow (§11) documented
- `workflow.ts` / types must align to amended ADR at implementation time

---

## Outstanding

- **Migration NOT yet run.** Deferred schema changes (apply together when DB available):
  1. `OrderStatus` enum gained `Cancelled` (PHASE_04A).
  2. `Invoice.orderId` `@unique` removal + `@@index([orderId])` (PHASE_00C).
  3. `DeliveryChallan` + `DeliveryChallanItem` + `DeliveryChallanStatus` (PHASE_05A — ADR-012).
  4. `Invoice.deliveryChallanId` + `InvoiceItem` + logistics field relocation (PHASE_05C prep).

  Run migrations once a database is available.

---

## Next Sub-Phase: PHASE_05A (continued) — Server Actions + Schema Migration

### Objective

Complete PHASE_05A by applying the ADR-012 schema, wiring server actions, and
integrating challan-aware guards into the order module.

### Implementation Goals

1. **Schema migration** — apply ADR-012 models to `prisma/schema.prisma`; run migrate.
2. **Challan number generator** — `CHL-NNNNNN` sequential codes (`src/lib/utils/challan-number.ts`).
3. **Server actions** — `createChallan`, `confirmChallan`, `getChallan`, `listChallans`,
   `listChallansForOrder`; all RBAC-guarded, transaction-safe.
4. **Order integration** — call `assertOrderLinesMutable(confirmedChallanCount)` in
   `updateOrder`; extend `assertCanCancel` to block confirmed challans; populate
   `OrderFulfillmentProgressDTO` in `getOrder` per ADR-012 §10.
5. **Align workflow** — split `computeRemainingQuantity` (display) from
   `computeAllocatableQuantity` (validation); immutability keyed on confirmed count.
6. **Audit** — challan CREATE / CONFIRM events in `AuditLog` inside transactions.
7. **Unit tests** — workflow guards + over-delivery scenarios.

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
