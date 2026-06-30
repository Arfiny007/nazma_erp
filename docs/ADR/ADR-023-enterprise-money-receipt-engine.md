# ADR-023: Enterprise Money Receipt Engine — PHASE_06C

Date: 2026-06-30

Status: ACCEPTED

Phase: PHASE_06C_ENTERPRISE_MONEY_RECEIPT_ENGINE

Builds on: ADR-017, ADR-019, ADR-020, ADR-021, ADR-022

---

## Context

PHASE_06B delivered the Enterprise Collections UI without printable money
receipts. Business requires accountant-grade **Money Receipt** documents for
confirmed collections — preview, browser print, and vector PDF export.

ADR-017 established the invoice document engine. PHASE_06C upgrades that engine
into a **reusable ERP Document Platform** and implements the first non-invoice
printable: Money Receipt.

Hard constraints (unchanged from ADR-017):

* No rasterized PDFs — vector HTML/CSS only
* No client-side money math — server DTO strings only
* One React component tree for preview, print, and PDF
* Draft and reversed collections must never print

---

## Decision

### 1. Document Platform architecture

ADR-017 primitives are promoted to canonical platform components under
`src/components/documents/`:

| Primitive | Role |
|-----------|------|
| `DocumentLayout` | A4 shell + `extensionSlot` for future QR/barcode/signature |
| `CompanyHeader` / `CompanyFooter` | Branding from `getCompanyBranding()` |
| `DocumentTitle` | Centered document heading |
| `DocumentParties` | Bill To / Received From blocks |
| `DocumentMetadata` | Primary reference + labeled field list |
| `DocumentTable` | Generic print-safe data grid |
| `DocumentFinancialSummary` | Backend-sourced monetary lines |
| `DocumentNotes` | Remarks / terms block |
| `DocumentSignature` | Authorized signature area |
| `DocumentSeal` | Company seal placeholder (not implemented) |
| `DocumentPrintToolbar` | Preview/print route actions (no-print) |

Document-specific composers sit in subfolders:

```
src/components/documents/
├── invoice/InvoicePrintable
├── money-receipt/MoneyReceiptPrintable
└── (future) challan/, statement/, credit-note/
```

`InvoicePrintable` refactored to compose platform primitives. Legacy section
files (`invoice-title`, `notes-section`, etc.) re-export platform components
for backward compatibility.

### 2. Money Receipt architecture

| Layer | Artifact |
|-------|----------|
| Server loader | `loadMoneyReceiptDocument()` |
| Mapper | `mapCollectionToReceiptDocument()` |
| DTO | `MoneyReceiptDocumentDTO` |
| Printable | `MoneyReceiptPrintable` |
| Preview modal | `MoneyReceiptDocumentPreview` |
| Detail actions | `CollectionDocumentActions` |
| Route | `/collections/[id]/receipt` |

**Print guard:** `canPrintMoneyReceipt()` allows `Confirmed`, `PartiallyAllocated`,
and `Allocated` only. `Draft` and `Reversed` return `notFound()` on the receipt
route and hide document actions in the UI.

**Receipt number:** equals `collectionNo` (confirmed collection is the receipt).

### 3. Money Receipt content

Displayed fields (all server-sourced):

* Company branding, title, receipt/collection numbers, receipt date
* Dealer (Received From) with address and contact
* Payment method, bank/reference number
* Received, allocated, advance (unallocated), remaining unallocated, status
* Allocation table when rows exist; advance-retained message when none
* Remarks, authorized signature, company seal area, footer

### 4. Print pipeline

```
CollectionDetailDTO (server)
        ↓
mapCollectionToReceiptDocument()
        ↓
MoneyReceiptPrintable (single React tree)
        ↓
┌────────────────────────┬─────────────────────────┐
│ MoneyReceiptDocumentPreview (modal)            │
│ /collections/[id]/receipt (full page)          │
└────────────────────────┴─────────────────────────┘
        ↓
window.print()  →  Physical printer | Save as PDF
```

Same `document-print.css` as invoices. Preview scales on screen; print resets
to native A4.

### 5. Financial rendering

`DocumentFinancialSummary` receives pre-formatted lines built from DTO strings.
`createMoneyFormatter()` formats display only. React never sums or subtracts.

### 6. Future extensibility

| Extension | Hook |
|-----------|------|
| QR / Barcode | `DocumentLayout.extensionSlot` |
| Digital signature | Replace `DocumentSignature` |
| Cheque image | New section below metadata |
| Receipt cancellation stamp | `DocumentSeal` replacement |
| Delivery Challan PDF | `DocumentLayout` + challan sections |
| Dealer/Ledger statements | `DocumentTable` + statement composer |

### 7. Localization

`document.receipt.*` keys (EN + BN). Collection status and payment method reuse
`collection.status.*` and `collection.paymentMethod.*`.

---

## Consequences

* Invoice and Money Receipt share one document platform — no duplicated print markup.
* Future printable documents add a composer + mapper, not new CSS pipelines.
* PDF export remains browser Save-as-PDF (vector, no server Chromium).
* `CollectionDetailDTO` extended with dealer contact fields for receipt party block.

---

## Out of scope (PHASE_06C)

* Ledger, dealer statements, due reports, analytics
* Email/SMS delivery, QR payments, digital signature logic
* Server-side headless PDF generation

---

## Verification

- [x] Document platform primitives extracted and invoice refactored
- [x] `MoneyReceiptPrintable` single pipeline
- [x] Preview modal + `/collections/[id]/receipt`
- [x] Draft/reversed collections blocked
- [x] Allocation summary + advance message
- [x] Backend financial values only
- [x] Bilingual localization
- [x] ADR-023
- [x] `npx prisma generate` / `tsc` / `eslint`
