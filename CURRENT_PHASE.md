# CURRENT_PHASE.md



Current Phase:



PHASE_06D.2_ENTERPRISE_DOCUMENT_PLATFORM_DESIGN_FREEZE



Status:



COMPLETE



---



## Roadmap — Fulfillment, Invoicing & Collections



| Phase | Description | Status |

|-------|-------------|--------|

| PHASE_04A_ORDER_BACKEND | Sales Order backend | ✅ COMPLETE |

| PHASE_04B_ORDER_UI | Sales Order UI | ✅ COMPLETE |

| PHASE_04C_ORDER_COMBOBOX_DIAGNOSTICS | DealerCombobox fix | ✅ COMPLETE |

| PHASE_05A_DELIVERY_CHALLAN_BACKEND | Delivery Challan backend (validators, DTOs, workflow guards) | ✅ COMPLETE |

| PHASE_05A1_DELIVERY_CHALLAN_SCHEMA | Delivery Challan Prisma schema + migration | ✅ COMPLETE |

| PHASE_05A2_DELIVERY_CHALLAN_ACTIONS | Server actions, challan number generator, order integration | ✅ COMPLETE |

| PHASE_05B_DELIVERY_CHALLAN_UI | Delivery Challan UI (create from order, list, detail, dispatch) | ✅ COMPLETE |

| PHASE_05C1_INVOICE_ENGINE_BACKEND | Invoice backend from confirmed challan (+ mandatory InvoiceItem) | ✅ COMPLETE |

| PHASE_05C2_FINANCIAL_INTEGRITY_AUDIT | Pre-production accounting review; ADR-015 | ✅ COMPLETE |

| PHASE_05C2A_FINANCIAL_CONCURRENCY_HOTFIX | Dealer row lock, atomic balance, idempotency, concurrency tests | ✅ COMPLETE |

| PHASE_05D1_ENTERPRISE_INVOICE_UI | Invoice list, detail, issue workflow (UI only — no PDF) | ✅ COMPLETE |

| PHASE_05D2_ENTERPRISE_DOCUMENT_ENGINE | Printable invoice document engine (preview, print, PDF) | ✅ COMPLETE |

| PHASE_05D3_ENTERPRISE_INVOICE_QA | Production QA certification before Collections | ✅ COMPLETE |

| PHASE_06A1_COLLECTIONS_SCHEMA_FOUNDATION | Collections schema, DTOs, validators, ADR-019 | ✅ COMPLETE |

| PHASE_06A2_COLLECTION_ENGINE_AND_ALLOCATION | Collection server actions, allocation engine, posting, reversal | ✅ COMPLETE |

| PHASE_06A3_FINANCIAL_CONSISTENCY_AUDIT | Pre-UI financial certification; ADR-021 | ✅ COMPLETE |

| PHASE_06B_ENTERPRISE_COLLECTIONS_UI | Collection list, workspace, allocation UI, reversal UX | ✅ COMPLETE |

| PHASE_06C_ENTERPRISE_MONEY_RECEIPT_ENGINE | Document platform upgrade + Money Receipt printable | ✅ COMPLETE |

| PHASE_06D_FINANCIAL_ARCHITECTURE_CERTIFICATION | Pre-ledger ERP financial architecture review; ADR-024 | ✅ COMPLETE |

| **PHASE_06D.1_INVOICE_PDF_CLIENT_REVISION** | Client-approved invoice layout revision 2 (presentation only) | **✅ COMPLETE** |
| **PHASE_06D.2_ENTERPRISE_DOCUMENT_PLATFORM_DESIGN_FREEZE** | Enterprise design system freeze — design tokens, header, title, financial summary grouping, single signature, professional notes, enterprise footer, rebalanced table, single dealer section | **✅ COMPLETE** |



---



# PHASE_06D.1_INVOICE_PDF_CLIENT_REVISION



Status: COMPLETE



## Objectives



Revise the enterprise invoice printable layout per latest client feedback.
Presentation-layer changes only — no accounting, posting, workflow, or schema changes.



* Enlarge company name hierarchy (Nazma + WATER TAPS subtitle)

* Dynamic product rows (no fixed 20-row padding)

* Remove discount column, VAT row, and Due Date from print

* Sales person = Sales Order creator (not dealer territory)

* Blank signature areas (Prepared By / Checked By / Authorized Signature)

* Maintain Preview = Print = PDF single pipeline



### Completion Criteria



* Company name enlarged; subtitle aligned: ✓

* Dynamic row generation; no placeholder rows: ✓

* Discount column removed from print: ✓

* VAT row removed from print: ✓

* Due Date removed from print: ✓

* Sales person shows SR (order creator) name: ✓

* Signature areas blank: ✓

* Preview == Print == PDF: ✓

* No business or financial logic changes: ✓

* ADR-017 / ADR-018 updated: ✓

* Governance docs updated: ✓



### Explicitly NOT Changed



* Prisma schema, PostingService, Invoice Engine, validators, workflow

* Financial calculations (subtotal, grandTotal, previousDue, currentDue, outstanding)

* Database fields and DTO monetary fields



---



---



# PHASE_06D.2_ENTERPRISE_DOCUMENT_PLATFORM_DESIGN_FREEZE

Status: COMPLETE

## Objectives

Production design freeze for the Enterprise Document Platform before the Ledger phase begins.
Presentation-layer changes only — no accounting, posting, workflow, or schema changes.

* Design tokens file — single source of truth for all document visual constants
* Enterprise CompanyHeader redesign — enlarged company name (32pt black), improved hierarchy, vertical rule separator, professional address block (T/E/W prefix style)
* Stronger DocumentTitle — 17pt font-black, 0.12em tracking, increased vertical spacing
* Simplified dealer section — single "Dealer Information" block (B2B ERP; no redundant Ship To column)
* Rebalanced product table — Product Name column expanded to 42% (was 34%); compact numeric columns
* Tabular numerals — font-variant-numeric: tabular-nums on qty/price/amount/financial columns
* Grouped financial summary — visual divider between Invoice Amount group and Due Summary group
* Single Authorized By signature — replaces three-signature block (Prepared By, Checked By, Authorized Signature)
* Professional notes — business-grade Terms & Conditions replacing consumer-oriented text
* Enterprise footer — blue bar + left "Confidential" label + right thank-you message
* PaymentTerms section removed — no orphan sections

### Completion Criteria

* Design tokens file created: ✓
* Enterprise header improved: ✓
* Document title strengthened: ✓
* Dealer section simplified (single B2B block): ✓
* Product table rebalanced (42% name column): ✓
* Tabular numerals on numeric columns: ✓
* Financial summary grouped (divider between Invoice Amount / Due Summary): ✓
* Payment terms removed from invoice print: ✓
* Professional notes (Terms & Conditions): ✓
* Single Authorized By signature: ✓
* Enterprise footer (blue bar + confidential + message): ✓
* DocumentLabels updated (authorizedBy, dealerInfo fields): ✓
* EN/BN localization updated: ✓
* Preview == Print == PDF: ✓
* No business or financial logic changes: ✓
* `npx tsc --noEmit` — 0 errors: ✓
* `npx eslint` — 0 errors: ✓
* Governance docs updated: ✓

### Explicitly NOT Changed

* Prisma schema, PostingService, Invoice Engine, validators, workflow
* Financial calculations (subtotal, grandTotal, previousDue, currentDue, outstanding)
* Database fields and DTO monetary fields
* Money Receipt pipeline (DocumentFinancialSummary changes are backward-compatible)

---



## Next Phase



**PHASE_07A_LEDGER_SCHEMA_HARDENING** — Extend `LedgerEntry` model, idempotency
keys, enum alignment; then PHASE_07B ledger posting integration.
