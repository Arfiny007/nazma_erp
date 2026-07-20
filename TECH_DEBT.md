# Technical Debt Register — Nazma Water Taps ERP

Known deferred improvements categorized by priority. Each item includes rationale for deferral.

**Last updated:** 2026-07-20 (PHASE_12A.1 — ESLint closure)

### PHASE_12A / 12A.1 notes

| ID | Item | Description | Why deferred | Target |
|----|------|-------------|--------------|--------|
| SR1 | SR Performance Excel export | Screen + HTML/CSS print only | Printable dashboard prioritized | Dashboard/report exports |
| SR2 | Unsupported posting columns | Debit/credit notes excluded from Sales/Collection columns | Client six-column layout frozen; diagnostics warn | Future statement columns |
| SR3 | ~~False territory-overlap warning~~ | ~~Multi-SR territory assignment surfaced as financial warning~~ | **Resolved PHASE_12A.1** — ownership attribution diagnostics only | ✅ DONE |
| SR4 | ~~Pre-existing ESLint `react-hooks/set-state-in-effect` errors~~ | ~~`LanguageContext`, district/territory selects, `territory-assignments-panel` failed `npx eslint .` (4 errors)~~ | **Resolved PHASE_12A.1 ESLint closure** — derived view state + `useSyncExternalStore`; no suppressions | ✅ DONE |

---

## Critical

| ID | Item | Description | Why deferred | Risk if ignored | Target |
|----|------|-------------|--------------|-----------------|--------|
| C1 | ~~Ledger posting not integrated~~ | ~~`createLedgerEntry` shipped in PHASE_07A but not yet called from `posting-service.ts`~~ | **Resolved in PHASE_07B** (ADR-026) | ~~No authoritative journal~~ | ✅ DONE |
| C2 | ~~Ledger schema hardening~~ | ~~`referenceType` is String; missing `postingKey`, `postingType`, `reversesEntryId`~~ | **Resolved in PHASE_07A** (ADR-025) | ~~Type drift, duplicate entries on retry~~ | ✅ DONE |
| C3 | Invoice void / credit note | Cannot reverse issued invoices | Collections prioritized; compensating model in ADR-024 | Cannot correct receivables in-system | Dedicated phase |
| C4 | Balance reconciliation job | Reconciliation helpers + monitor + certification shipped | **Resolved in PHASE_07E4/07F** | Silent drift undetected | ✅ DONE |
| C5 | ~~`postingKey` idempotency~~ | ~~Ledger lacks unique posting key~~ | **Resolved in PHASE_07A** — `postingKey String @unique` | ~~Duplicate ledger lines on retry~~ | ✅ DONE |
| C6 | DB-level ledger immutability | Application-level `assertLedgerAppendOnly` guard only | Runtime guard sufficient for PHASE_07B; DB policy adds defense in depth | Rogue SQL could still UPDATE/DELETE historical rows | Optional |
| C7 | Ledger backfill for pre-PHASE_07B data | Replay engine shipped (PHASE_07E2) | **Resolved in PHASE_07E2** | Legacy data incomplete | ✅ DONE |
| C8 | `it.skipIf` evaluated at registration time in pre-existing integration tests | `issue-invoice-concurrency.test.ts` and `ledger-reconciliation.integration.test.ts` compute `integrationReady` inside `beforeAll` but pass it to `it.skipIf` synchronously at describe-time — always `false` at that point, so these tests always skip even when `DATABASE_URL` is reachable | Discovered while building PHASE_07C's own integration test (which uses the correct `ctx.skip()` runtime pattern instead); fixing the pre-existing files is outside PHASE_07C's forbidden-files scope (Invoice) / out of scope (ledger reconciliation) | CI never actually exercises these "integration" tests even with a live database configured | Test-infrastructure pass |

---

## Medium

| ID | Item | Description | Why deferred | Risk if ignored | Target |
|----|------|-------------|--------------|-----------------|--------|
| M1 | Invoice PDF patch polish | Client feedback on typography, spacing, margins | Scheduled as first post-06C task | Suboptimal print appearance | Invoice PDF Patch |
| M2 | Multi-page invoice (>20 lines) | Print truncates beyond 20 rows | 95%+ invoices fit one page | Incomplete prints for large orders | Post-patch document |
| M3 | Server-side headless PDF | Browser Save-as-PDF varies by browser | Vector HTML acceptable; no Chromium infra | Minor cross-browser variance | Optional |
| M4 | Company settings module | Branding hardcoded in `getCompanyBranding()` | Extension point ready | Branding changes need deploy | Settings phase |
| M5 | Collection concurrency tests | No integration tests mirroring invoice suite | Dealer lock pattern proven on invoice path | Lower confidence under load | Pre-production |
| M6 | Allocation soft-delete on reversal | Rows hard-deleted; history incomplete in DB | Audit preserves amounts | Statement needs audit join | Optional |
| M7 | Dealer analytics population | `totalSales`, activity dates not auto-updated | Reporting not started | Stale dealer profile metrics | Reporting |
| T9 | ~~Collection context territory gap~~ | **Resolved PHASE_08E.1** — `canAccessDealerByCode` on `getDealerCollectionContext` | — | — | — |
| M9 | Dealer statement UI | Hybrid architecture designed; no route | Needs ledger for running balance | No account statements | PHASE_07D |
| M10 | Composite DB indexes | Missing `(dealerCode, collectionDate)` etc. | Current volume acceptable | Slow reports at scale | PHASE_07–08 |
| M11 | Credit limit manager override | Hard stop only; no RBAC override | ADR-011 future enhancement | No in-system exceptions | Future |
| M12 | Delivery challan PDF | Basic print on document platform (PHASE_11E); preview modal + `/print` route | Invoice/receipt prioritized | No enterprise gate pass | Post-06C polish |
| M13 | Chart of Accounts / full GL | No TB, P&L, BS | AR subledger first | No statutory statements | PHASE_07F+ |
| M14 | Logistics fields on Invoice | Legacy columns may duplicate challan data | Application treats as challan attrs | Schema ambiguity | Cleanup |
| M15 | ~~Opening balance document~~ | ~~Enum reserved; no handler~~ | **Resolved in PHASE_07C** (ADR-028) | ~~Cannot migrate existing AR~~ | ✅ DONE |

---

## Low

| ID | Item | Description | Target |
|----|------|-------------|--------|
| L1 | QR codes on documents | `extensionSlot` reserved | Future |
| L2 | Barcode on documents | Not required for B2B v1 | Future |
| L3 | Digital signatures | Placeholder only | Future |
| L4 | Company seal image | Placeholder only | Future |
| L5 | Full modal focus trap | Tab can escape preview modal | A11y polish |
| L6 | Email/SMS document delivery | PHASE_11C delivers auth emails via SMTP worker; certified PHASE_11D; SMS deferred | PHASE_12+ |
| L16 | Notification worker cron scheduling | Manual script + UI process queue; no built-in cron sidecar | Production ops must schedule `process-notifications.ts` |
| L17 | ~~i18n translation flicker on refresh~~ | **Resolved PHASE_11E.1** — bundled dictionaries + locale cookie SSR (ADR-058) | — |
| L7 | Denormalized invoice headers | `dealerName`, `orderNo` on header | Future |
| L8 | Proper SR mapping | `salesPerson` = territory approximation | Reporting |
| L9 | Separate ship-to address | Bill To = Ship To in v1 | Future |
| L10 | Challan return workflow | Cancel only; no return challan | Future |
| L11 | Credit reservation at order | Explicitly deferred per ADR-011 | Future |
| L12 | `useReactTable` ESLint warnings | Pre-existing; non-blocking | Quality sweep |
| L13 | Audit log UI | PHASE_09 | PHASE_09 |
| L14 | User management CRUD | Super Admin seed only | PHASE_10 |
| L15 | Document platform follow-ups | Statement/challan composers | PHASE_07+ |

---

## Document Platform Extraction Follow-Ups

| Item | Status | Notes |
|------|--------|-------|
| Invoice refactored to platform primitives | ✅ Complete | PHASE_06C |
| Money receipt on platform | ✅ Complete | ADR-023 |
| Invoice PDF client feedback patch | ⏳ Pending | No duplicate templates |
| Delivery challan printable | ⏳ Partial | PHASE_11E — `ChallanPrintable` + print route; polish deferred |
| Dealer statement printable | ⏳ Deferred | Hybrid ledger + documents |
| Credit note printable | ⏳ Deferred | After credit note workflow |

---

## Testing Gaps

| Gap | Priority | Mitigation |
|-----|----------|------------|
| Collection concurrency integration tests | Medium | Mirror `issue-invoice-concurrency.test.ts` |
| Ledger posting integration tests | ✅ Delivered (PHASE_07B) | `posting-service.test.ts` (12 unit tests) + concurrency suite extended with ledger assertions |
| Reconciliation job tests | ✅ Delivered (PHASE_07B.5) | `ledger-reconciliation.test.ts` (9) + integration scan |
| Opening balance workflow + validation + concurrency tests | ✅ Delivered (PHASE_07C) | `opening-balance.test.ts` (11), `opening-balance-validation.test.ts` (31), `opening-balance-concurrency.integration.test.ts` (2, live DB — actually runs, see C8) |
| Financial system certification tests | ✅ Delivered (PHASE_07F) | `financial-certification.test.ts` (12) |
| E2E print layout tests | Low | Manual QA + browser matrix |

---

## Intentionally Temporary Code

| Location | Temporary aspect | Replacement |
|----------|------------------|-------------|
| `posting-service.ts` reversal path | Falls back to `reversesEntryId = null` when the original Collection entry cannot be found by `postingKey` (pre-PHASE_07B collections) | PHASE_07E backfill retroactively creates original entries; new reversals from that point always link |
| `assertDealerLedgerReconciled` | ~~Treated empty-ledger + non-zero cache as reconciled~~ | **Resolved in PHASE_07B.5** — empty ledger only when cache = 0 |
| `getCompanyBranding()` | Hardcoded defaults | Company settings module |
| `salesPerson` on invoice | Maps to `Dealer.territory` | SR user denormalization |
| `/reports`, `/ledger` nav | Placeholder routes may 404 | PHASE_07–08 modules |

---

## Cross-References

- `KNOWN_RISKS.md` — operational risk register
- `FINANCIAL_INVARIANTS.md` — rules that must not be violated while addressing debt
- ADR-024 §11 — architecture improvements recommended
