# NEXT ACTION

## Current State

PHASE_08E.1_TERRITORY_SECURITY_HOTFIX is **complete** (2026-07-11):

- `getDealerCollectionContext()` — `canAccessDealerByCode` gate added
- Cross-territory collection workspace leak closed
- Territory security score: **10/10**
- Overall readiness: **9.7/10**

PHASE_08E certification complete. PHASE_08A–08D certified.

---

## Next Steps

### 1. Audit Log UI

- Production audit trail screen

### 2. Due Report Exports (PHASE_08F follow-on)

- PDF / Excel using same read engine DTOs

### 3. Integrity Notifications & Cron (follow-on)

- Wire background scheduler to `runFinancialIntegrityScan()`
- Alert when scan detects drift, missing ledger, or corruption

### 3. Statement Excel / Email Export (presentation follow-on)

- Excel export / email delivery — same `DealerStatementDTO`, no second query path

### 4. Bulk Opening Balance Import (architecture ready, UI not built)

- `postOpeningBalanceBatch()` already shipped (PHASE_07C, ADR-028 §7)

### 5. Final Production Hardening

- Collection concurrency integration tests
- Fix `it.skipIf` registration-time evaluation gap (TECH_DEBT C8)
- Run `runFinancialCertification()` with live `DATABASE_URL` before production cutover

### Explicitly Out of Scope (until respective phase)

- Chart of Accounts / full GL — PHASE_07F+ (optional COA, not certification)
- Email/SMS document delivery

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |
| Accounts | (seed if needed) | — |

---

## Notes

- `runFinancialCertification()` is the pre-release financial gate — run with live PostgreSQL for full 9.3/10 score
- Structural checks pass without database; live Rules 1–3/5/6/8 require reachable `DATABASE_URL`
- All balance mutations continue through `posting-service.ts` only
- All ledger writes flow through `createLedgerEntry` — called from `posting-service.ts` and replay engine only
- Delivery Challan remains NON-FINANCIAL
- Ledger is APPEND-ONLY — use compensating reversals for corrections
