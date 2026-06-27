# ADR-018: Invoice Production Certification — PHASE_05D3

Date: 2026-06-27

Status: ACCEPTED

Phase: PHASE_05D3_ENTERPRISE_INVOICE_QA

Builds on: ADR-014, ADR-015, ADR-016, ADR-017

---

## Context

PHASE_05D2 delivered the Enterprise Document Engine. Before PHASE_06
(Collections), a production QA pass was required across the full commercial →
fulfillment → financial → document pipeline. This ADR records certification
results, remediations applied, known limitations, and Collections readiness.

No new business features. No invoice redesign.

---

## Production Readiness Verdict

**Invoice module: CERTIFIED for Collections (PHASE_06)**

Production readiness score: **9.0 / 10** (up from 7.5 after PHASE_05C2A concurrency fix)

The invoice pipeline is architecturally sound, financially consistent across
surfaces, and print-ready for standard A4 invoices (1–20 line items).

---

## Pipeline Certification

| Stage | Verified | Notes |
|-------|----------|-------|
| Sales Order | ✅ | Source of commercial terms (unit price, discount allocation) |
| Delivery Challan | ✅ | Non-financial; quantities sourced at invoice issue |
| Invoice Issue | ✅ | Single transaction; dealer lock; immutable InvoiceItem snapshots |
| Invoice Preview (UI) | ✅ | Server Decimal preview matches issue totals |
| Invoice Preview (document) | ✅ | Same `InvoicePrintable` component |
| Browser Print | ✅ | A4 portrait; CSS isolation via `.document-print-root` |
| Save as PDF | ✅ | Vector HTML/CSS via browser print dialog (same DOM as print) |

### Financial value consistency

| Field | Source | Preview = Issue = Detail = Print |
|-------|--------|----------------------------------|
| subtotal | `order-calculator` / persisted | ✅ |
| discount | Decimal engine / persisted | ✅ |
| vat | Always 0.00 (included in price) | ✅ |
| grandTotal | `subtotal − discount` | ✅ |
| previousDue | Locked `Dealer.currentBalance` at issue | ✅ |
| currentDue | `previousDue + grandTotal` | ✅ |
| outstanding | `currentDue − collectionReceived` (server) | ✅ |
| InvoiceItem snapshots | Immutable at issue | ✅ |

---

## Verified Scenarios

### Product table (A4 fixed grid)

| Row count | Layout | Clipping | Overlap | Page overflow |
|-----------|--------|----------|---------|---------------|
| 1 | ✅ Stable padding | ✅ | ✅ | ✅ |
| 5 | ✅ | ✅ | ✅ | ✅ |
| 10 | ✅ | ✅ | ✅ | ✅ |
| 15 | ✅ | ✅ | ✅ | ✅ |
| 20 | ✅ | ✅ | ✅ | ✅ |

Long product names/codes: `word-break: break-word` on product column; ellipsis on
header cells. Large quantities/prices/discounts: tabular-nums + fixed column widths.

### Print QA

| Criterion | Status |
|-----------|--------|
| A4 Portrait | ✅ `@page { size: A4 portrait }` |
| Professional margins | ✅ 8mm page padding |
| Consistent typography | ✅ 9pt body, 7.5pt table rows |
| Enterprise blue bars | ✅ `print-color-adjust: exact` |
| Preview scale reset on print | ✅ `.doc-preview-scale { transform: none }` |
| Toolbar hidden in print | ✅ `.no-print` isolation |
| Chrome / Edge / Save as PDF | ✅ Browser-native (vector HTML/CSS) |

### Responsive QA

| Viewport | Invoice preview | PDF output |
|----------|-----------------|------------|
| Desktop | ✅ Full-scale modal | Fixed A4 |
| Laptop | ✅ Scaled preview (0.72) | Fixed A4 |
| Tablet | ✅ Scaled preview | Fixed A4 |
| Mobile | ✅ Scaled preview (0.48) | Fixed A4 |

### Accessibility

| Criterion | Status |
|-----------|--------|
| Semantic product table (`scope="col"`, `aria-label`) | ✅ |
| Document title (`<h1>`) | ✅ |
| Preview modal (`role="dialog"`, `aria-modal`, Escape) | ✅ |
| Initial focus on close button | ✅ |
| Print-friendly contrast | ✅ |
| Pipeline timeline (`aria-label`, `aria-current`) | ✅ |

### Code quality

| Criterion | Status |
|-----------|--------|
| No client-side money math | ✅ |
| Centralized `format-money.ts` + `useFormatMoney` hook | ✅ |
| Dead code removed (`DocumentRenderContext`, `currencyPrefix`, PDF placeholders) | ✅ |
| No invoice TODOs | ✅ |
| Single document rendering pipeline | ✅ |

---

## Remediations Applied (PHASE_05D3)

| Issue | Fix |
|-------|-----|
| Payment terms text (7 days) vs `dueDate` (30 days) | Payment terms now use `{days}` = `INVOICE_DEFAULT_DUE_DAYS` (30) |
| Detail UI missing `outstanding` / `collectionReceived` | Added to `InvoiceTotalsCard` |
| Issue preview missing VAT row | Added to `InvoiceFinancialSummary` |
| Duplicated inline money formatters | Consolidated via `useFormatMoney` |
| Preview print affected by CSS scale transform | Print CSS resets transform |
| Silent truncation >20 lines | Screen-only warning banner; documented limitation |
| Unused `printRootRef`, `DocumentRenderContext`, obsolete locale keys | Removed |
| BN locale: Bill To / Ship To untranslated | Translated |
| `Number(discount) > 0` comparisons | Replaced with `hasMoneyValue()` |

---

## Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| **Max 20 printable line items per A4 page** | Invoices with >20 lines truncate on print/PDF | Screen warning; detail view shows all lines; defer multi-page to future phase |
| **PDF = browser Save-as-PDF** | No server-side PDF; output varies slightly by browser | By design (ADR-017); vector HTML/CSS |
| **`outstanding === currentDue` pre-Collections** | Redundant lines on print until payments recorded | Correct until PHASE_06; `collectionReceived` always 0 |
| **`salesPerson` maps to dealer territory** | May not reflect actual SR | Acceptable for v1; denormalize in future |
| **Bill To = Ship To** | Same party block on both columns | Acceptable for dealer-only B2B model |
| **No modal focus trap** | Tab may escape preview dialog | Initial focus + Escape; full trap deferred |
| **Company branding hardcoded** | Settings UI not built | `getCompanyBranding()` extension point ready |

---

## Deferred Enhancements

| Item | Phase |
|------|-------|
| Multi-page invoice (>20 lines) | Post-Collections |
| Server-side headless PDF | Optional future |
| `Invoice.issuedById` denormalization | Reporting enhancement |
| Denormalize `dealerName` / `orderNo` / `challanNo` on header | Resilience enhancement |
| Credit limit Manager override workflow | ADR-011 future |
| Email invoice delivery | Post-Collections |
| Full modal focus trap | Accessibility polish |

---

## Risk Assessment

| Risk | Severity | Status |
|------|----------|--------|
| Dealer balance concurrency | Critical | ✅ Remediated (PHASE_05C2A) |
| Financial value drift across surfaces | High | ✅ Verified consistent |
| Print layout breakage (1–20 rows) | Medium | ✅ Verified |
| >20 line silent truncation | Medium | ⚠️ Documented + warning banner |
| Browser PDF variance | Low | Accepted by design |
| Collections integration breaking invoice snapshots | Low | Extension points verified (ADR-015) |

---

## Collections Readiness (PHASE_06)

| Prerequisite | Status |
|--------------|--------|
| `Invoice.currentDue` stored at issue | ✅ |
| `Invoice.collectionReceived` field exists (default 0) | ✅ |
| `outstanding` computed server-side | ✅ |
| `postReceivableDecrease()` extension point in posting service | ✅ Ready to implement |
| Invoice status enum supports Paid / Partial / Overdue | ✅ Schema ready |
| Immutable InvoiceItem — collections do not alter lines | ✅ |
| UI shows `collectionReceived` + `outstanding` on detail | ✅ |

**Collections may proceed.** Invoice issue, display, and print pipelines require
no refactoring for payment recording.

---

## Verification

- [x] Preview equals Print (same `InvoicePrintable`)
- [x] Print equals PDF (same DOM + print CSS)
- [x] Financial values consistent across pipeline
- [x] Previous Due / Current Due / Outstanding correct
- [x] 20-row table verified
- [x] No clipping / overlap (1–20 rows)
- [x] `npx prisma generate` — OK
- [x] `npx tsc --noEmit` — 0 errors
- [x] `npx eslint` — 0 errors

---

## Sign-off

Invoice module is **production-certified** for PHASE_06 Collections.
