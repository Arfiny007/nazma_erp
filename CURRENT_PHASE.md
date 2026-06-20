# CURRENT_PHASE.md

Current Phase:

PHASE_AUTH_01_FOUNDATION

Status:

COMPLETE

---

## Objectives

Implement production-grade authentication for Nazma ERP using Auth.js v5 (next-auth@beta).

* Credentials-based login (email + password)
* bcrypt password hashing
* JWT session management
* Middleware route protection (dashboard, dealers, products)
* Super Admin seed (admin@nazma.local / Admin123!)
* Inactive user blocking (isActive check)
* Reusable auth helpers for future RBAC phase
* Strict TypeScript, Zod validation, no any

---

## Deliverables

auth.ts (project root) — Auth.js v5 NextAuth configuration

middleware.ts (project root) — JWT-based route protection

src/types/auth.ts — AuthUser, AuthSession type definitions

src/types/next-auth.d.ts — Module augmentation for Session, User, JWT

src/lib/auth/helpers.ts — getSession, getCurrentUser, getCurrentRole, requireUser, requireRole

src/lib/actions/auth/login.ts — loginAction server action (Zod + signIn)

src/app/(auth)/layout.tsx — Auth shell layout (no sidebar)

src/app/(auth)/login/page.tsx — Login page (Server Component)

src/components/auth/login-form.tsx — Login form (Client Component, RHF + Zod)

src/components/providers/session-provider.tsx — NextAuth SessionProvider wrapper

src/app/api/auth/[...nextauth]/route.ts — Auth.js route handler

prisma/seeds/admin-user.ts — Idempotent Super Admin seed (bcrypt hashed)

prisma/seed.ts (updated) — Includes admin user seed

src/app/layout.tsx (updated) — Wraps app with SessionProvider

public/locales/en/common.json (updated) — auth.* translation keys

public/locales/bn/common.json (updated) — auth.* translation keys (Bengali)

---

## Implementation Notes

* Auth.js v5 (next-auth@beta.31) uses JWT strategy — no database sessions, no PrismaAdapter required
* `AUTH_SECRET` added to .env
* Credentials provider validates via Zod then bcrypt.compare
* Custom CredentialsSignin subclasses: `InvalidCredentialsError` (code: invalid_credentials) and `AccountDisabledError` (code: account_disabled)
* Middleware wraps `auth()` from auth.ts; authenticated users redirected away from /login
* All protected routes (/*, /dealers, /products, etc.) require session
* Super Admin seed is idempotent — re-running is safe
* Password: bcrypt with 12 salt rounds
* `requireUser()` and `requireRole()` helpers ready for RBAC phase
* TypeScript strict mode — 0 errors
* ESLint — 0 errors on new files (2 pre-existing TanStack warnings in dealer/product modules unchanged)

---

## Completion Criteria

* Login works: ✓
* Password hashing: ✓ (bcrypt, 12 rounds)
* Session management: ✓ (JWT)
* Middleware protection: ✓
* Super Admin seed: ✓ (admin@nazma.local / Admin123!)
* Inactive users blocked: ✓
* TypeScript passes: ✓ (tsc --noEmit exits 0)
* ESLint passes: ✓ (0 errors on auth files)
* Governance files updated: ✓

---

## Next Phase

PHASE_AUTH_02_RBAC

---

---

# Previous Phases

---

# PHASE_03B_PRODUCT_LIST_UI

Status: COMPLETE

## Objectives

Create a read-only Product List module matching the visual quality and UX pattern of the Dealer List module.

## Deliverables

src/app/(dashboard)/products/page.tsx

src/components/products/product-table.tsx

src/components/products/product-search.tsx

src/components/products/product-status-badge.tsx

src/components/products/product-empty-state.tsx

public/locales/en/common.json (product translation keys)

public/locales/bn/common.json (product translation keys)

## Implementation Notes

* `ProductTable` calls `listProducts()` server action with search, sort, and pagination params — no new backend APIs.
* Price is formatted with `Intl.NumberFormat` (BDT, narrowSymbol) using the `currentPrice` decimal string from `ProductDTO`; no floating-point arithmetic.
* `ProductStatusBadge` renders green (emerald) for active and gray (slate) for inactive — consistent with enterprise design system.
* All UI strings use `t()` translation keys; zero hardcoded human strings.
* Columns: Model Number, SKU, Product Name (with Bengali subtitle), Category, Current Price (right-aligned), Status.
* Sticky table header, horizontal scroll on small viewports (`min-w-[760px]`), loading skeleton, empty state, error state with retry button.
* Architecture mirrors `DealerTable` exactly: TanStack Table, manual sort/pagination, cancel-on-unmount fetch, `FetchStatus` discriminated state.
* `tsc --noEmit` exits 0. ESLint exits 0 (1 expected TanStack warning, same as dealer module).

## Next Phase

PHASE_03C_PRODUCT_FORMS
