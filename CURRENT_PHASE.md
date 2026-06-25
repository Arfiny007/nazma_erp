# CURRENT_PHASE.md

Current Phase:

PHASE_05B_DELIVERY_CHALLAN_UI

Status:

COMPLETE

### Hotfix (2026-06-25)

`OrderStatus.Partially_Delivered` enum migration `20250625110000_add_partially_delivered_status` was missing from the Docker database — applied via `prisma migrate deploy`. Delivery Challan create page eligible-order queries restored.

---

## Roadmap — Fulfillment & Invoicing

| Phase | Description | Status |
|-------|-------------|--------|
| PHASE_04A_ORDER_BACKEND | Sales Order backend | ✅ COMPLETE |
| PHASE_04B_ORDER_UI | Sales Order UI | ✅ COMPLETE |
| PHASE_04C_ORDER_COMBOBOX_DIAGNOSTICS | DealerCombobox fix | ✅ COMPLETE |
| PHASE_05A_DELIVERY_CHALLAN_BACKEND | Delivery Challan backend (validators, DTOs, workflow guards) | ✅ COMPLETE (foundation) |
| PHASE_05A1_DELIVERY_CHALLAN_SCHEMA | Delivery Challan Prisma schema + migration | ✅ COMPLETE |
| PHASE_05A2_DELIVERY_CHALLAN_ACTIONS | Server actions, challan number generator, order integration | ✅ COMPLETE |
| **PHASE_05B_DELIVERY_CHALLAN_UI** | Delivery Challan UI (create from order, list, detail, dispatch) | **✅ COMPLETE** |
| PHASE_05C_INVOICE_ENGINE | Invoice generation from challan (+ required InvoiceItem) | PLANNED |
| PHASE_05D_INVOICE_UI_PDF | Invoice UI, issue workflow, printable PDF | PLANNED |

---

# PHASE_05B_DELIVERY_CHALLAN_UI

Status: COMPLETE

## Objectives

Build the complete Delivery Challan **UI** on top of the existing backend. Reuse
Order UI architecture — no duplicated business logic.

* List `/delivery-challans` — search, status / dealer / date filters, sorting, pagination
* Create `/delivery-challans/new` — eligible order picker, line qty grid, live fulfillment summary
* Detail `/delivery-challans/[id]` — header, dealer, order, logistics, items, audit, confirm/cancel
* Edit `/delivery-challans/[id]/edit` — Draft-only; confirmed read-only
* Fulfillment progress bars (per-line + order-level)
* Status badges — Draft (gray), Confirmed (green), Cancelled (red)
* RBAC via existing `orders:*` permissions
* EN + BN localization
* ADR-013 documents UI architecture

### UI-Support Backend (additive)

| Piece | Purpose |
|-------|---------|
| `getOrderChallanContext` | Server-side allocatable qty for create/edit forms |
| `getChallanDetailLines` | Enriched detail product table |
| `fetchChallanHistory` | Audit timeline on detail DTO |
| `quantity-client.ts` | Client-safe progress display only |

### Out of Scope

* Invoice Engine (PHASE_05C), Invoice UI (PHASE_05D)
* Collections, Ledger, Due Reports
* Prisma schema changes

### Completion Criteria

* All four routes implemented: ✓
* List (search/filters/sort/pagination/badges): ✓
* Create (order picker, line grid, allocatable cap, live summary): ✓
* Detail (info, items, fulfillment, audit, workflow actions, print): ✓
* Edit (Draft only, redirect if Confirmed): ✓
* RBAC (middleware + page + render): ✓
* EN + BN localization: ✓
* ADR-013 created: ✓
* `npx tsc --noEmit` — 0 errors: ✓
* `npx eslint` — 0 errors: ✓
* `npm test` — 9 pass: ✓

---

## Next Phase

PHASE_05C_INVOICE_ENGINE — Invoice generation from confirmed challan (+ mandatory InvoiceItem).
