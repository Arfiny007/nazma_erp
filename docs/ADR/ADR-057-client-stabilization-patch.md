# ADR-057: Client Stabilization Patch

**Status:** Accepted  
**Date:** 2026-07-14  
**Phase:** PHASE_11E

## Context

Before client review and PHASE_12 development, three user-facing workflow defects were reported:

1. **Logout unreliable / missing** — profile button in the dashboard header had no sign-out action; only the mandatory change-password page exposed logout.
2. **Delivery challan preview blank** — `window.print()` on the challan detail page produced a blank page because global `document-print.css` hides all elements except `.document-print-root`. No challan printable composer or `/print` route existed (unlike invoice and money receipt).
3. **Collection confirm requires draft save** — clicking Confirm on a new collection called `persistDraft()`, which invoked `router.replace()` to the edit page before `confirmCollection()` completed, aborting the direct confirm flow.

All certified subsystems (financial engine, ledger, due, territory RBAC, dashboard, notifications) must remain untouched.

## Decision

### PATCH 1 — Logout

| Change | Detail |
|--------|--------|
| `UserProfileMenu` | Header dropdown with `signOut({ callbackUrl: "/login" })` |
| `MobileNav` | Footer sign-out for mobile users |
| `DashboardLayout` | Passes authenticated user name/email to shell |
| Middleware | Unchanged — `/api/auth` remains allowed during `mustChangePassword` |

### PATCH 2 — Delivery Challan Preview / Print

| Change | Detail |
|--------|--------|
| `ChallanPrintable` | Document platform composer using `DocumentLayout`, `DocumentMetadata`, `DocumentTable` |
| `ChallanDocumentPreview` | Modal preview (mirrors invoice pattern) |
| `/delivery-challans/[id]/print` | Dedicated print route with `DocumentPrintToolbar` |
| Detail page | Server-resolved `userRole` — removes session hydration blank screen |
| Print actions | Link to print route instead of `window.print()` on non-`document-print-root` content |

Challan remains **non-financial** — no prices, balances, or ledger references in the printable.

### PATCH 3 — Collection Direct Confirm

| Change | Detail |
|--------|--------|
| `persistDraft({ navigateOnCreate })` | Skip `router.replace` when `navigateOnCreate: false` |
| `handleConfirm` | Calls `persistDraft({ navigateOnCreate: false })` then `confirmCollection` |
| Permission | `canCreate \|\| canEdit` (was `canEdit` only) |

Collection transaction engine, `posting-service.ts`, and `Dealer.currentBalance` mutation paths are **not modified**.

## Non-goals

- Financial engine changes
- Ledger / due / reconciliation changes
- Territory RBAC changes
- Dashboard changes
- Notification architecture changes
- Challan document typography polish (deferred to TECH_DEBT M12 follow-up)

## Consequences

- Logout is available on every authenticated dashboard page.
- Challan preview and print use the same document pipeline as invoice/receipt.
- Both collection workflows are supported: Create → Confirm and Draft → Save → Confirm.
- Global `document-print.css` continues to apply; only routes/components wrapped in `document-print-root` print correctly.

## Verification

| Check | Result |
|-------|--------|
| `npm run build` | Pass |
| `docker compose build` | Pass |
| `workflow.test.ts` + `authentication-expansion.test.ts` | 32 tests pass |
| posting-service.ts diff | None |
| Ledger / due / notification modules | Untouched |
