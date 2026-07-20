# NEXT ACTION

## Current State

**PHASE_12A.1 FULLY CERTIFIED** (2026-07-20) — code gates + deployment-parity

- Repository gates: Prisma / tsc / eslint / vitest 631+7 / build / docker build
- Certification: `phase12a1Approved: true`, `approved: true`, RULE_SR_REPORT_01–15
- Container recreate: `RUNNING_IMAGE_MATCH=true`
- Runtime smoke on recreated image: SR 18/18 + warning 2/2
- LanguageProvider / geography / territory-assignment parity: 8/8

---

## Next Steps

### 1. Git commit for PHASE_12A + 12A.1

- Commit SR Performance module + stabilization + ESLint closure + deployment-parity governance (ADR-060)
- Do not include `.env`, secrets, or `tmp-cert-*` evidence scratch files

### 2. Live verification (optional spot-check)

- Confirm container image ID matches `nazma-app:latest`
- Login Super_Admin → SR Performance filters / prints
- Login Manager → territory isolation

### 3. Follow-on candidates

- Dashboard / report Excel exports
- Production SMTP + notification worker scheduling
- Client demo dry-run across core modules

### Explicitly Out of Scope (until respective phase)

- SMS / Twilio delivery
- Push / in-app notification center
- Redesign of posting-service / due engine / Territory RBAC

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |
| Manager | manager1@nazma.test | Demo123! |
| SR | sr1@nazma.test | Demo123! |
| Accounts | accounts1@nazma.test | Demo123! |

---

## Notes

- SR Performance uses `LedgerEntry` only — never `Dealer.currentBalance` as historical source
- Collection reversals reduce period Collection (not Sales)
- Multiple SRs in one territory is not a financial warning when ownership is unique
- Core financial engines were untouched in PHASE_12A / 12A.1
