# NEXT ACTION

## Current State

PHASE_AUTH_01_FOUNDATION is COMPLETE.

Authentication foundation is in place:
- Login at /login with credentials provider
- JWT sessions
- Middleware protecting all dashboard routes
- Super Admin seeded: admin@nazma.local / Admin123!
- Auth helpers ready for RBAC consumption

---

## Next Phase: PHASE_AUTH_02_RBAC

### Objective

Implement Role-Based Access Control using the auth helpers built in PHASE_AUTH_01.

### Tasks

1. Wire `requireRole()` into existing server actions (dealers, products)
2. Hide/show navigation items based on user role
3. Protect admin-only routes (users, settings) at middleware level
4. Add role badge to user profile in dashboard header
5. Implement User Management page (Super_Admin only)

### Alternative Next Phase: PHASE_03C_PRODUCT_FORMS

If RBAC is deferred, the next logical UI phase is:

- Product create form
- Product edit form
- Following the same pattern as Dealer forms

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |

---

## Notes

- Do NOT begin Orders, Invoices, Collections, Ledger, or Due Reports before Auth + RBAC
- All new server actions MUST call `requireUser()` or `requireRole()` at the top
- Never expose raw Prisma errors to the client
