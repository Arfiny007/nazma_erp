# NEXT ACTION

## Current State

PHASE_AUTH_02_RBAC is COMPLETE.

RBAC infrastructure is fully in place:
- Centralized permission matrix in src/lib/permissions.ts
- RBAC helpers (canView, canCreate, canEdit, canDelete, canApprove) in src/lib/rbac/index.ts
- Server action guards (requirePermission, ForbiddenError) in src/lib/rbac/guards.ts
- Server component guards (enforcePermission, enforceAuth) in src/lib/rbac/guards.ts
- Middleware enforces 11 route prefixes with permission-based redirects
- 403 Access Denied page at /access-denied (bilingual, responsive)
- Dashboard layout reads real session and passes userRole to sidebar
- Sidebar and MobileNav filter navigation by actual user role

---

## Next Phase: PHASE_03C_PRODUCT_FORMS

### Objective

Build Product create/edit forms following the established Dealer Forms pattern.

### Tasks

1. Create `src/app/(dashboard)/products/new/page.tsx` — new product form
2. Create `src/app/(dashboard)/products/[sku]/edit/page.tsx` — edit product form
3. Reuse `src/components/dealers/dealer-form.tsx` pattern for product form
4. Use `enforcePermission("products:create")` in new product page
5. Use `enforcePermission("products:edit")` in edit product page
6. Use `requirePermission("products:create")` in createProduct server action
7. Use `requirePermission("products:edit")` in updateProduct server action
8. Add product form translation keys to locales

### Guard Usage Pattern for Future Modules

```typescript
// In Server Component pages (page.tsx)
import { enforcePermission } from "@/lib/rbac/guards";
await enforcePermission("products:create"); // redirects to /access-denied if unauthorized

// In Server Actions
import { requirePermission } from "@/lib/rbac/guards";
const user = await requirePermission("products:create"); // throws ForbiddenError if unauthorized

// In Client Components (conditional rendering)
import { canCreate } from "@/lib/rbac";
const showButton = canCreate(userRole, "products");
```

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |

---

## Notes

- Do NOT begin Orders, Invoices, Collections, Ledger, or Due Reports
- All new server actions MUST call `requirePermission()` at the top
- All new protected pages MUST call `enforcePermission()` at the top
- Never expose raw Prisma errors to the client
- Never use `any` type
- Never hardcode role checks — use helpers from src/lib/rbac/
