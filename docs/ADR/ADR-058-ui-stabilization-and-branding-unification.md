# ADR-058: UI Stabilization and Branding Unification

**Status:** Accepted  
**Date:** 2026-07-14  
**Phase:** PHASE_11E.1

## Context

Before PHASE_11F certification and the client demo, two user-facing polish defects were reported:

1. **Translation flicker** — After hard refresh, the UI briefly displayed raw i18n keys (`dashboard.title`, `nav.dealers`, `auth.login.emailLabel`) before client-side `fetch` of `/locales/{locale}/common.json` completed.
2. **Inconsistent branding** — Invoice and document printables used `public/branding/nazma-logo.png` via `getCompanyBranding()`, while the ERP shell (sidebar, login, auth pages) used a generic inline SVG house icon.

All certified subsystems (financial engine, ledger, due, territory RBAC, dashboard, notifications) must remain untouched.

## Decision

### PATCH 1 — Synchronous i18n (no fetch race)

| Change | Detail |
|--------|--------|
| `src/lib/i18n/translations.ts` | Static imports of `public/locales/{en,bn}/common.json` — bundled at build time |
| `src/lib/i18n/locale-cookie.ts` | `nazma-locale` cookie helpers for SSR/client sync |
| `LanguageProvider` | Accepts `initialLocale` from server; `t()` reads bundled dictionary synchronously on first render |
| Root layout | Reads locale cookie via `cookies()`; sets `<html lang>` and passes `initialLocale` |
| Locale switch | Updates state, `localStorage`, and cookie — no network round-trip |
| List pages | Removed translation-loading skeleton gates (`isLoading` from `useLanguage`) |

`public/locales/` remains the canonical JSON source; files are imported (not duplicated) into the client bundle.

### PATCH 2 — Unified company logo

| Change | Detail |
|--------|--------|
| `CompanyLogoImage` | Shared component reading `getCompanyBranding().logoSrc` |
| `AppLogo` | Sidebar/mobile nav — uses `CompanyLogoImage` instead of inline SVG |
| `AuthPageShell` + login page | Same logo asset as invoice documents |
| `company-branding.ts` | Unchanged — single source of truth (`/branding/nazma-logo.png`) |

Document composers (`CompanyHeader`, invoice/challan/receipt printables) are **not modified** — they already consumed `getCompanyBranding()`.

## Non-goals

- Financial engine, posting-service, ledger, due, reconciliation, integrity monitor
- Notification architecture
- Territory RBAC
- Dashboard architecture
- Invoice calculation logic
- Company settings UI (branding still hardcoded — see TECH_DEBT M4)

## Consequences

- Translation keys never appear on first paint; no client-side fetch race.
- EN/BN switching remains instant (in-memory dictionary swap).
- ERP shell and printable documents share one logo path via `getCompanyBranding()`.
- First visit after deploy may briefly show default locale before `localStorage` preference is mirrored to cookie (one-time migration; no raw-key flash).

## Verification

| Check | Result |
|-------|--------|
| `npm run build` | Pass |
| `docker compose build` | Pass |
| posting-service.ts diff | None |
| Invoice engine calculations | Untouched |
| Notification / RBAC modules | Untouched |

### Hotfix (2026-07-14) — Login page logo

| Issue | Root cause | Fix |
|-------|------------|-----|
| Logo missing on `/login` while visible on dashboard/invoices | Auth middleware matched `/branding/nazma-logo.png`; unauthenticated requests were redirected to `/login`, so the image never loaded | Exclude `branding` and `locales` from middleware matcher |

Branding certification: `runBrandingCertification()` — Rules `RULE_BRANDING_01` through `RULE_BRANDING_10`.
