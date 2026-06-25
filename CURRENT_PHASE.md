# CURRENT_PHASE.md

Current Phase:

PHASE_05D1_ENTERPRISE_INVOICE_UI

Status:

COMPLETE

---

## Roadmap — Fulfillment & Invoicing

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
| **PHASE_05D1_ENTERPRISE_INVOICE_UI** | Invoice list, detail, issue workflow (UI only — no PDF) | **✅ COMPLETE** |
| PHASE_05D2_INVOICE_PDF | Printable invoice PDF | PLANNED |

---

# PHASE_05D1_ENTERPRISE_INVOICE_UI

Status: COMPLETE

## Objectives

Enterprise Invoice UI — backend reuse only; no PDF, Collections, or Ledger.

* `/invoices` — searchable, filterable, paginated list
* `/invoices/[id]` — immutable detail with financial summary + audit timeline
* `/invoices/issue` — confirmed challan picker, server preview, issue workflow
* Issue from challan detail via `IssueInvoiceDialog`
* EN + BN localization (`invoice.*`)
* ADR-016

### Completion Criteria

* Invoice list / detail / issue pages: ✓
* Server financial preview (no client math): ✓
* RBAC middleware + guards + conditional render: ✓
* `npx prisma generate` / `tsc` / `eslint`: ✓

---

## Next Phase

**PHASE_05D2_INVOICE_PDF** — Printable invoice PDF layout.
