# CHANGELOG

All notable changes to Nazma ERP are documented here.

---

## [PHASE_AUTH_01_FOUNDATION] — 2026-06-20

### Added

- **Auth.js v5** (next-auth@beta.31) with Credentials provider
- **bcrypt password hashing** (12 salt rounds) via bcryptjs
- **JWT session strategy** — no database sessions required
- **Login page** (`/login`) — enterprise-quality UI, RHF + Zod, loading state, error messages
- **Route protection middleware** — all dashboard/dealer/product routes require session
- **Super Admin seed** — idempotent, creates `admin@nazma.local` with hashed password
- **Auth helpers** — `getSession`, `getCurrentUser`, `getCurrentRole`, `requireUser`, `requireRole`
- **SessionProvider** — wraps root layout for client-side session access
- **Module augmentation** — `Session`, `User`, `JWT` types extended with `role` and `isActive`
- **Inactive user blocking** — `isActive: false` users receive friendly error on login attempt
- **Auth translation keys** — English and Bengali locale strings for auth module

### Dependencies Added

- `next-auth@^5.0.0-beta.31`
- `bcryptjs@^2.4.3`
- `@auth/prisma-adapter@latest`
- `@types/bcryptjs` (dev)

### Modified

- `prisma/seed.ts` — added `seedAdminUser` call with structured output
- `src/app/layout.tsx` — wrapped with `SessionProvider`
- `public/locales/en/common.json` — added `auth.*` keys
- `public/locales/bn/common.json` — added `auth.*` keys (Bengali)

---

## [PHASE_03A_REVIEW_PRODUCT_SEEDS] — Prior

### Added

- `prisma/seeds/product-categories.ts` — idempotent upsert of 12 categories
- `prisma/seed.ts` — Prisma seed entry point
- `package.json` — `prisma.seed` + `seed` script + `tsx` devDependency

---

## [PHASE_03B_PRODUCT_LIST_UI] — Prior

### Added

- `src/app/(dashboard)/products/page.tsx`
- `src/components/products/product-table.tsx`
- `src/components/products/product-search.tsx`
- `src/components/products/product-status-badge.tsx`
- `src/components/products/product-empty-state.tsx`
- Product translation keys (en + bn)

---

## [PHASE_03A_PRODUCT_BACKEND] — Prior

### Added

- `Category` and `Product` Prisma models
- Product domain types, validators, and CRUD server actions

---

## [PHASE_02C_DEALER_FORMS] — Prior

### Added

- New Dealer form (`/dealers/new`)
- Edit Dealer form (`/dealers/[dealerCode]/edit`)

---

## [PHASE_02B_DEALER_LIST_UI] — Prior

### Added

- Dealer list page with TanStack Table, search, sort, pagination

---

## [PHASE_02A_DEALER_BACKEND] — Prior

### Added

- Dealer domain: types, validators, CRUD server actions

---

## [PHASE_01_FOUNDATION] — Prior

### Added

- Next.js 15+ App Router project scaffold
- Prisma + PostgreSQL setup
- Tailwind CSS + design system
- Dashboard shell layout
- Localization (English + Bengali)
- Dark mode support
