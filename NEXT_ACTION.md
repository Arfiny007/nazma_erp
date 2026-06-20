# NEXT ACTION

## Current State

PHASE_03C_PRODUCT_FORMS is COMPLETE.

Product management module is fully functional:
- Create Product at /products/new (enforces products:create)
- Edit Product at /products/[id]/edit (enforces products:edit)
- Deactivate Product via confirmation dialog (soft-delete, isActive = false)
- Role-aware New Product button and Edit links
- Three-layer RBAC: middleware → enforcePermission → requirePermission
- Full EN + BN localization
- All server actions protected with requirePermission guards

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
