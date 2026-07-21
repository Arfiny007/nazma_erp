# Known Risks — Nazma Water Taps ERP

Operational risk register as of PHASE_06D completion. None are blocking for controlled production use of the Order → Invoice → Collection pipeline.

**Overall readiness:** 9.3 / 10 (ADR-037)  
**Last updated:** 2026-07-20 (PHASE_12B.1)

### PHASE_12B / 12B.1 — Territory product sales risks

| ID | Risk | Mitigation | Status |
|----|------|------------|--------|
| PS-R1 | Missing ownership history for old invoices | Fallback to current dealer territory + diagnostics banner | Mitigated |
| PS-R2 | Ambiguous overlapping ownership intervals | Deterministic rank-1 pick + ambiguous diagnostic | Mitigated |
| PS-R3 | Chart presentation uses JS number at SVG boundary | Aggregation remains Decimal; `valueLabel` preserves string | Accepted |
| PS-R4 | No invoice territory snapshot | Historical ownership as-of `issueDate` (ADR-061) | Accepted |
| PS-R5 | ~~Dynamic filters referenced `eii` before CTE existed~~ | Stage-aware `buildEligibleInvoiceItemFilters` + RULE_PRODUCT_SALES_16 | **Resolved** (PHASE_12B.1) |

### PHASE_12A / 12A.1 — SR Performance reporting risks

| ID | Risk | Mitigation | Status |
|----|------|------------|--------|
| SR-R1 | Multi-SR territory assignments misread as financial defects | Ownership attribution diagnostics only; territory overlap is metadata | **Resolved** (PHASE_12A.1) |
| SR-R2 | Unsupported ledger posting types in period | Excluded from Sales/Collection; reconciliation delta + banner | Mitigated |
| SR-R3 | Large print datasets | Hard cap `SR_PERFORMANCE_PRINT_DEALER_CAP` (5000) | Mitigated |
| SR-R4 | Filter URL / React state divergence | Canonical URL parser + merge helper; back/forward reload; soft-resolve redirect | **Resolved** (PHASE_12A.1) |
| SR-R5 | Repository-wide ESLint errors on baseline UI files | Four `set-state-in-effect` defects corrected; RULE_SR_REPORT_15 evidence gate | **Resolved** (PHASE_12A.1 ESLint closure) |

---

## Financial Risks

### F1. No Invoice Void / Credit Note

| Attribute | Value |
|-----------|-------|
| Description | Issued invoices cannot be reversed in-system |
| Impact | Billing errors require manual workarounds |
| Likelihood | Medium |
| Mitigation | `postInvoiceReversal()` / credit note in a dedicated phase; never edit issued lines; PHASE_07B posting engine ready to accept these via `buildReversalPosting` |
| Status | **Open** |
| Future Phase | Dedicated credit-note phase |

### F2. Dealer.currentBalance as Sole Truth

| Attribute | Value |
|-----------|-------|
| Description | Reports trusting cache without reconciliation may be wrong |
| Impact | Incorrect balances in ad-hoc reports |
| Likelihood | Very low (sole writer + dealer lock + `LedgerEntry.balance` parity assertion on every commit — PHASE_07B) |
| Mitigation | Cache asserted equal to ledger on every commit; `reconcileAllDealers` + chain validation (PHASE_07B.5); historical replay (PHASE_07E2); enterprise reconciliation engine (PHASE_07E3); automated integrity monitor with persisted scan history (PHASE_07E4) |
| Status | **Mitigated** (parity on every commit + replay + reconciliation + scan history) |
| Future Phase | Integrity dashboard / notifications / cron wiring (optional) |

### F3. Allocation Rows Deleted on Reversal

| Attribute | Value |
|-----------|-------|
| Description | `CollectionAllocation` hard-deleted on reversal |
| Impact | Cannot reconstruct allocation list from DB alone |
| Likelihood | Low (reversals rare) |
| Mitigation | Audit `COLLECTION_REVERSED_MISALLOCATION`; optional soft-delete |
| Status | **Accepted** |
| Future Phase | Optional enhancement |

### F4. No Opening Balance Handler

| Attribute | Value |
|-----------|-------|
| Description | ~~Cannot onboard dealers with pre-existing AR at go-live~~ |
| Impact | ~~Production migration requires manual balance setup~~ |
| Likelihood | ~~High at production cutover~~ |
| Mitigation | `postOpeningBalance()` shipped in `posting-service.ts`; enterprise wizard UI at `/opening-balances`; exactly-once initialization enforced at app + DB level; proven safe under concurrency (ADR-028) |
| Status | **Resolved** (PHASE_07C) |
| Future Phase | ~~PHASE_07C~~ ✅ DONE — bulk import UI (CSV/Excel/ERP migration) remains a future enhancement on the same engine |

### F5. Advance Payment GL Treatment

| Attribute | Value |
|-----------|-------|
| Description | Negative AR correct in subledger; full GL needs Customer Deposits account |
| Impact | Statutory statements incomplete until COA |
| Likelihood | Low until full GL required |
| Mitigation | AR subledger certified; liability account in COA phase |
| Status | **Accepted** (subledger correct) |
| Future Phase | PHASE_07F+ |

---

## Architecture Risks

### A1. LedgerEntry Schema Stale

| Attribute | Value |
|-----------|-------|
| Description | ~~`referenceType` String; no `postingKey`; weak reversal linkage~~ |
| Impact | ~~Type drift, duplicate entries, weak audit chain~~ |
| Likelihood | ~~Certain if ledger built without hardening~~ |
| Mitigation | PHASE_07A schema hardening + `createLedgerEntry` idempotency (ADR-025); PHASE_07B wired posting (ADR-026) |
| Status | **Resolved** — schema hardened and posting engine wired |
| Future Phase | ~~PHASE_07A~~ / ~~PHASE_07B~~ ✅ DONE |

### A2. Full GL Not Architected

| Attribute | Value |
|-----------|-------|
| Description | Trial Balance, P&L, Balance Sheet impossible |
| Impact | No statutory financial statements |
| Likelihood | Certain until COA phase |
| Mitigation | AR subledger first; COA + JournalLine in PHASE_07F |
| Status | **Open** (by design) |
| Future Phase | PHASE_07F+ |

### A3. Single-Company Assumption

| Attribute | Value |
|-----------|-------|
| Description | Multi-company platform requires tenant isolation later |
| Impact | Refactor for multi-entity deployment |
| Likelihood | Low for Nazma single-entity |
| Mitigation | Clean module boundaries; avoid hardcoded company in business logic |
| Status | **Accepted** |
| Future Phase | Platform v2 |

---

## Concurrency Risks

### C1. No Collection Concurrency Integration Tests

| Attribute | Value |
|-----------|-------|
| Description | Parallel collection/allocation for same dealer unproven in tests |
| Impact | Edge cases under concurrent load |
| Likelihood | Low (dealer lock mirrors invoice pattern) |
| Mitigation | Add tests mirroring PHASE_05C2A invoice suite |
| Status | **Open** |
| Future Phase | Pre-production hardening |

### C2. Dealer Row Lock Serialization

| Attribute | Value |
|-----------|-------|
| Description | Same-dealer financial ops queue under `FOR UPDATE` |
| Impact | Throughput ceiling for high-volume single dealer |
| Likelihood | Medium under heavy same-dealer load |
| Mitigation | Minimal transaction scope; standard ERP trade-off |
| Status | **Accepted** |
| Future Phase | Production monitoring |

### C3. Allocation Race Conditions

| Attribute | Value |
|-----------|-------|
| Description | Concurrent allocation could theoretically exceed pool |
| Impact | Pool invariant violation |
| Likelihood | Low (dealer lock + transaction boundary) |
| Mitigation | `receivedAmount = allocated + unallocated` enforced in transaction |
| Status | **Mitigated** |
| Future Phase | Ongoing |

### C4. Long Transaction Under Dealer Lock

| Attribute | Value |
|-----------|-------|
| Description | Extended lock blocks other financial ops for same dealer |
| Impact | Latency for concurrent operations |
| Likelihood | Low with current scope |
| Mitigation | No external API calls inside financial transactions |
| Status | **Accepted** |

---

## Business Workflow Risks

### B1. Human Accounting Mistakes

| Attribute | Value |
|-----------|-------|
| Description | Wrong allocation, wrong dealer, wrong amount on collection |
| Impact | Incorrect invoice dues; requires reversal |
| Likelihood | Medium (human data entry) |
| Mitigation | Reversal workflow with required reason; audit trail; allocation preview |
| Status | **Mitigated** (reversal available) |

### B2. Collection Reversal Edge Cases

| Attribute | Value |
|-----------|-------|
| Description | Reversal after partial allocation restores all linked invoice fields |
| Impact | Complex state if allocations span many invoices |
| Likelihood | Low |
| Mitigation | `reverseCollection()` reverses per allocation row; certified ADR-021 |
| Status | **Mitigated** |

### B3. Credit Limit Hard Stop

| Attribute | Value |
|-----------|-------|
| Description | No manager override for trusted dealers exceeding limit |
| Impact | Operations blocked until manual intervention |
| Likelihood | Medium for key accounts |
| Mitigation | Future RBAC override with audit (deferred) |
| Status | **Open** |
| Future Phase | Future enhancement |

---

## Printing Risks

### PR1. Invoice >20 Lines Truncation

| Attribute | Value |
|-----------|-------|
| Description | Printed invoice incomplete for >20 line items |
| Impact | Incomplete legal/commercial document |
| Likelihood | Low (most invoices ≤20 lines) |
| Mitigation | Screen warning; detail shows all lines; multi-page deferred |
| Status | **Accepted** (v1) |
| Future Phase | Document enhancement |

### PR2. Browser PDF Variance

| Attribute | Value |
|-----------|-------|
| Description | Layout differences across Chrome/Edge/Firefox print engines |
| Impact | Minor visual inconsistency |
| Likelihood | Medium |
| Mitigation | Accepted by design (ADR-017); test target browsers; optional server PDF |
| Status | **Accepted** |

### PR3. Hardcoded Company Branding

| Attribute | Value |
|-----------|-------|
| Description | Branding changes require code deploy |
| Impact | Slow branding updates |
| Likelihood | Low |
| Mitigation | `getCompanyBranding()` extension point; settings module |
| Status | **Accepted** |

---

## Deployment Risks

### D1. Seed Credentials in Documentation

| Attribute | Value |
|-----------|-------|
| Description | Default admin credentials documented in `NEXT_ACTION.md` |
| Impact | Unauthorized access if deployed without rotation |
| Likelihood | High if prod uses seed password |
| Mitigation | Rotate before production; deployment checklist |
| Status | **Open** (dev only) |

### D2. Migration Drift (Docker)

| Attribute | Value |
|-----------|-------|
| Description | Migrations committed but not applied to runtime DB |
| Impact | Runtime enum/schema errors (seen with `Partially_Delivered`) |
| Likelihood | Medium without CI migrate step |
| Mitigation | `prisma migrate deploy` in deploy pipeline; hotfix documented |
| Status | **Mitigated** (process documented) |

### D3. Netlify / Serverless Constraints

| Attribute | Value |
|-----------|-------|
| Description | Long-running transactions or connection limits on serverless |
| Impact | Financial transaction timeouts |
| Likelihood | Low with minimal transaction scope |
| Mitigation | Keep transactions short; connection pooling |
| Status | **Accepted** |

---

## Testing Limitations

### T1. Integration Tests Require DATABASE_URL

| Attribute | Value |
|-----------|-------|
| Description | Concurrency tests skip without live PostgreSQL |
| Impact | CI may not catch concurrency regressions |
| Likelihood | Medium in lightweight CI |
| Mitigation | Run full suite in Docker CI before release |
| Status | **Open** |

### T2. No E2E Print Layout Automation

| Attribute | Value |
|-----------|-------|
| Description | Print CSS verified manually, not automated |
| Impact | Regressions in PDF layout undetected |
| Likelihood | Medium during document changes |
| Mitigation | Invoice PDF patch includes manual QA checklist |
| Status | **Open** |

### T3. `it.skipIf` Registration-Time Evaluation Gap (found PHASE_07C)

| Attribute | Value |
|-----------|-------|
| Description | `issue-invoice-concurrency.test.ts` and `ledger-reconciliation.integration.test.ts` pass `it.skipIf(!integrationReady)` where `integrationReady` is only set inside an async `beforeAll` — Vitest evaluates the condition at describe-time, before `beforeAll` runs, so these tests always skip regardless of database availability |
| Impact | These specific "integration" tests never actually execute, even in a Docker CI with a live database |
| Likelihood | Certain (structural, not environmental) |
| Mitigation | PHASE_07C's own integration test (`opening-balance-concurrency.integration.test.ts`) uses the correct runtime `ctx.skip()` pattern and was verified to run and pass live. Pre-existing files not modified — outside PHASE_07C scope (TECH_DEBT C8) |
| Status | **Open** (pre-existing files) |
| Future Phase | Test-infrastructure pass |

---

## Future Scaling Concerns

### S1. Missing Composite Indexes

| Attribute | Value |
|-----------|-------|
| Description | Statement and aging queries may slow at scale |
| Impact | Report latency |
| Likelihood | Increases over time |
| Mitigation | Add indexes before PHASE_08 reporting |
| Status | **Open** |
| Future Phase | PHASE_07–08 |

### S2. No Read Replicas

| Attribute | Value |
|-----------|-------|
| Description | All reads hit primary PostgreSQL |
| Impact | Read load on primary at scale |
| Likelihood | Low initially |
| Mitigation | Index optimization; scale when needed |
| Status | **Accepted** |

### S3. Reporting Readiness 7.0/10

| Attribute | Value |
|-----------|-------|
| Description | Management dashboards and analytics not built |
| Impact | Limited executive visibility |
| Likelihood | Certain |
| Mitigation | Certified data model; phased delivery PHASE_08+ |
| Status | **Open** |
| Future Phase | PHASE_08, Analytics |

---

### T4. Full certification requires live database

| Attribute | Value |
|-----------|-------|
| Description | `runFinancialCertification()` live Rules 1–3/5/6/8 skip with warnings when `DATABASE_URL` unreachable |
| Impact | Structural-only score ~7.5/10 without live PostgreSQL |
| Likelihood | Medium in CI without Docker DB |
| Mitigation | Run certification with reachable `DATABASE_URL` before production cutover |
| Status | **Accepted** (by design) |
| Future Phase | CI pipeline with Docker PostgreSQL service |

---

## Cross-References

- ADR-024 §10 — identified risks from certification
- `TECH_DEBT.md` — deferred remediation items
- `FINANCIAL_INVARIANTS.md` — invariants that mitigate several risks
