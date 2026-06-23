# NEXT ACTION

## Current State

PHASE_00C_INVOICE_RELATION_CORRECTION is COMPLETE.

The `Invoice` ↔ `SalesOrder` relationship is now one-to-many:
- `Invoice.orderId` — `@unique` removed (column + relation preserved)
- `Invoice` — `@@index([orderId])` added
- `SalesOrder.invoices Invoice[]` — one-to-many back-relation
- `Collection`, `LedgerEntry`, `DueReport`, `Dealer`, `Product`, `Project` untouched
- ADR-007 documents the One Order → Many Invoices decision
- Verified with `npx prisma format` + `npx prisma generate`
- **Migration NOT yet run** — must be applied before Invoice engine work

PHASE_03C_PRODUCT_FORMS (prior) is COMPLETE — product management module fully functional.

---

## Outstanding

- A migration for the relation change has been intentionally deferred. Run
  `npx prisma migrate dev` (with a descriptive name) before building the Invoice engine.

---

## Next Phase: PHASE_04_SALES_ORDERS

### Objective

Build the Sales Order module following the established module pattern.

### Prerequisites

- Product Management is complete ✅
- Dealer Management is complete ✅
- RBAC infrastructure is in place ✅

### Tasks

1. Design and validate Sales Order schema (already scaffolded in PHASE_00B)
2. Create order domain types and validators
3. Create server actions: createOrder, updateOrder, listOrders, getOrder
4. Build Order list UI with table, search, pagination
5. Build Order create form (select dealer, add product lines, pricing)
6. Implement order approval workflow (Manager role)
7. RBAC: SR can create, Manager can approve, all can view

### Guard Usage Pattern

```typescript
// In Server Component pages (page.tsx)
import { enforcePermission } from "@/lib/rbac/guards";
await enforcePermission("orders:create");

// In Server Actions
import { requirePermission } from "@/lib/rbac/guards";
const user = await requirePermission("orders:create");

// In Client Components (conditional rendering)
import { hasPermission } from "@/lib/permissions";
const canApprove = hasPermission(userRole, "orders:approve");
```

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |

---

## Notes

- Do NOT begin Invoices, Collections, Ledger, or Due Reports
- All new server actions MUST call `requirePermission()` at the top
- All new protected pages MUST call `enforcePermission()` at the top
- Never expose raw Prisma errors to the client
- Never use `any` type
- Never hardcode role checks — use helpers from src/lib/rbac/
- Follow hybrid Server Component + Client Component page pattern established in PHASE_03C
