# CURRENT_PHASE.md

Current Phase:

PHASE_12A.1 — SR Performance Dashboard Filter Stabilization & Split Print Certification

Status:

PHASE_12A.1 FULLY CERTIFIED

---

# PHASE_12A.1 — Filter Stabilization & Split Print Certification

Status: FULLY CERTIFIED (2026-07-20) — code + deployment-parity complete

## Objectives completed

* Canonical URL filter contract shared by screen + print (`parseSrPerformanceFilters`)
* Correct filter → query predicate matrix
* Dealer-attribution integrity diagnostics (no false territory-overlap warnings)
* Independent Individual + Global Overview print modes
* Soft-resolve: invalid `srId` cleared/replaced after incompatible territory (URL canonicalized)
* Compatible territory change preserves valid `srId`
* Focused + full Vitest green: **631 passed / 7 skipped**
* `npx tsc --noEmit` → `TSC_EXIT_CODE=0`
* `npx prisma validate` → `PRISMA_EXIT_CODE=0`
* `npx eslint .` → `ESLINT_EXIT_CODE=0`
* `npm run build` → `BUILD_EXIT_CODE=0`
* `docker compose build` → `DOCKER_BUILD_EXIT_CODE=0`
* `runSrPerformanceCertification()` RULE_SR_REPORT_01–15 with **`phase12a1Approved: true`** / **`approved: true`**
* Browser smoke Super_Admin + Manager (Playwright Chromium) — **18/18** against recreated container
* Warning runtime — **2/2** against recreated container
* Deployment-parity: `RUNNING_IMAGE_MATCH=true`

## Deployment-parity closure (2026-07-20)

| Item | Value |
|------|-------|
| Compose service | `app` |
| Recreate command | `docker compose up -d --force-recreate --no-deps app` |
| Old running image | `sha256:536768050f703888fbf56490cc93107a079cfd121ea501d48dd362c7d9a92829` (stale) |
| Final running image | `sha256:a57faf0cd8e8775dcb25e50bcb24242660f42636588a3b540278fb618fb6b323` |
| `RUNNING_IMAGE_MATCH` | **true** |
| LanguageProvider parity | 8/8 PASS (EN↔BN persist, fresh-context hydration clean) |
| Geography cascade | PASS (load + clear stale district/territory) |
| Territory assignments | PASS (user switch updates rows) |
| SR smoke | 18/18 PASS |
| Warning smoke | 2/2 PASS |
| Startup / runtime logs | Clean (Prisma config deprecation warn only) |

Minimal runtime fix included in final image: `suppressHydrationWarning` on SR `generatedAt` `toLocaleString()` (Docker UTC vs browser local).

## Explicitly NOT Changed

* posting-service, dealer-lock, ledger write/statement/reconciliation engines
* due report engine, territory RBAC engine implementation
* dashboard / audit / notification / auth architectures
* company-branding source of truth
* Prisma schema / financial indexes
* SR Performance SQL / ownership attribution / financial formulas

## Next Phase

**PHASE_12B** (or Dashboard Exports / client demo follow-on) — commit PHASE_12A + 12A.1 when ready

---

# PHASE_12A_PRINTABLE_SR_PERFORMANCE_LEDGER_DASHBOARD

Status: IMPLEMENTED — FULLY CERTIFIED via PHASE_12A.1 (2026-07-20)

See ADR-060 stabilization + ESLint + deployment-parity revision.
