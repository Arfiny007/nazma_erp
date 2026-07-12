# ADR-047: Enterprise Audit & Compliance Certification

**Status:** Accepted  
**Date:** 2026-07-13  
**Phase:** PHASE_09D.5

## Context

PHASE_09D shipped the read-only Audit & Compliance Console at `/audit`. Before PHASE_09E (exports), User Management, or authentication expansion, the audit layer must be certified for security, financial immutability, territory isolation, coverage measurement, architecture, and performance.

## Decision

### Certification module: `src/lib/certification/audit/`

| File | Purpose |
|------|---------|
| `audit-certification-service.ts` | `runAuditCertification()`, `runAuditCertificationWithReport()` |
| `audit-certification-validation.ts` | Rules 1–10 + repository scans |
| `audit-certification-types.ts` | Result contract, `AuditCoverageReport` |
| `audit-certification-report.ts` | Executive summary formatting |

### Rules certified

| Rule | Scope |
|------|-------|
| 1 | Financial immutability — no posting-service / ledger mutation imports |
| 2 | Super Admin unrestricted visibility |
| 3 | Accounts financial + integrity only |
| 4 | Manager territory isolation via `buildTerritoryScope()` |
| 5 | SR assigned-dealer isolation via ownership history |
| 6 | Territory leakage scan on `audit-query.ts` findMany |
| 7 | Workflow audit coverage measurement (no new writers) |
| 8 | Server-side search, pagination, timeline grouping |
| 9 | Architectural import boundaries |
| 10 | Performance audit (<1000ms target with demo seed) |

### Coverage report

`AuditCoverageReport` documents covered, partial, and missing ERP workflows. Missing writers (login, user creation, integrity scan persistence, dealer CRUD audit) are **warnings**, not blockers — console correctly consumes existing `AuditLog` rows only.

### Approval gate

`phase09eApproved: true` when:
- Zero critical failures
- Overall score ≥ 9.0
- Security, financial integrity, territory isolation, and architecture subsystems pass

## Non-goals

- Implementing missing audit writers
- Export functionality
- AuditLog schema changes
- Modifying certified financial or territory engines

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| Audit console (`src/lib/audit/`) | No |
| Territory RBAC | No |
| Dashboard / map modules | No |

## Consequences

- PHASE_09E may proceed when certification passes
- Known audit trail gaps are documented for future writer phases
- Repository scans provide ongoing regression detection
