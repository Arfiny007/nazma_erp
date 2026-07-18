# NEXT ACTION

## Current State

PHASE_11E.5_ENTERPRISE_GIT_HYGIENE is **complete** (2026-07-18):

- Removed all debug modules and 19 investigation scripts from repository
- `.gitignore` updated to prevent future debug artifact commits
- Build, Vitest (577/577), and Prisma validate pass
- Repository is production-clean and ready for Git commit

PHASE_11E.4 enterprise certification remains complete.

PHASE_11E.3 RC-1 stabilization remains complete.

---

## Next Steps

### 1. Git commit + push (immediate)

- Commit cleanup with recommended message from PHASE_11E.5 report
- Tag `v0.11.0-rc1`
- Push to remote

### 2. Client demo

- Authenticated dry-run: login → dashboard → dealers → products → collections → invoices → settings → audit

### 3. PHASE_12 — Next development phase

- Branch `phase-12` from tagged baseline
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
