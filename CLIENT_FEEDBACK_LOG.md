# Client Feedback Log — Nazma Water Taps ERP

Permanent record of significant client and business requests, architectural responses, and delivery status.

**Last updated:** 2026-07-01 (REPOSITORY_MIGRATION_AND_METADATA_DUMP)

---

## How to Read This Log

| Status | Meaning |
|--------|---------|
| **Implemented** | Delivered and verified in codebase |
| **Deferred** | Approved for a future phase; not yet built |
| **Pending** | Acknowledged; scheduled but not started |
| **Rejected** | Considered and intentionally not adopted |

---

## Summary by Status

### Implemented

Enterprise ERP quality; EN/BN localization; RBAC; partial invoicing; delivery challan workflow; partial delivery; invoice from challan only; mandatory InvoiceItem; credit limit at invoice issue; enterprise invoice UI; client-approved invoice layout; 20-row A4 grid; bank details omitted; Nazma branding + logo; enterprise blue theme; typography/spacing/margins; browser vector PDF; previous/current/outstanding due block; 30-day payment terms; VAT-included pricing; collections cash pool; generic allocation (Invoice); advance payment; collection reversal; collections UI; money receipt; document platform extraction; invoice QA fixes; dealer combobox fix; enterprise data tables.

### Pending

Invoice PDF patch upgrade (layout, typography, spacing, visual polish — document platform only).

### Deferred

Multi-page invoice (>20 lines); company settings for branding; dealer analytics computation; due reports; ledger/statement; challan PDF; delivery reporting; territory analytics; dashboards; credit limit manager override; email/SMS delivery; invoice void/credit note; proper SR mapping; separate ship-to; opening balance.

### Rejected

Direct `Collection.invoiceId`; invoice from order directly; header-only invoices; stored remaining qty; draft challan order lock; client-side money math; raster PDF; bank details on invoice; allocation posting balance; `currentDue − collectionReceived` allocation cap.

---

## Key Entries (Chronological)

Full historical detail preserved from PHASE_01 through PHASE_06D. See entries 1–41 below.

| # | Topic | Status | ADR / Phase |
|---|-------|--------|-------------|
| 1 | Enterprise ERP quality | Implemented | PHASE_01 |
| 2 | EN/BN localization | Implemented | PHASE_01 |
| 3 | RBAC (4 roles) | Implemented | PHASE_AUTH_02 |
| 4 | Multiple invoices per order | Implemented | ADR-007 |
| 5 | Delivery challan workflow | Implemented | ADR-011–013 |
| 6 | Partial delivery | Implemented | ADR-011, ADR-012 |
| 7 | No invoice from order directly | Implemented | ADR-011, ADR-014 |
| 8 | Mandatory InvoiceItem | Implemented | ADR-011, ADR-014 |
| 9 | Credit limit at invoice issue | Implemented | ADR-014 |
| 10 | Enterprise invoice UI | Implemented | ADR-016 |
| 11 | Client-approved invoice layout | Implemented (patch Pending) | ADR-017 |
| 12 | 20-row A4 invoice grid | Implemented (>20 Deferred) | ADR-017, ADR-018 |
| 13 | Remove bank details from invoice | Implemented | ADR-017 |
| 14 | Nazma branding + logo | Implemented | ADR-017, ADR-023 |
| 15 | Enterprise blue theme (`#1a5dad`) | Implemented | ADR-017, ADR-018 |
| 16 | Typography, spacing, margins (8mm, 9pt/7.5pt) | Implemented (patch Pending) | ADR-017, ADR-018 |
| 17 | Browser vector PDF (no raster) | Implemented | ADR-017, ADR-023 |
| 18 | Previous/current/outstanding block | Implemented | ADR-014, ADR-018 |
| 19 | 30-day payment terms | Implemented | ADR-018 |
| 20 | VAT included in price | Implemented | ADR-008 |
| 21 | Cash pool collections | Implemented | ADR-019, ADR-020 |
| 22 | Generic allocation engine | Implemented (Invoice only) | ADR-019, ADR-020 |
| 23 | Advance payment / negative AR | Implemented | ADR-019–021, ADR-024 |
| 24 | Collection reversal | Implemented | ADR-020, ADR-021 |
| 25 | Enterprise collections UI | Implemented | ADR-022 |
| 26 | Money receipt printable | Implemented | ADR-023 |
| 27 | Document platform extraction | Implemented | ADR-023 |
| 28 | Dealer profile/reporting fields | Deferred | ADR-019 |
| 29 | Credit limit hard stop | Implemented | ADR-014 |
| 30 | Credit limit manager override | Deferred | ADR-011 |
| 31 | Due reports | Deferred | PHASE_08 |
| 32 | Ledger / dealer statement | Deferred | PHASE_07 |
| 33 | Delivery challan PDF | Deferred | ADR-011 |
| 34 | Invoice PDF patch upgrade | **Pending** | ADR-017–018 |
| 35 | Invoice void / credit note | Deferred | ADR-024 |
| 36 | Direct collection-invoice link | **Rejected** | ADR-019 |
| 37 | Email/SMS delivery | Deferred | ADR-017 |
| 38 | DealerCombobox reliability | Implemented | ADR-010 |
| 39 | Enterprise data tables | Implemented | Multiple |
| 40 | Bill To = Ship To (v1) | Implemented | ADR-018 |
| 41 | Sales person = territory (v1) | Implemented | ADR-018 |

---

## Detailed Entries

### 11. Client-Approved Invoice Layout

| Field | Detail |
|-------|--------|
| Phase | PHASE_05D2 — 2026-06-27 |
| Request | Printable invoice matching approved Nazma business document layout |
| Decision | Enterprise Document Engine; single `InvoicePrintable` pipeline |
| Status | **Implemented** — visual polish patch **Pending** |

### 15. Enterprise Blue Theme

| Field | Detail |
|-------|--------|
| Phase | PHASE_05D2 |
| Request | Nazma brand blue on document headers, table bars, titles |
| Decision | `--doc-enterprise-blue: #1a5dad`; `print-color-adjust: exact` |
| Status | **Implemented** |

### 16. Typography, Spacing, Margins

| Field | Detail |
|-------|--------|
| Phase | PHASE_05D2 / PHASE_05D3 |
| Request | Accountant-grade print typography and consistent spacing |
| Decision | 8mm padding; 9pt body; 7.5pt table; 16pt title; 4.6mm row height |
| Status | **Implemented** — client feedback refinements **Pending** |

### 34. Invoice PDF Patch Upgrade

| Field | Detail |
|-------|--------|
| Phase | Post PHASE_06C — scheduled 2026-07-01 |
| Request | Fix printable layout: typography, spacing, margins, visual polish |
| Decision | Document platform only; no duplicated templates; no business logic changes |
| Status | **Pending** |

### 28. Dealer Profile / Reporting Foundation

| Field | Detail |
|-------|--------|
| Phase | PHASE_06A1 |
| Request | Sales targets, territory analytics, activity dates on dealer master |
| Decision | Schema fields added; computation deferred to reporting phase |
| Status | **Deferred** |

### 29–30. Credit Limit Workflow

| Field | Detail |
|-------|--------|
| Hard stop at invoice issue | **Implemented** — `CREDIT_LIMIT_EXCEEDED` under dealer lock |
| Manager override with audit | **Deferred** — ADR-011 future enhancement |
