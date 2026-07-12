# CURRENT_PHASE.md

Current Phase:

PHASE_10B_ENTERPRISE_USER_MANAGEMENT_CERTIFICATION

Status:

COMPLETE

---

# PHASE_10B_ENTERPRISE_USER_MANAGEMENT_CERTIFICATION

Status: COMPLETE (2026-07-13)

## Objectives

Read-only certification of PHASE_10A user management before activation UX.

* `src/lib/certification/users/` — Rules 1–12
* `runUserCertification()` / `runUserCertificationWithReport()`
* `UserAuditCoverageReport` — covered / partial / missing
* ADR-050

## Completion Criteria

* Super Admin authority verified: ✓
* Manager / SR / Accounts isolation verified: ✓
* Privilege escalation blocked: ✓
* Lifecycle state machine certified: ✓
* Territory leakage scan clean: ✓
* Financial boundary scan clean: ✓
* Architecture import scan clean: ✓
* Performance structural + live audit: ✓
* `phase10cApproved: true`: ✓
* `user-certification.test.ts` — 20 tests: ✓
* Governance docs + ADR-050: ✓

## Explicitly NOT Changed

* posting-service, due engine, territory RBAC engines, dashboard, financial engines, audit export engine
* User service, UI, permissions, schema

## Next Phase

**PHASE_10C — User Activation UX**

---

# PHASE_10A_ENTERPRISE_USER_MANAGEMENT_FOUNDATION

Status: COMPLETE (2026-07-13)

## Objectives

Enterprise user provisioning foundation with lifecycle state machine, granular RBAC, territory-scoped manager access, and audit writers closing ADR-047 gaps.

* `UserLifecycleStatus` enum + additive Prisma models (`UserProfile`, `UserInvitation`, `UserActivationToken`)
* `src/lib/users/` — lifecycle, service, validation, audit, password helpers
* Server actions: `createUser`, `updateUser`, `activateUser`, `disableUser`, `listUsers`, `getUser`, `searchUsers`
* UI: `/settings/users` — table, filters, details panel, create/disable dialogs
* Permissions: `users:view`, `users:create`, `users:update`, `users:disable`, `users:activate`
* Audit writers: `USER_CREATED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `USER_ROLE_CHANGED`
* ADR-049

## Completion Criteria

* Additive schema migration (no destructive changes): ✓
* Super Admin full lifecycle control: ✓
* Manager limited SR draft/create in territories: ✓
* Accounts read-only visibility: ✓
* SR self-profile via `getUser`: ✓
* Territory scope via `buildTerritoryScope()`: ✓
* Temporary password generation (no email/OTP): ✓
* `user-management.test.ts` — 11 tests: ✓
* Governance docs + ADR-049: ✓
* `npm run build` — succeeds: ✓

## Explicitly NOT Changed

* posting-service, due engine, territory RBAC engines, dashboard, financial engines, audit export engine
* Auth login flow, email sending, OTP, password reset UI

## Next Phase

**PHASE_10C — User Activation UX** (mustChangePassword enforcement, optional email/OTP)

---

# PHASE_09E_AUDIT_EXPORT_COMPLIANCE_ARCHIVE

Status: COMPLETE (2026-07-13)

## Objectives

Server-generated audit exports and compliance archives — read-only, filter-preserving, territory-safe.

* `src/lib/audit/export/` — PDF, Excel, ZIP generation via `getAuditConsoleData()` only
* Server actions: `exportAuditPdf`, `exportAuditExcel`, `exportAuditArchive`
* UI: `audit-export-menu`, `audit-export-dialog`, `audit-export-progress`
* ADR-048

## Completion Criteria

* PDF export (landscape A4, summary, timeline, records): ✓
* Excel export (flattened metadata, server sort order): ✓
* Compliance ZIP (PDF + XLSX + `compliance-summary.json`): ✓
* Filter-preserving exports: ✓
* Territory scope via `getAuditConsoleData()`: ✓
* 10,000 row export cap: ✓
* No new audit writers / no second query layer: ✓
* No certified engine modifications: ✓
* `audit-export.test.ts` — 11 tests: ✓
* Governance docs + ADR-048: ✓

## Explicitly NOT Changed

* posting-service, due engine, territory RBAC engines, dashboard, financial engines, audit-query layer

## Next Phase

**PHASE_10 — User Management** or **Dashboard Exports**

---
