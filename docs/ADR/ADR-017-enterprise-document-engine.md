# ADR-017: Enterprise Document Engine

Date: 2026-06-27

Status: ACCEPTED

Phase: PHASE_05D2_ENTERPRISE_DOCUMENT_ENGINE

Builds on: ADR-014, ADR-015, ADR-016

---

## Context

PHASE_05D1 delivered the Enterprise Invoice UI without printable output.
Business requires a **client-approved invoice layout** rendered faithfully for:

* On-screen preview (desktop / tablet / mobile scaling)
* Browser print
* Vector PDF export (Save as PDF)
* Future documents: Delivery Challan PDF, Collection Receipt, Money Receipt,
  Dealer Statement, Ledger Statement, Credit Note, Return Slip

Hard constraints:

* **No rasterized PDFs** — no html2canvas, screenshots, or canvas pipelines
* **No client-side money math** — financial block displays server DTO strings only
* **No hardcoded company branding** — single configuration source
* **One HTML component** for preview, print, and PDF

---

## Decision

### 1. Document engine architecture

Reusable layout primitives live under `src/components/documents/`:

```
DocumentLayout
├── CompanyHeader          ← getCompanyBranding()
├── InvoiceTitle
├── InvoiceMetadata
│   ├── BillToSection
│   └── ShipToSection
├── ProductTable           ← fixed 20-row A4 grid
├── FinancialSummary       ← backend DTO only
├── NotesSection
├── PaymentTerms
├── SignatureSection
└── CompanyFooter
```

`InvoicePrintable` composes these sections only. Future documents reuse
`DocumentLayout`, branding, and print CSS; they swap title/metadata/table
sections as needed.

### 2. Branding architecture

`src/lib/documents/company-branding.ts` exports `getCompanyBranding()`:

| Field | Purpose |
|-------|---------|
| `companyName`, `shortDisplayName`, `tagline` | Header block |
| `address`, `phone`, `email`, `website` | Contact column |
| `logoSrc` | Configurable logo path |
| `bin`, `tradeLicense`, `vatRegistration` | Reserved for settings UI |

Future company settings module overrides `DEFAULT_COMPANY_BRANDING` without
touching document components.

### 3. Printable component strategy

| Surface | Component | Notes |
|---------|-----------|-------|
| Detail sidebar | `InvoiceActions` → preview / print / PDF links |
| Modal preview | `InvoiceDocumentPreview` embeds `InvoicePrintable` |
| Print route | `/invoices/[id]/print` embeds same `InvoicePrintable` |
| Physical print | `window.print()` on shared DOM |
| PDF download | `window.print()` → browser Save as PDF (vector HTML/CSS) |

`mapInvoiceToDocument()` maps `InvoiceDetailDTO` → `InvoiceDocumentDTO` without
recalculating money. `outstanding` is computed server-side as
`currentDue − collectionReceived`.

### 4. PDF rendering pipeline

```
InvoiceDetailDTO (server)
        ↓
mapInvoiceToDocument()
        ↓
InvoicePrintable (single React tree)
        ↓
┌───────────────────┬────────────────────┐
│ InvoiceDocumentPreview (modal)        │
│ /invoices/[id]/print (full page)      │
└───────────────────┴────────────────────┘
        ↓
window.print()  →  Physical printer | Save as PDF
```

No alternate templates. Preview scaling uses CSS `transform` on screen only;
print CSS resets to native A4 dimensions.

### 5. Print CSS strategy

`src/components/documents/styles/document-print.css`:

* `@page { size: A4 portrait; margin: 0 }`
* `@media print` visibility isolation — only `.document-print-root` prints
* `print-color-adjust: exact` on enterprise blue bars
* `page-break-inside: avoid` on totals, notes, signature, footer
* Fixed **20 product rows** at `4.6mm` row height — no overflow page
* Screen preview scales at tablet/mobile breakpoints

### 6. Product table strategy

* `DOCUMENT_MAX_PRODUCT_ROWS = 20`
* Real lines rendered first; empty placeholder rows pad to 20
* Columns: SL, Product Code, Product Name, Unit, Qty, Unit Price, Discount, Amount
* `table-layout: fixed` with widened Product Name column
* Values formatted with shared `format-money.ts` (display only)

### 7. Financial rendering strategy

`FinancialSummary` receives `DocumentFinancialDTO` from server:

* subtotal, discount, vat (0), grandTotal
* previousDue, currentDue, outstanding, status

`createMoneyFormatter()` in `src/lib/utils/format-money.ts` is the centralized
locale formatter. React never sums or subtracts monetary fields.

### 8. Future extensibility

| Extension | Hook |
|-----------|------|
| QR / Barcode | `DocumentLayout.extensionSlot` |
| Digital signature | `SignatureSection` replacement |
| Collection summary | New section below `FinancialSummary` |
| Ledger summary | New section on statements |
| Challan PDF | Reuse `DocumentLayout` + challan sections |
| Company settings | Override `getCompanyBranding()` |

### 9. Localization

Document labels use `document.*` keys (EN + BN). Invoice status reuses
`invoice.status.*`.

---

## Consequences

* Invoice preview, print, and PDF are visually identical (same component).
* Document engine is ready for Challan and Collection receipts without markup duplication.
* PDF export depends on browser print-to-PDF (vector, no server Chromium).
* Bank details section intentionally omitted per approved design.

---

## Out of scope (PHASE_05D2)

* Collections, Ledger, Due Reports, Analytics
* Credit Notes, Returns
* Server-side headless PDF generation
* Email invoice delivery

---

## Verification

- [x] Reusable document engine components
- [x] `InvoicePrintable` single pipeline
- [x] Preview modal + `/invoices/[id]/print`
- [x] Print CSS — A4, 20 rows, color-adjust
- [x] Company branding configuration
- [x] Backend financial values only
- [x] ADR-017
- [x] `npx prisma generate` / `tsc` / `eslint`
