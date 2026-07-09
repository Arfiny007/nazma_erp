# IMPLEMENTATION STATUS

Last updated: 2026-07-09 (PHASE_07A — Enterprise Ledger Foundation)

---

## Enterprise Ledger Foundation — Verification (PHASE_07A)

| Criterion | Status |
|-----------|--------|
| `LedgerEntry` schema hardened per ADR-024 §11 | ✅ |
| `referenceType` → `FinancialReferenceType` enum | ✅ |
| `FinancialReferenceType.Collection` added | ✅ |
| `LedgerPostingType` enum introduced | ✅ |
| `postingKey String @unique` idempotency guard | ✅ |
| `postingType`, `postingDate`, `referenceNo`, `reversesEntryId`, `createdById` added | ✅ |
| Composite indexes `(dealerCode, transactionDate)` / `(dealerCode, postingDate)` | ✅ |
| Prisma migration authored (`20260709000000_phase_07a_ledger_foundation/migration.sql`) | ✅ |
| `src/lib/ledger/posting-key.ts` — deterministic builder/parser | ✅ |
| `src/lib/ledger/ledger-types.ts` — immutable posting contract types | ✅ |
| `src/lib/ledger/ledger-errors.ts` — typed error hierarchy | ✅ |
| `src/lib/ledger/ledger-validation.ts` — structural + sign guards + append-only guard | ✅ |
| `src/lib/ledger/ledger-posting.ts` — `buildLedgerEntryCreateData` + `buildReversalPosting` | ✅ |
| `src/lib/ledger/ledger-service.ts` — `createLedgerEntry` idempotent write path | ✅ |
| `src/lib/ledger/ledger-reconciliation.ts` — reconciliation helpers | ✅ |
| `src/lib/ledger/opening-balance.ts` — PHASE_07C-ready builders | ✅ |
| `src/lib/ledger/index.ts` — public surface | ✅ |
| `posting-service.ts` inputs extended with optional ledger metadata | ✅ |
| `posting-service.ts` bodies unchanged | ✅ |
| `Dealer.currentBalance` remains sole write-path (posting-service only) | ✅ |
| No ledger UI, reports, statements, dashboards | ✅ |
| No data migration; existing LedgerEntry rows unaffected (table empty) | ✅ |
| Unit tests: `posting-key.test.ts` (12) | ✅ |
| Unit tests: `ledger-validation.test.ts` (14) | ✅ |
| Unit tests: `ledger-posting.test.ts` (9) | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors (7 pre-existing TanStack Table warnings) | ✅ |
| `npx vitest run` — 64 passed / 4 skipped (pre-existing DB integration tests) | ✅ |
| ADR-025 authored | ✅ |
| Governance docs updated | ✅ |

### Files Delivered — PHASE_07A

**New:**
- `src/lib/ledger/posting-key.ts`
- `src/lib/ledger/ledger-types.ts`
- `src/lib/ledger/ledger-errors.ts`
- `src/lib/ledger/ledger-validation.ts`
- `src/lib/ledger/ledger-posting.ts`
- `src/lib/ledger/ledger-service.ts`
- `src/lib/ledger/ledger-reconciliation.ts`
- `src/lib/ledger/opening-balance.ts`
- `src/lib/ledger/index.ts`
- `src/lib/ledger/posting-key.test.ts`
- `src/lib/ledger/ledger-validation.test.ts`
- `src/lib/ledger/ledger-posting.test.ts`
- `prisma/migrations/20260709000000_phase_07a_ledger_foundation/migration.sql`
- `docs/ADR/ADR-025-enterprise-ledger-foundation.md`

**Modified:**
- `prisma/schema.prisma` (enum + `LedgerEntry` hardening + `User.ledgerEntriesCreated`)
- `src/lib/finance/types.ts` (`FINANCIAL_REFERENCE_COLLECTION`; optional ledger metadata fields)
- `src/lib/finance/posting-service.ts` (documentation only; bodies unchanged)
- `PROJECT_BRAIN.md`, `CURRENT_PHASE.md`, `IMPLEMENTATION_STATUS.md`, `NEXT_ACTION.md`, `CHANGELOG.md`, `SYSTEM_CONTEXT.md`, `TECH_DEBT.md`, `KNOWN_RISKS.md`, `FINANCIAL_INVARIANTS.md`, `CLIENT_FEEDBACK_LOG.md`

### Regression Verification — PHASE_07A

| Suite | Result |
|-------|--------|
| `src/lib/delivery/workflow.test.ts` | ✅ 9 pass |
| `src/lib/invoices/workflow.test.ts` | ✅ 9 pass |
| `src/lib/collections/workflow.test.ts` | ✅ 11 pass |
| `src/lib/ledger/posting-key.test.ts` | ✅ 12 pass (new) |
| `src/lib/ledger/ledger-validation.test.ts` | ✅ 14 pass (new) |
| `src/lib/ledger/ledger-posting.test.ts` | ✅ 9 pass (new) |
| `src/lib/invoices/issue-invoice-concurrency.test.ts` | ⏭ 4 skipped (DATABASE_URL not set — pre-existing behavior) |

---

## Enterprise Document Platform Design Freeze — Verification (PHASE_06D.2)

| Criterion | Status |
|-----------|--------|
| Design tokens file created (`src/lib/documents/design-tokens.ts`) | ✅ |
| Enterprise header — 32pt font-black company name, vertical rule, T/E/W address | ✅ |
| Stronger document title — 17pt font-black, 0.12em tracking | ✅ |
| Dealer section simplified — single "Dealer Information" block | ✅ |
| Product table col-name width increased to 42% | ✅ |
| Tabular numerals on qty / price / amount / financial summary columns | ✅ |
| Financial summary grouped — divider between Invoice Amount / Due Summary | ✅ |
| Payment terms removed from invoice printable | ✅ |
| Professional notes — "Terms & Conditions" business language | ✅ |
| Single Authorized By signature (one blank line) | ✅ |
| Enterprise footer — blue bar + Confidential label + thank-you message | ✅ |
| DocumentLabels type updated (authorizedBy, dealerInfo fields added) | ✅ |
| EN localization updated with new keys | ✅ |
| BN localization updated with new keys | ✅ |
| Preview equals print equals PDF (single pipeline) | ✅ |
| No business logic changes | ✅ |
| No financial logic changes | ✅ |
| No duplicate components introduced | ✅ |
| No invoice-specific CSS hacks | ✅ |
| Money Receipt pipeline unaffected | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors | ✅ |

### Files Modified — PHASE_06D.2

**New file:** `src/lib/documents/design-tokens.ts`

**Document platform components:**
- `src/components/documents/branding/company-header.tsx`
- `src/components/documents/branding/company-footer.tsx`
- `src/components/documents/sections/document-title.tsx`
- `src/components/documents/sections/document-financial-summary.tsx`
- `src/components/documents/sections/financial-summary.tsx`
- `src/components/documents/sections/invoice-metadata.tsx`
- `src/components/documents/styles/document-print.css`
- `src/components/documents/invoice/invoice-printable.tsx`

**Types / localization:**
- `src/types/document.ts` (DocumentLabels extended: authorizedBy, dealerInfo)
- `public/locales/en/common.json`
- `public/locales/bn/common.json`

**Governance:** `PROJECT_BRAIN.md`, `CURRENT_PHASE.md`, `IMPLEMENTATION_STATUS.md`, `NEXT_ACTION.md`, `CHANGELOG.md`, `CLIENT_FEEDBACK_LOG.md`

---

## Invoice PDF Client Revision — Verification (PHASE_06D.1)

| Criterion | Status |
|-----------|--------|
| Company name enlarged (Nazma); WATER TAPS subtitle | ✅ |
| Dynamic product rows — no placeholder padding | ✅ |
| Discount column removed from printable invoice | ✅ |
| VAT row removed from printable financial summary | ✅ |
| Due Date removed from printable metadata | ✅ |
| Sales person = Sales Order `createdBy.name` | ✅ |
| Blank signature areas (Prepared / Checked / Authorized) | ✅ |
| Preview equals print equals PDF (single pipeline) | ✅ |
| No business logic changes | ✅ |
| No financial logic changes | ✅ |
| ADR-017 / ADR-018 updated | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors | ✅ |

### Files Modified — PHASE_06D.1

**Document platform:** `company-header.tsx`, `product-table.tsx`, `financial-summary.tsx`, `invoice-metadata.tsx`, `document-signature.tsx`, `document-table.tsx`, `invoice-printable.tsx`, `document-print.css`

**Document loader:** `src/lib/actions/invoices/helpers.ts` (order `createdBy` for sales person)

**Types / localization:** `src/types/document.ts`, `src/types/invoice.ts`, `public/locales/en/common.json`, `public/locales/bn/common.json`

**Governance:** `PROJECT_BRAIN.md`, `CURRENT_PHASE.md`, `IMPLEMENTATION_STATUS.md`, `NEXT_ACTION.md`, `CHANGELOG.md`, `CLIENT_FEEDBACK_LOG.md`, ADR-017, ADR-018

---

## Financial Architecture Certification — Verification (PHASE_06D)

| Criterion | Status |
|-----------|--------|
| Full pipeline reviewed (Order → Challan → Invoice → Collection → Posting) | ✅ |
| Source-of-truth hierarchy documented | ✅ |
| Financial Posting Service strategy for all future operations | ✅ |
| Future Ledger architecture designed (not implemented) | ✅ |
| Dealer statement hybrid architecture defined | ✅ |
| Generic allocation certified — no redesign required | ✅ |
| Advance payment / negative AR certified | ✅ |
| Reporting readiness assessed (operational + financial statement gaps) | ✅ |
| 10 accounting rules re-verified | ✅ |
| Identified risks documented (none blocking) | ✅ |
| Architecture improvements recommended | ✅ |
| PHASE_07 breakdown (07A–07F) recommended | ✅ |
| ADR-024 created | ✅ |
| No code, migrations, or UI changes | ✅ |
| Overall ERP production readiness score | **8.7 / 10** |

### Subsystem Scores — PHASE_06D

| Subsystem | Score |
|-----------|-------|
| Orders | 9.0 |
| Delivery | 9.0 |
| Invoice | 9.0 |
| Collections | 9.2 |
| Money Receipt | 9.0 |
| Document Engine | 9.0 |
| Financial Posting | 8.5 |
| Generic Allocation | 8.5 |
| Advance Payment | 9.0 |
| Audit | 8.0 |
| Security | 8.5 |
| Scalability | 7.5 |
| Ledger Readiness | 8.5 |
| Reporting Readiness | 7.0 |

### Files Created — PHASE_06D

```
docs/ADR/ADR-024-financial-architecture-certification.md
```

### Files Modified — PHASE_06D

```
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Enterprise Money Receipt Engine — Verification (PHASE_06C)

| Criterion | Status |
|-----------|--------|
| Document platform primitives extracted | ✅ |
| Invoice refactored to shared platform | ✅ |
| `MoneyReceiptPrintable` single pipeline | ✅ |
| Preview equals print equals PDF | ✅ |
| Route `/collections/[id]/receipt` | ✅ |
| Draft collections blocked | ✅ |
| Reversed collections blocked | ✅ |
| Allocation summary displayed | ✅ |
| Advance-retained message (no allocations) | ✅ |
| Server-sourced financial values only | ✅ |
| Responsive preview (desktop/tablet/mobile) | ✅ |
| Bilingual localization | ✅ |
| ADR-023 created | ✅ |
| `npx prisma generate` | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors | ✅ |

### Routes — PHASE_06C

| Route | Status |
|-------|--------|
| `/collections/[id]/receipt` | ✅ |

### Files Created — PHASE_06C

**Document platform:** `src/components/documents/sections/document-*.tsx`, `src/components/documents/toolbar/document-print-toolbar.tsx`

**Money receipt:** `src/components/documents/money-receipt/*`, `src/lib/documents/map-collection-receipt.ts`, `src/lib/documents/load-money-receipt.ts`

**Pages:** `src/app/(dashboard)/collections/[id]/receipt/*`

**Components:** `src/components/collections/collection-document-actions.tsx`

**Documentation:** `docs/ADR/ADR-023-enterprise-money-receipt-engine.md`

### Files Modified — PHASE_06C

- `src/components/documents/invoice/invoice-printable.tsx`
- `src/components/documents/sections/*` (invoice metadata, product table, financial summary, legacy re-exports)
- `src/components/documents/styles/document-print.css`
- `src/components/collections/collection-detail-view.tsx`, `collection-table.tsx`
- `src/types/document.ts`, `src/types/collection.ts`
- `src/lib/collections/workflow.ts`
- `src/lib/actions/collections/helpers.ts`
- `public/locales/en/common.json`, `public/locales/bn/common.json`
- Governance docs

---

## Enterprise Collections UI — Verification (PHASE_06B)

| Criterion | Status |
|-----------|--------|
| Collection list with enterprise data table | ✅ |
| Search, pagination, sorting, filters | ✅ |
| Create / edit Draft workspace | ✅ |
| Confirm collection workflow | ✅ |
| Allocation workspace + server preview | ✅ |
| Advance payment visualization | ✅ |
| Detail view + audit timeline | ✅ |
| Reversal UX with required reason | ✅ |
| RBAC via existing permissions | ✅ |
| Bilingual localization | ✅ |
| ADR-022 created | ✅ |
| `npx prisma generate` | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors | ✅ |

### Routes — PHASE_06B

| Route | Status |
|-------|--------|
| `/collections` | ✅ |
| `/collections/new` | ✅ |
| `/collections/[id]` | ✅ |
| `/collections/[id]/edit` | ✅ |
| `/collections/[id]/allocate` | ✅ |

### Files Created — PHASE_06B

**Pages:** `src/app/(dashboard)/collections/**` (list, new, detail, edit, allocate)

**Components:** `src/components/collections/*` (table, workspace, detail, allocation, advance, reverse, history, filters, skeleton)

**Server actions:** `src/lib/actions/collections/get-dealer-collection-context.ts`

**Documentation:** `docs/ADR/ADR-022-enterprise-collections-ui.md`

### Files Modified — PHASE_06B

- `src/types/collection.ts`
- `src/lib/actions/collections/helpers.ts`
- `public/locales/en/common.json`, `public/locales/bn/common.json`
- Governance docs

---

## Collection Financial Certification — Verification (PHASE_06A3)

| Criterion | Status |
|-----------|--------|
| Full audit: create / confirm / allocate / deallocate / reverse | ✅ |
| 10 accounting rules verified with evidence | ✅ |
| Allocation engine + posting service + schema reviewed | ✅ |
| Statement reconstruction analysis | ✅ |
| Ledger readiness (PHASE_07) | ✅ — no refactor required |
| Reporting readiness (Due, Cash Book, Area/Territory) | ✅ |
| Concurrency re-check (dealer lock, idempotency) | ✅ |
| Allocation cap defect remediated | ✅ |
| ADR-021 created | ✅ |
| Production readiness score | **9.2 / 10** |
| Collections UI readiness | ✅ **CERTIFIED** |
| `npm test` — pass | ✅ |

### Remediated Defect — PHASE_06A3

| Issue | Fix |
|-------|-----|
| `computeInvoiceOutstanding` used `currentDue − collectionReceived`, double-counting allocations | Cap on `grandTotal − collectionReceived`; guard in `applyInvoiceAllocation()` |

### Files Created — PHASE_06A3

```
docs/ADR/ADR-021-collection-financial-certification.md
```

### Files Modified — PHASE_06A3

```
src/lib/collections/workflow.ts
src/lib/collections/reference-resolver.ts
src/lib/collections/workflow.test.ts
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Collection Engine — Verification (PHASE_06A2)

| Criterion | Status |
|-----------|--------|
| `createCollection` / `updateCollection` / `confirmCollection` | ✅ |
| `cancelDraftCollection` / `reverseCollection` | ✅ |
| `getCollection` / `listCollections` | ✅ |
| `previewCollectionAllocation` / `allocateCollection` / `deallocateCollection` | ✅ |
| Generic allocation engine (`FinancialReferenceType` — Invoice) | ✅ |
| `postReceivableDecrease()` + `postReceivableDecreaseReversal()` | ✅ |
| Amount invariant `receivedAmount = allocatedAmount + unallocatedAmount` | ✅ |
| Advance payment / negative dealer AR balance | ✅ |
| Partial + multiple invoice allocation | ✅ |
| Duplicate allocation blocked | ✅ |
| Reversal restores invoice dues + dealer balance | ✅ |
| Collection immutable after confirmation | ✅ |
| Dealer row lock on financial mutations | ✅ |
| Idempotent confirmation | ✅ |
| Audit events (COLLECTION_*, DEALER_BALANCE_DECREASED) | ✅ |
| ADR-020 created | ✅ |
| No UI / receipt PDF / ledger / reports | ✅ |
| `npx prisma generate` — OK | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors | ✅ |
| `npm test` — pass | ✅ |

### Files Created — PHASE_06A2

```
src/lib/utils/collection-number.ts
src/lib/collections/workflow.ts
src/lib/collections/workflow.test.ts
src/lib/collections/reference-resolver.ts
src/lib/collections/allocation-engine.ts
src/lib/actions/collections/helpers.ts
src/lib/actions/collections/create-collection.ts
src/lib/actions/collections/update-collection.ts
src/lib/actions/collections/confirm-collection.ts
src/lib/actions/collections/cancel-draft-collection.ts
src/lib/actions/collections/reverse-collection.ts
src/lib/actions/collections/get-collection.ts
src/lib/actions/collections/list-collections.ts
src/lib/actions/collections/preview-collection-allocation.ts
src/lib/actions/collections/allocate-collection.ts
src/lib/actions/collections/deallocate-collection.ts
docs/ADR/ADR-020-collection-engine.md
```

### Files Modified — PHASE_06A2

```
src/lib/finance/types.ts
src/lib/finance/posting-service.ts
src/types/collection.ts
src/lib/validators/collection.schema.ts
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Collections Schema Foundation — Verification (PHASE_06A1)

| Criterion | Status |
|-----------|--------|
| `Collection` model — enterprise cash-receipt design | ✅ |
| `CollectionAllocation` — generic polymorphic allocation | ✅ |
| `CollectionStatus` enum (Draft → Confirmed → PartiallyAllocated → Allocated → Reversed) | ✅ |
| `CollectionPaymentMethod` enum | ✅ |
| `FinancialReferenceType` enum (Invoice + future document types) | ✅ |
| Legacy `Collection` model replaced (no direct `invoiceId`) | ✅ |
| `Invoice.collections` direct relation removed | ✅ |
| Dealer foundation fields (`monthlyTarget`, `yearlyTarget`, `totalSales`, `lastCollectionDate`, `lastInvoiceDate`) | ✅ |
| AR Balance semantics documented (`Dealer.currentBalance`) | ✅ |
| DTO layer — `CollectionDTO`, `CollectionDetailDTO`, `CollectionAllocationDTO`, `DealerFinancialSummaryDTO`, `AdvancePaymentSummaryDTO`, `CollectionListItemDTO` | ✅ |
| Validator schemas — create, update, list, identifier, allocation preview, reversal | ✅ |
| ADR-019 created | ✅ |
| No server actions / allocation engine / posting / UI | ✅ |
| `npx prisma format` — OK | ✅ |
| `npx prisma generate` — OK | ✅ |
| `npx prisma migrate dev` — OK | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors | ✅ |

### Schema Changes — PHASE_06A1

| Model / Enum | Change |
|--------------|--------|
| `CollectionStatus` (enum) | **New** — Draft, Confirmed, PartiallyAllocated, Allocated, Reversed |
| `CollectionPaymentMethod` (enum) | **New** — Cash, Bank, Cheque, MobileBanking, OnlineTransfer, Other |
| `FinancialReferenceType` (enum) | **New** — Invoice, OpeningBalance, CreditNote, DebitNote, ManualAdjustment, JournalEntry |
| `Collection` | **Replaced** — `collectionNo`, amount pool fields, confirmation/reversal metadata, no `invoiceId` |
| `CollectionAllocation` | **New** — polymorphic `(referenceType, referenceId)` allocation rows |
| `Dealer` | + `monthlyTarget`, `yearlyTarget`, `totalSales`, `lastCollectionDate`, `lastInvoiceDate`; AR comment on `currentBalance` |
| `Invoice` | − `collections` direct relation |
| `User` | + `collectionsCreated`, `collectionsConfirmed` relations |

### Files Created — PHASE_06A1

```
src/types/collection.ts
src/lib/validators/collection.schema.ts
docs/ADR/ADR-019-collections-foundation.md
prisma/migrations/20250628120000_collections_schema_foundation/migration.sql
```

### Files Modified — PHASE_06A1

```
prisma/schema.prisma
src/lib/finance/types.ts
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Enterprise Invoice QA — Verification (PHASE_05D3)

| Criterion | Status |
|-----------|--------|
| Full pipeline certified (Order → Challan → Issue → Preview → Print → PDF) | ✅ |
| Financial values consistent across all surfaces | ✅ |
| Previous Due / Current Due / Outstanding correct | ✅ |
| InvoiceItem snapshot integrity | ✅ |
| Product table 1–20 rows — no clipping / overlap | ✅ |
| Print CSS — A4, scale reset, color-adjust | ✅ |
| Payment terms aligned with `INVOICE_DEFAULT_DUE_DAYS` (30) | ✅ |
| Detail UI shows `collectionReceived` + `outstanding` | ✅ |
| Issue preview includes VAT row | ✅ |
| Centralized money formatting (`useFormatMoney`) | ✅ |
| Dead code removed (DocumentRenderContext, placeholders) | ✅ |
| Accessibility — table scope, dialog focus, timeline aria | ✅ |
| ADR-018 created | ✅ |
| Production readiness score | **9.0 / 10** |
| Collections readiness | ✅ CERTIFIED |
| `npx prisma generate` — OK | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors | ✅ |

### Files Created — PHASE_05D3

```
src/lib/utils/use-format-money.ts
docs/ADR/ADR-018-invoice-production-certification.md
```

### Files Modified — PHASE_05D3

```
src/lib/utils/format-money.ts
src/lib/documents/use-document-print.ts
src/types/document.ts
src/components/documents/styles/document-print.css
src/components/documents/sections/product-table.tsx
src/components/documents/sections/financial-summary.tsx
src/components/documents/invoice/invoice-printable.tsx
src/components/documents/invoice/invoice-document-preview.tsx
src/components/invoices/invoice-detail-view.tsx
src/components/invoices/invoice-totals-card.tsx
src/components/invoices/invoice-financial-summary.tsx
src/components/invoices/invoice-items-table.tsx
src/components/invoices/invoice-table.tsx
src/components/invoices/invoice-timeline.tsx
src/components/invoices/issue-invoice-dialog.tsx
src/app/(dashboard)/invoices/issue/page-client.tsx
public/locales/en/common.json
public/locales/bn/common.json
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Enterprise Document Engine — Verification (PHASE_05D2)

| Criterion | Status |
|-----------|--------|
| Reusable `DocumentLayout` + section components | ✅ |
| `InvoicePrintable` — single preview / print / PDF pipeline | ✅ |
| Invoice preview modal on detail page | ✅ |
| `/invoices/[id]/print` dedicated print route | ✅ |
| Browser print + Save-as-PDF (vector HTML/CSS) | ✅ |
| A4 print CSS — 20-row product table, no overflow | ✅ |
| Company branding from `getCompanyBranding()` | ✅ |
| Financial values from backend only — no client math | ✅ |
| `outstanding` computed server-side | ✅ |
| Bank details omitted per approved design | ✅ |
| EN + BN localization (`document.*`) | ✅ |
| ADR-017 created | ✅ |
| `npx prisma generate` — OK | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors | ✅ |

### Files Created — PHASE_05D2

```
public/branding/nazma-logo.png
src/types/document.ts
src/lib/documents/company-branding.ts
src/lib/documents/map-invoice-document.ts
src/lib/documents/use-document-print.ts
src/lib/utils/format-money.ts
src/components/documents/layout/document-layout.tsx
src/components/documents/branding/company-header.tsx
src/components/documents/branding/company-footer.tsx
src/components/documents/sections/invoice-title.tsx
src/components/documents/sections/invoice-metadata.tsx
src/components/documents/sections/bill-to-section.tsx
src/components/documents/sections/ship-to-section.tsx
src/components/documents/sections/product-table.tsx
src/components/documents/sections/financial-summary.tsx
src/components/documents/sections/notes-section.tsx
src/components/documents/sections/payment-terms.tsx
src/components/documents/sections/signature-section.tsx
src/components/documents/invoice/invoice-printable.tsx
src/components/documents/invoice/invoice-document-preview.tsx
src/components/documents/styles/document-print.css
src/app/(dashboard)/invoices/[id]/print/page.tsx
src/app/(dashboard)/invoices/[id]/print/page-client.tsx
docs/ADR/ADR-017-enterprise-document-engine.md
```

### Files Modified — PHASE_05D2

```
src/types/invoice.ts
src/lib/actions/invoices/helpers.ts
src/components/invoices/invoice-actions.tsx
src/components/invoices/invoice-timeline.tsx
src/app/layout.tsx
public/locales/en/common.json
public/locales/bn/common.json
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Enterprise Invoice UI — Verification (PHASE_05D1)

| Criterion | Status |
|-----------|--------|
| List: search / status / dealer / date filters | ✅ |
| List: sorting + pagination + status badges | ✅ |
| Detail: header / metadata / dealer / items / financial summary | ✅ |
| Detail: audit timeline + commercial pipeline visualization | ✅ |
| Detail: PDF placeholder (no implementation) | ✅ |
| Issue: `/invoices/issue` — eligible challan picker + server preview | ✅ |
| Issue: challan detail dialog + navigate to detail on success | ✅ |
| No client-side money calculation | ✅ |
| RBAC: middleware + page guard + conditional render | ✅ |
| EN + BN localization (`invoice.*`) | ✅ |
| ADR-016 created | ✅ |
| `npx prisma generate` — OK | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors | ✅ |

### Files Created — PHASE_05D1

```
src/lib/actions/invoices/preview-invoice-from-challan.ts
src/lib/actions/invoices/list-invoice-eligible-challans.ts
src/components/invoices/invoice-table.tsx
src/components/invoices/invoice-status-badge.tsx
src/components/invoices/invoice-empty-state.tsx
src/components/invoices/invoice-skeleton.tsx
src/components/invoices/invoice-search.tsx
src/components/invoices/invoice-filters.tsx
src/components/invoices/invoice-detail-view.tsx
src/components/invoices/invoice-header-card.tsx
src/components/invoices/invoice-metadata-card.tsx
src/components/invoices/invoice-dealer-card.tsx
src/components/invoices/invoice-items-table.tsx
src/components/invoices/invoice-totals-card.tsx
src/components/invoices/invoice-financial-summary.tsx
src/components/invoices/invoice-history-timeline.tsx
src/components/invoices/invoice-timeline.tsx
src/components/invoices/invoice-actions.tsx
src/components/invoices/issue-invoice-dialog.tsx
src/components/invoices/eligible-challan-combobox.tsx
src/app/(dashboard)/invoices/page.tsx
src/app/(dashboard)/invoices/[id]/page.tsx
src/app/(dashboard)/invoices/[id]/page-client.tsx
src/app/(dashboard)/invoices/issue/page.tsx
src/app/(dashboard)/invoices/issue/page-client.tsx
docs/ADR/ADR-016-enterprise-invoice-ui.md
```

### Files Modified — PHASE_05D1

```
src/types/invoice.ts
src/lib/validators/invoice.schema.ts
src/lib/actions/invoices/helpers.ts
src/lib/actions/invoices/issue-invoice.ts
src/components/delivery-challans/challan-detail-view.tsx
middleware.ts
public/locales/en/common.json
public/locales/bn/common.json
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Financial Concurrency Hotfix — Verification (PHASE_05C2A)

| Criterion | Status |
|-----------|--------|
| Dealer row lock (`FOR UPDATE`) before balance read | ✅ |
| Atomic `currentBalance` increment in posting service | ✅ |
| `previousDue` from locked snapshot only | ✅ |
| Credit limit after dealer lock | ✅ |
| Single `prisma.$transaction` boundary preserved | ✅ |
| Idempotent challan re-issue (no duplicate invoices) | ✅ |
| `P2002` on `deliveryChallanId` resolves existing invoice | ✅ |
| Concurrency integration tests | ✅ (requires `DATABASE_URL`) |
| `npx prisma generate` — OK | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors | ✅ |
| `npm test` — pass | ✅ |

### Files Created — PHASE_05C2A

```
src/lib/finance/dealer-lock.ts
src/lib/invoices/issue-invoice-transaction.ts
src/lib/invoices/issue-invoice-concurrency.test.ts
```

### Files Modified — PHASE_05C2A

```
src/lib/finance/posting-service.ts
src/lib/finance/types.ts
src/lib/actions/invoices/issue-invoice.ts
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
docs/ADR/ADR-015-financial-integrity-audit.md
```

---

## Financial Integrity Audit — Verification (PHASE_05C2)

| Criterion | Status |
|-----------|--------|
| 13-point pipeline review completed | ✅ |
| InvoiceItem snapshot immutability verified | ✅ PASS |
| Single `currentBalance` write path (`posting-service.ts`) | ✅ PASS |
| `previousDue` / `currentDue` strategy validated | ✅ PASS |
| Credit limit at invoice issue only | ✅ PASS |
| `issueInvoice()` single transaction boundary | ✅ PASS |
| One challan → one invoice enforcement | ✅ PASS |
| Delivery challan non-financial boundary | ✅ PASS |
| Ledger / Collections extension points | ✅ PASS |
| Audit trail (`INVOICE_CREATED`, `DEALER_BALANCE_UPDATED`) | ✅ PASS |
| **Dealer balance concurrency (lost update)** | ✅ **REMEDIATED (PHASE_05C2A)** |
| ADR-015 created | ✅ |
| Production readiness score | **7.5 / 10** → concurrency fix applied |

### Files Created — PHASE_05C2

```
docs/ADR/ADR-015-financial-integrity-audit.md
```

### Files Modified — PHASE_05C2

```
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Invoice Engine Backend — Verification (PHASE_05C1)

| Criterion | Status |
|-----------|--------|
| `InvoiceItem` model + migration | ✅ |
| `issueInvoice` — Confirmed challan only | ✅ |
| Draft / Cancelled challan blocked | ✅ |
| Duplicate invoice blocked (`deliveryChallanId` unique) | ✅ |
| Quantities from DeliveryChallanItem only | ✅ |
| Immutable InvoiceItem snapshots | ✅ |
| `previousDue` snapshot from `Dealer.currentBalance` | ✅ |
| `currentDue` = `previousDue + grandTotal` persisted | ✅ |
| Financial Posting Service — sole balance mutation | ✅ |
| Credit limit at invoice issue only | ✅ |
| `INVOICE_CREATED` + `DEALER_BALANCE_UPDATED` audit | ✅ |
| `getInvoice` / `listInvoices` | ✅ |
| No LedgerEntry / Collections / UI | ✅ |
| ADR-014 created | ✅ |
| `npx prisma generate` — OK | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors | ✅ |
| `npm test` — pass | ✅ |

### Files Created — PHASE_05C1

```
prisma/migrations/20250625120000_add_invoice_item/migration.sql
src/types/invoice.ts
src/lib/validators/invoice.schema.ts
src/lib/utils/invoice-number.ts
src/lib/utils/invoice-calculator.ts
src/lib/invoices/workflow.ts
src/lib/invoices/workflow.test.ts
src/lib/finance/types.ts
src/lib/finance/posting-service.ts
src/lib/actions/invoices/helpers.ts
src/lib/actions/invoices/issue-invoice.ts
src/lib/actions/invoices/get-invoice.ts
src/lib/actions/invoices/list-invoices.ts
docs/ADR/ADR-014-invoice-engine.md
```

### Files Modified — PHASE_05C1

```
prisma/schema.prisma
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Hotfix — OrderStatus Enum Migration (2026-06-25)

| Criterion | Status |
|-----------|--------|
| Root cause identified — migration file present, DB not applied | ✅ |
| Migration `20250625110000_add_partially_delivered_status` applied (Docker) | ✅ |
| `prisma migrate status` — 3/3 migrations, schema up to date | ✅ |
| `prisma generate` — Prisma Client regenerated | ✅ |
| PostgreSQL `OrderStatus` includes `Partially_Delivered` | ✅ |
| Eligible-order query (`Approved` + `Partially_Delivered`) succeeds | ✅ |
| `/reports`, `/ledger` 404 — nav placeholders for unbuilt modules | ✅ (not a challan bug) |
| No new features; no Invoice Engine | ✅ |

### Cause

PHASE_05A2 added `Partially_Delivered` to `schema.prisma` and committed migration SQL, but `prisma migrate deploy` was not run against the Docker database after `20250625100000_add_delivery_challan`. Queries filtering by `Partially_Delivered` failed at the PostgreSQL enum layer.

### Files Modified — HOTFIX

```
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| PHASE_01_FOUNDATION | Project scaffold, layout, localization | ✅ COMPLETE |
| PHASE_02A_DEALER_BACKEND | Dealer domain: types, validators, CRUD | ✅ COMPLETE |
| PHASE_02B_DEALER_LIST_UI | Dealer list with table, search, pagination | ✅ COMPLETE |
| PHASE_02C_DEALER_FORMS | New/Edit dealer forms | ✅ COMPLETE |
| PHASE_03A_PRODUCT_BACKEND | Product domain: Category + Product models, CRUD | ✅ COMPLETE |
| PHASE_03A_REVIEW_PRODUCT_SEEDS | Product category seeds (12 categories, 20 products) | ✅ COMPLETE |
| PHASE_03B_PRODUCT_LIST_UI | Product list with table, search, pagination | ✅ COMPLETE |
| PHASE_03C_PRODUCT_FORMS | Product create/edit forms, deactivate workflow | ✅ COMPLETE |
| PHASE_00B_SCHEMA_HARDENING | Full Prisma schema with all domain models | ✅ COMPLETE |
| PHASE_AUTH_01_FOUNDATION | Auth.js v5 Credentials, login page, middleware, seed | ✅ COMPLETE |
| PHASE_AUTH_02_RBAC | Role-Based Access Control, permission matrix, guards, 403 page | ✅ COMPLETE |
| PHASE_00C_INVOICE_RELATION_CORRECTION | Invoice ↔ SalesOrder corrected to one-to-many | ✅ COMPLETE |
| PHASE_04A_ORDER_BACKEND | Sales Order backend: validators, DTOs, actions, calc engine, workflow, audit | ✅ COMPLETE |
| PHASE_04B_ORDER_UI | Sales Order UI: list, create/edit forms, detail, live summary, approval workflow | ✅ COMPLETE |
| PHASE_04C_ORDER_COMBOBOX_DIAGNOSTICS | DealerCombobox: transport error boundary + OrderFormSection overflow/stacking visibility fix | ✅ COMPLETE |
| PHASE_05A_DELIVERY_CHALLAN_BACKEND | Delivery Challan foundation: DTOs, validators, workflow guards, ADR-012 | ✅ COMPLETE |
| PHASE_05A1_DELIVERY_CHALLAN_SCHEMA | Delivery Challan Prisma models + migration | ✅ COMPLETE |
| PHASE_05A2_DELIVERY_CHALLAN_ACTIONS | Server actions, challan number generator, order integration, tests | ✅ COMPLETE |
| **PHASE_05B_DELIVERY_CHALLAN_UI** | Delivery Challan UI: list, create/edit, detail, fulfillment viz, workflow | **✅ COMPLETE** |
| **PHASE_05C1_INVOICE_ENGINE_BACKEND** | Invoice backend from challan + mandatory InvoiceItem + financial posting | **✅ COMPLETE** |
| **PHASE_05C2_FINANCIAL_INTEGRITY_AUDIT** | Pre-production accounting review; ADR-015 | **✅ COMPLETE** |
| **PHASE_05C2A_FINANCIAL_CONCURRENCY_HOTFIX** | Dealer lock, atomic balance, idempotency, concurrency tests | **✅ COMPLETE** |

---

## Delivery Challan UI — Verification (PHASE_05B)

| Criterion | Status |
|-----------|--------|
| List: search / status / dealer / date filters | ✅ |
| List: sorting + pagination + status badges + Created By | ✅ |
| Create: eligible order picker (Approved / Partially_Delivered) | ✅ |
| Create: line grid with ordered / delivered / remaining / allocatable cap | ✅ |
| Create: live fulfillment summary sidebar | ✅ |
| Create: Save Draft + Confirm Dispatch | ✅ |
| Detail: header / dealer / order / logistics / items / audit | ✅ |
| Detail: per-line + order fulfillment progress bars | ✅ |
| Detail: Confirm / Cancel workflow (Draft only) | ✅ |
| Edit: Draft only; Confirmed redirects to detail | ✅ |
| Print support on detail page | ✅ |
| RBAC: middleware + page guard + conditional render (`orders:*`) | ✅ |
| EN + BN localization (`challan.*`) | ✅ |
| No Prisma schema change | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors (1 pre-existing useReactTable warning) | ✅ |
| ADR-013 created | ✅ |

### Files Created — PHASE_05B

```
src/lib/delivery/quantity-client.ts
src/lib/actions/delivery-challans/get-order-challan-context.ts
src/lib/actions/delivery-challans/get-challan-detail-lines.ts
src/components/delivery-challans/challan-table.tsx
src/components/delivery-challans/challan-form.tsx
src/components/delivery-challans/challan-detail-view.tsx
src/components/delivery-challans/challan-status-badge.tsx
src/components/delivery-challans/challan-empty-state.tsx
src/components/delivery-challans/challan-line-editor.tsx
src/components/delivery-challans/challan-fulfillment-summary.tsx
src/components/delivery-challans/fulfillment-progress-bar.tsx
src/components/delivery-challans/challan-workflow-actions.tsx
src/components/delivery-challans/challan-history-timeline.tsx
src/components/delivery-challans/eligible-order-combobox.tsx
src/app/(dashboard)/delivery-challans/page.tsx
src/app/(dashboard)/delivery-challans/new/page.tsx
src/app/(dashboard)/delivery-challans/new/page-client.tsx
src/app/(dashboard)/delivery-challans/[id]/page.tsx
src/app/(dashboard)/delivery-challans/[id]/page-client.tsx
src/app/(dashboard)/delivery-challans/[id]/edit/page.tsx
src/app/(dashboard)/delivery-challans/[id]/edit/page-client.tsx
docs/ADR/ADR-013-delivery-challan-ui.md
```

### Files Modified — PHASE_05B

```
src/types/delivery-challan.ts
src/lib/actions/delivery-challans/helpers.ts
src/lib/actions/delivery-challans/get-delivery-challan.ts
src/lib/actions/delivery-challans/create-delivery-challan.ts
src/lib/actions/delivery-challans/update-delivery-challan.ts
src/lib/actions/delivery-challans/confirm-delivery-challan.ts
src/lib/actions/delivery-challans/cancel-delivery-challan.ts
middleware.ts
src/lib/navigation.ts
public/locales/en/common.json
public/locales/bn/common.json
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Delivery Challan Actions — Verification (PHASE_05A2)

| Criterion | Status |
|-----------|--------|
| Six server actions with RBAC + transactions | ✅ |
| `CHL-NNNNNN` generator | ✅ |
| Workflow guards + quantity reconciliation (ADR-012) | ✅ |
| Order status sync (Partially_Delivered) | ✅ |
| Order integration (get / update / cancel) | ✅ |
| Audit events | ✅ |
| Non-financial boundary | ✅ |
| `npm test` — 9 pass | ✅ |

### Files Created — PHASE_05A2

```
src/lib/utils/challan-number.ts
src/lib/actions/delivery-challans/helpers.ts
src/lib/actions/delivery-challans/create-delivery-challan.ts
src/lib/actions/delivery-challans/update-delivery-challan.ts
src/lib/actions/delivery-challans/confirm-delivery-challan.ts
src/lib/actions/delivery-challans/cancel-delivery-challan.ts
src/lib/actions/delivery-challans/get-delivery-challan.ts
src/lib/actions/delivery-challans/list-delivery-challans.ts
src/lib/delivery/workflow.test.ts
vitest.config.ts
prisma/migrations/20250625110000_add_partially_delivered_status/migration.sql
```

---

## Delivery Challan Schema — Verification (PHASE_05A1)

| Criterion | Status |
|-----------|--------|
| `DeliveryChallanStatus` enum (Draft, Confirmed, Cancelled) | ✅ |
| `DeliveryChallan` model with all required fields + relations | ✅ |
| `DeliveryChallanItem` model with `Decimal(18,2)` quantity | ✅ |
| `SalesOrder.deliveryChallans` one-to-many back-relation | ✅ |
| `Invoice.deliveryChallanId` nullable one-to-one prep | ✅ |
| Deferred `OrderStatus.Cancelled` enum value applied | ✅ |
| Deferred `Invoice.orderId` non-unique + `@@index([orderId])` applied | ✅ |
| Indexes on challan header + line items per ADR-012 | ✅ |
| `npx prisma format` — succeeds | ✅ |
| `npx prisma generate` — succeeds | ✅ |
| Migration `20250625100000_add_delivery_challan` applied (Docker) | ✅ |
| `prisma migrate status` — database schema up to date | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| No server actions / UI / invoice logic added | ✅ |

### Schema Changes — PHASE_05A1

| Model / Enum | Change |
|--------------|--------|
| `DeliveryChallanStatus` (enum) | **New** — Draft, Confirmed, Cancelled |
| `DeliveryChallan` | **New** — logistics document with `challanNo`, `orderId`, `dealerCode`, `status`, `deliveryMode`, `vehicleNo`, `driverName`, `remarks`, `dispatchedAt`, `createdById`, `confirmedById` |
| `DeliveryChallanItem` | **New** — `challanId`, `orderItemId`, `productId`, `quantity Decimal(18,2)` |
| `SalesOrder` | + `deliveryChallans DeliveryChallan[]` |
| `Invoice` | + `deliveryChallanId String? @unique`, + `deliveryChallan` relation |
| `OrderStatus` | + `Cancelled` (deferred from PHASE_04A) |
| `Invoice.orderId` | `@unique` removed, `@@index([orderId])` added (deferred from PHASE_00C) |
| `User` | + `challansCreated`, `challansConfirmed` relations |
| `Dealer` | + `deliveryChallans` relation |
| `SalesOrderItem` | + `deliveryChallanItems` relation |
| `Product` | + `deliveryChallanItems` relation |

### Files Modified — PHASE_05A1

```
prisma/schema.prisma
prisma/migrations/20250625000000_init/migration.sql
prisma/migrations/20250625100000_add_delivery_challan/migration.sql
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## DealerCombobox — Verification

| Criterion | Status |
|-----------|--------|
| Dropdown visible on `/orders/new` (not clipped by section) | ✅ |
| Dealer rows selectable after open | ✅ |
| Dealer section paints above Order Items card (`z-20`) | ✅ |
| `try/catch` around dealer loading | ✅ |
| Distinguishes empty / action / network / permission / session / stale | ✅ |
| Failures never silently coerced to `[]` | ✅ |
| Localized error UI + Retry / Refresh | ✅ |
| Empty / error / stale states work | ✅ |
| EN + BN localization | ✅ |
| Product Form sections untouched (`product-form-section.tsx`) | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors (3 pre-existing warnings) | ✅ |
| ADR-010 created | ✅ |
| No Invoice / Collection / Ledger built; schema unchanged | ✅ |

---

## Order UI Module — Verification

| Criterion | Status |
|-----------|--------|
| Order List: search / status / dealer / date-range filters | ✅ |
| Order List: sorting + pagination + status badges + Created By | ✅ |
| Create Order: dealer selector, project (existing + inline) | ✅ |
| Create Order: product grid (Product/SKU/Category/Qty/Unit Price/Line Total) | ✅ |
| Create Order: add / remove rows; per-line price override | ✅ |
| Live Financial Summary (Subtotal / Discount % / Discount Amt / Grand Total) | ✅ |
| Live summary uses server calculator — no duplicated client math | ✅ |
| Order Detail: info / dealer / project / items / summary / approval / audit | ✅ |
| Edit Order: status-aware, workflow-respecting | ✅ |
| Approved orders editable only by Manager / Super_Admin | ✅ |
| Approval UI (Approve / Reject / Cancel) shown only when allowed | ✅ |
| VAT not shown, not calculated | ✅ |
| Centralized RBAC (middleware + page guard + render); no inline checks | ✅ |
| EN + BN localization; loading / error / empty states; responsive | ✅ |
| No schema change | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors (3 pre-existing useReactTable warnings) | ✅ |
| ADR-009 created | ✅ |
| No Invoice / Collection / Ledger built | ✅ |

### Files Created — PHASE_04B_ORDER_UI

```
src/lib/actions/orders/preview-order-totals.ts
src/lib/actions/orders/list-dealer-projects.ts
src/components/orders/order-status-badge.tsx
src/components/orders/order-empty-state.tsx
src/components/orders/order-form-section.tsx
src/components/orders/dealer-combobox.tsx
src/components/orders/product-line-editor.tsx
src/components/orders/order-financial-summary.tsx
src/components/orders/order-form.tsx
src/components/orders/approval-actions.tsx
src/components/orders/order-history-timeline.tsx
src/components/orders/order-detail-view.tsx
src/components/orders/order-table.tsx
src/app/(dashboard)/orders/page.tsx
src/app/(dashboard)/orders/new/page.tsx
src/app/(dashboard)/orders/new/page-client.tsx
src/app/(dashboard)/orders/[id]/page.tsx
src/app/(dashboard)/orders/[id]/page-client.tsx
src/app/(dashboard)/orders/[id]/edit/page.tsx
src/app/(dashboard)/orders/[id]/edit/page-client.tsx
docs/ADR/ADR-009-order-ui.md
```

### Files Modified — PHASE_04B_ORDER_UI

```
src/types/order.ts                       (createdByName, preview DTOs)
src/lib/actions/orders/helpers.ts        (include createdBy; populate createdByName)
src/lib/validators/order.schema.ts       (previewOrderTotalsSchema, dealerProjectsSchema)
middleware.ts                            (/orders/new → orders:create)
public/locales/en/common.json            (Order UI keys)
public/locales/bn/common.json            (Order UI keys)
```

---

## Order Backend Module — Verification

| Criterion | Status |
|-----------|--------|
| Order validators (create/update/approve/reject/cancel/list/identify) | ✅ |
| DTO layer (Summary / Detail / Item / Approval History) | ✅ |
| Server actions (create/update/approve/reject/cancel/get/list) | ✅ |
| Order creation in a single Prisma transaction (order + items + totals) | ✅ |
| Decimal-safe calculation engine; no float math | ✅ |
| VAT not calculated (already in price) → vat = 0.00 | ✅ |
| Workflow: cannot approve cancelled order | ✅ |
| Workflow: cannot reject approved order | ✅ |
| Workflow: cannot cancel invoiced order | ✅ |
| Approved orders editable (Manager / Super_Admin) | ✅ |
| Approval audit via createdById / approvedById / approvedAt + AuditLog | ✅ |
| Inline project support (existing OR inline) | ✅ |
| Search backend (order no / dealer / project / status / date range) | ✅ |
| Index review — existing indexes sufficient, none added | ✅ |
| Only additive schema change (OrderStatus + Cancelled) | ✅ |
| RBAC enforced on all actions (centralized, no inline checks) | ✅ |
| Manager granted orders:create + orders:edit | ✅ |
| `npx prisma generate` succeeds | ✅ |
| `npx tsc --noEmit` — 0 errors | ✅ |
| `npx eslint` — 0 errors | ✅ |
| ADR-008 created | ✅ |
| No UI / Invoice / Collection / Ledger built | ✅ |

### Files Created — PHASE_04A_ORDER_BACKEND

```
src/types/order.ts
src/lib/validators/order.schema.ts
src/lib/utils/order-calculator.ts
src/lib/utils/order-number.ts
src/lib/utils/project-code.ts
src/lib/orders/workflow.ts
src/lib/actions/orders/helpers.ts
src/lib/actions/orders/create-order.ts
src/lib/actions/orders/update-order.ts
src/lib/actions/orders/approve-order.ts
src/lib/actions/orders/reject-order.ts
src/lib/actions/orders/cancel-order.ts
src/lib/actions/orders/get-order.ts
src/lib/actions/orders/list-orders.ts
docs/ADR/ADR-008-order-backend.md
```

### Files Modified — PHASE_04A_ORDER_BACKEND

```
prisma/schema.prisma          (OrderStatus + Cancelled)
src/lib/permissions.ts        (Manager: orders:create, orders:edit)
CURRENT_PHASE.md
CHANGELOG.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
```

---

## Invoice Relation Correction — Verification

| Criterion | Status |
|-----------|--------|
| `@unique` removed from `Invoice.orderId` (column + relation preserved) | ✅ |
| `@@index([orderId])` added to `Invoice` | ✅ |
| `SalesOrder.invoices Invoice[]` one-to-many back-relation | ✅ |
| `Collection` / `LedgerEntry` / `DueReport` / `Dealer` / `Product` / `Project` untouched | ✅ |
| `npx prisma format` — relation valid | ✅ |
| `npx prisma generate` — succeeds | ✅ |
| Schema supports One Order → Many Invoices | ✅ |
| ADR-007 created | ✅ |
| No migration run, no Orders code built | ✅ |

### Files Modified — PHASE_00C_INVOICE_RELATION_CORRECTION

```
prisma/schema.prisma
docs/ADR/ADR-007-order-multi-invoice.md (new)
CURRENT_PHASE.md
CHANGELOG.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
```

---

## Product Forms Module — Verification

| Criterion | Status |
|-----------|--------|
| Create Product page at /products/new | ✅ |
| Edit Product page at /products/[id]/edit | ✅ |
| Category select populated from live database | ✅ |
| Deactivate (soft-delete) with confirmation dialog | ✅ |
| Form prefill on edit mode | ✅ |
| Success feedback + auto-redirect to /products | ✅ |
| Unsaved changes indicator | ✅ |
| Error state for product not found (edit) | ✅ |
| RBAC: enforcePermission in server component pages | ✅ |
| RBAC: requirePermission in server actions | ✅ |
| RBAC: role-aware New Product button | ✅ |
| RBAC: role-aware Edit links in product table | ✅ |
| Middleware: /products/new → products:create | ✅ |
| Money input (Decimal-safe, no floating-point) | ✅ |
| EN + BN translations (60+ keys) | ✅ |
| TypeScript strict — tsc --noEmit exits 0 | ✅ |
| ESLint — 0 errors | ✅ |
| ADR-004 created | ✅ |

---

## Files Created — PHASE_03C_PRODUCT_FORMS

```
src/lib/actions/products/list-categories.ts
src/components/products/product-form-section.tsx
src/components/products/product-form.tsx
src/components/products/deactivate-product-dialog.tsx
src/app/(dashboard)/products/new/page.tsx
src/app/(dashboard)/products/new/page-client.tsx
src/app/(dashboard)/products/[id]/edit/page.tsx
src/app/(dashboard)/products/[id]/edit/page-client.tsx
docs/ADR/ADR-004-product-forms.md
```

## Files Modified — PHASE_03C_PRODUCT_FORMS

```
src/lib/actions/products/create-product.ts
src/lib/actions/products/update-product.ts
src/components/products/product-table.tsx
src/app/(dashboard)/products/page.tsx
middleware.ts
public/locales/en/common.json
public/locales/bn/common.json
CURRENT_PHASE.md
CHANGELOG.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
```

---

## RBAC Module — Verification

| Criterion | Status |
|-----------|--------|
| Permission matrix centralized in permissions.ts | ✅ |
| Granular permissions (view/create/edit/delete/approve per resource) | ✅ |
| ROLE_PERMISSIONS correct for all 4 roles per matrix | ✅ |
| canView / canCreate / canEdit / canDelete / canApprove helpers | ✅ |
| requirePermission() for server actions (throws ForbiddenError) | ✅ |
| enforcePermission() for server components (redirects) | ✅ |
| checkPermission() for passive boolean checks | ✅ |
| Middleware protects 11 route prefixes with permission checks | ✅ |
| Unauthorized routes redirect to /access-denied | ✅ |
| 403 Access Denied page — bilingual, responsive, shows user role | ✅ |
| Dashboard layout reads real session, passes actual userRole | ✅ |
| Sidebar filters nav items by role (was already wired, now gets real role) | ✅ |
| MobileNav filters nav items by role (same) | ✅ |
| Audit-ready: PermissionCheckContext with checkedAt field | ✅ |
| TypeScript strict — tsc --noEmit exits 0 | ✅ |
| ESLint — 0 errors on RBAC files | ✅ |
| English + Bengali localization for rbac.* keys | ✅ |

---

## Files Created — PHASE_AUTH_02_RBAC

```
src/lib/rbac/index.ts
src/lib/rbac/guards.ts
src/app/(dashboard)/access-denied/page.tsx
```

## Files Modified — PHASE_AUTH_02_RBAC

```
src/lib/permissions.ts
src/lib/auth/helpers.ts
middleware.ts
src/app/(dashboard)/layout.tsx
public/locales/en/common.json
public/locales/bn/common.json
CURRENT_PHASE.md
CHANGELOG.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
```

---

## Authentication Module — Verification

| Criterion | Status |
|-----------|--------|
| Login page exists at /login | ✅ |
| Email + password validation (Zod) | ✅ |
| bcrypt password hashing (12 rounds) | ✅ |
| JWT session strategy | ✅ |
| Middleware protects / /dealers /products routes | ✅ |
| Unauthenticated users redirected to /login | ✅ |
| Authenticated users redirected away from /login | ✅ |
| Inactive users (isActive=false) cannot login | ✅ |
| Super Admin seed (admin@nazma.local) | ✅ |
| Auth helpers (getSession, getCurrentUser, getCurrentRole) | ✅ |
| requireUser / requireRole for protected actions | ✅ |
| TypeScript strict — tsc --noEmit exits 0 | ✅ |
| ESLint — 0 errors on auth files | ✅ |
| English + Bengali translation keys | ✅ |

---

## Files Created — PHASE_AUTH_01_FOUNDATION

```
auth.ts
middleware.ts
src/types/auth.ts
src/types/next-auth.d.ts
src/lib/auth/helpers.ts
src/lib/actions/auth/login.ts
src/app/(auth)/layout.tsx
src/app/(auth)/login/page.tsx
src/app/api/auth/[...nextauth]/route.ts
src/components/auth/login-form.tsx
src/components/providers/session-provider.tsx
prisma/seeds/admin-user.ts
```

## Files Modified — PHASE_AUTH_01_FOUNDATION

```
prisma/seed.ts
src/app/layout.tsx
public/locales/en/common.json
public/locales/bn/common.json
.env (AUTH_SECRET added)
package.json (next-auth, bcryptjs, @auth/prisma-adapter added)
```

---

## Delivery Challan Backend — Foundation (PHASE_05A)

| Criterion | Status |
|-----------|--------|
| Schema additions proposed (`DeliveryChallan`, `DeliveryChallanItem`, `DeliveryChallanStatus`) | ✅ |
| DTOs + error codes + `ActionResult` envelope | ✅ |
| Zod validators (create / confirm / list / identify / list-for-order) | ✅ |
| Workflow guards (over-delivery, order eligibility, completion detection) | ✅ |
| Quantity strategy — split `remainingQty` (display) vs `allocatableQty` (validation) | ✅ |
| Order immutability — Confirmed challans only (ADR-012 review) | ✅ |
| ADR-012 created | ✅ |
| Server actions deferred | ⏳ |
| Prisma migration applied (PHASE_05A1) | ✅ |
| `workflow.ts` alignment to amended ADR (split qty + confirmed-only lock) | ⏳ |
| No UI / Invoice / Collection / Ledger | ✅ |

### Files Created — PHASE_05A_DELIVERY_CHALLAN_BACKEND

```
src/types/delivery-challan.ts
src/lib/validators/delivery-challan.schema.ts
src/lib/delivery/workflow.ts
docs/ADR/ADR-012-delivery-challan-backend.md
```

### Files Modified — PHASE_05A_DELIVERY_CHALLAN_BACKEND

```
CURRENT_PHASE.md
IMPLEMENTATION_STATUS.md
NEXT_ACTION.md
CHANGELOG.md
```

---

## Fulfillment Layer — Architecture Approved (ADR-011)

| Decision | Status |
|----------|--------|
| Workflow: Order → Delivery Challan → Invoice → Collection → Ledger → Due | ✅ Approved |
| Delivery Challan is NON-FINANCIAL (no balance / ledger / due / collection impact) | ✅ Approved |
| Invoice is FINANCIAL (credit exposure, ledger, balance, due) | ✅ Approved |
| One Sales Order → many Delivery Challans (partial delivery) | ✅ Approved |
| One Delivery Challan → exactly one Invoice | ✅ Approved |
| Invoice quantities sourced from Delivery Challan (not order directly) | ✅ Approved |
| InvoiceItem required on every invoice (no header-only invoices) | ✅ Approved |
| Logistics fields (`vehicleNo`, `driverName`, `deliveryMode`) owned by Delivery Challan | ✅ Approved |
| Credit limit checked at Invoice issue, not at challan dispatch | ✅ Approved |
| Revenue recognized at Invoice issue, not at order approval or challan dispatch | ✅ Approved |
| Order immutability after first confirmed challan | ✅ Approved |
| Invoice Engine postponed until Delivery Challan layer exists | ✅ Approved |
| ADR-011 created | ✅ |

### Approved Phase Sequence

| Phase | Description | Status |
|-------|-------------|--------|
| PHASE_05A_DELIVERY_CHALLAN_BACKEND | Challan validators, DTOs, workflow guards, schema design | **COMPLETE** |
| PHASE_05A1_DELIVERY_CHALLAN_SCHEMA | Prisma models + migration | **COMPLETE** |
| PHASE_05A2_DELIVERY_CHALLAN_ACTIONS | Server actions, challan number generator, order integration | **COMPLETE** |
| PHASE_05B_DELIVERY_CHALLAN_UI | Create challan from order, list, detail, dispatch workflow | **COMPLETE** |
| PHASE_05C1_INVOICE_ENGINE_BACKEND | Invoice from challan + mandatory InvoiceItem + financial posting | **COMPLETE** |
| PHASE_05C_INVOICE_ENGINE | Invoice generation from challan (+ required InvoiceItem) | ✅ COMPLETE (PHASE_05C1) |
| PHASE_05D_INVOICE_UI_PDF | Invoice UI, issue workflow, PDF | PLANNED |

---

## Upcoming Phases

| Phase | Description |
|-------|-------------|
| PHASE_05D_INVOICE_UI_PDF | Invoice UI + PDF |
| PHASE_06_COLLECTIONS | Payment collections |
| PHASE_07_LEDGER | Financial ledger |
| PHASE_08_DUE_REPORTS | Overdue reporting |
| PHASE_09_AUDIT_LOGS | Audit trail |
| PHASE_10_USER_MANAGEMENT | User CRUD (Super_Admin only) |
