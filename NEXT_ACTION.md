# NEXT ACTION

## Current State

PHASE_11E.1_UI_STABILIZATION_PATCH is **complete** (2026-07-14):

- Translation flicker eliminated — bundled i18n dictionaries, locale cookie SSR, synchronous `t()` on first render
- Company branding unified — `CompanyLogoImage` reads `getCompanyBranding().logoSrc` across sidebar, login, and auth shell
- ADR-058 authored; financial/ledger/RBAC/notification/invoice-calculation layers untouched

PHASE_11E client stabilization (logout, challan print, collection confirm) remains complete.

PHASE_11D notification certification remains frozen.

---

## Next Steps

### 1. PHASE_11F — Certification + client demo

- Run certification gates before demo
- Validate login → dashboard → dealers → products → collections → invoices → settings → notifications → audit flows

### 2. PHASE_12 — Next development phase (approved after demo)

- Proceed with next roadmap item

### 3. Dashboard Exports (follow-on)

- PDF / Excel exports for dashboard + map data

### 4. Production SMTP + worker scheduling

- Configure `SMTP_*` env vars in `.env` / Docker
- Schedule `process-notifications.ts` via cron or orchestrator

### Explicitly Out of Scope (until respective phase)

- SMS / Twilio delivery
- Push / in-app notification center
- Template editor UI
- Redis / BullMQ queues

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |
| Manager | manager1@nazma.test | (seed) |
| SR | sr1@nazma.test | (seed) |
| Accounts | accounts1@nazma.test | (seed) |

---

## Notes

- `runFinancialCertification()` is the pre-release financial gate — run with live PostgreSQL for full score
- `runAuditCertification()` is the pre-export audit gate
- `runUserCertification()` is the user management gate (PHASE_10B)
- `runAuthenticationCertification()` is the pre-production auth gate (PHASE_10D)
- `runNotificationCertification()` is the pre-production notification gate (PHASE_11D)
- User lifecycle: `INVITED → PENDING_ACTIVATION → ACTIVE → DISABLED → ARCHIVED`
- All balance mutations continue through `posting-service.ts` only
- Notification delivery requires worker: `npm run process-notifications` or Super Admin "Process queue" in UI
- Logout: profile menu (desktop) or mobile nav footer; change-password page retains sign-out form
