# Technical Debt Register — Nazma Water Taps ERP

Known deferred improvements categorized by priority. Each item includes rationale for deferral.

**Last updated:** 2026-07-01 (REPOSITORY_MIGRATION_AND_METADATA_DUMP)

---

## Critical

| ID | Item | Description | Why deferred | Risk if ignored | Target |
|----|------|-------------|--------------|-----------------|--------|
| C1 | Ledger posting not implemented | `LedgerEntry` model exists; no rows created | Pipeline required first; ADR-024 certified architecture | No authoritative journal | PHASE_07B |
| C2 | Ledger schema hardening | `referenceType` is String; missing `postingKey`, `postingType`, `reversesEntryId` | Isolated migration before posting logic | Type drift, duplicate entries on retry | PHASE_07A |
| C3 | Invoice void / credit note | Cannot reverse issued invoices | Collections prioritized; compensating model in ADR-024 | Cannot correct receivables in-system | PHASE_07B |
| C4 | Balance reconciliation job | No automated `currentBalance` vs ledger check | Requires ledger posting first | Silent balance drift undetected | PHASE_07E |
| C5 | `postingKey` idempotency | Ledger lacks unique posting key | Ledger not yet posting | Duplicate ledger lines on retry | PHASE_07A–07B |

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
| M8 | Due report UI | `DueReport` model unused | Collections prioritized | No systematic overdue visibility | PHASE_08 |
| M9 | Dealer statement UI | Hybrid architecture designed; no route | Needs ledger for running balance | No account statements | PHASE_07D |
| M10 | Composite DB indexes | Missing `(dealerCode, collectionDate)` etc. | Current volume acceptable | Slow reports at scale | PHASE_07–08 |
| M11 | Credit limit manager override | Hard stop only; no RBAC override | ADR-011 future enhancement | No in-system exceptions | Future |
| M12 | Delivery challan PDF | Basic print only; not document platform | Invoice/receipt prioritized | No enterprise gate pass | Post-06C |
| M13 | Chart of Accounts / full GL | No TB, P&L, BS | AR subledger first | No statutory statements | PHASE_07F+ |
| M14 | Logistics fields on Invoice | Legacy columns may duplicate challan data | Application treats as challan attrs | Schema ambiguity | Cleanup |
| M15 | Opening balance document | Enum reserved; no handler | Needs ledger + onboarding | Cannot migrate existing AR | PHASE_07C |

---

## Low

| ID | Item | Description | Target |
|----|------|-------------|--------|
| L1 | QR codes on documents | `extensionSlot` reserved | Future |
| L2 | Barcode on documents | Not required for B2B v1 | Future |
| L3 | Digital signatures | Placeholder only | Future |
| L4 | Company seal image | Placeholder only | Future |
| L5 | Full modal focus trap | Tab can escape preview modal | A11y polish |
| L6 | Email/SMS document delivery | Not scoped | Post-07 |
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
| Delivery challan printable | ⏳ Deferred | Reuse `DocumentLayout` |
| Dealer statement printable | ⏳ Deferred | Hybrid ledger + documents |
| Credit note printable | ⏳ Deferred | After credit note workflow |

---

## Testing Gaps

| Gap | Priority | Mitigation |
|-----|----------|------------|
| Collection concurrency integration tests | Medium | Mirror `issue-invoice-concurrency.test.ts` |
| Ledger posting integration tests | High (PHASE_07B) | Required before ledger go-live |
| Reconciliation job tests | Medium (PHASE_07E) | Assert balance = ledger = replay |
| E2E print layout tests | Low | Manual QA + browser matrix |

---

## Intentionally Temporary Code

| Location | Temporary aspect | Replacement |
|----------|------------------|-------------|
| `posting-service.ts` | Balance + audit only; no `LedgerEntry` | PHASE_07B ledger wiring |
| `getCompanyBranding()` | Hardcoded defaults | Company settings module |
| `salesPerson` on invoice | Maps to `Dealer.territory` | SR user denormalization |
| `/reports`, `/ledger` nav | Placeholder routes may 404 | PHASE_07–08 modules |

---

## Cross-References

- `KNOWN_RISKS.md` — operational risk register
- `FINANCIAL_INVARIANTS.md` — rules that must not be violated while addressing debt
- ADR-024 §11 — architecture improvements recommended
