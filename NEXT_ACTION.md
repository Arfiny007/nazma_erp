# NEXT ACTION

## Current State

PHASE_06B_ENTERPRISE_COLLECTIONS_UI is **complete**:

- Enterprise Collections list with filters (dealer, status, payment method, date, advance)
- Unified Collection Workspace (create, draft edit, allocate)
- Dealer financial summary + outstanding invoice allocation table
- Live allocation preview via `previewCollectionAllocation()`
- Advance payment banner and advance credit indicator
- Collection detail with allocation history, audit timeline, reversal dialog
- ADR-022 — Enterprise Collections UI

**Not yet built:** Money receipt PDF, ledger entries, due reports.

---

## Next Phase: PHASE_07 — Ledger

### Implementation Goals

1. `LedgerEntry` creation inside `posting-service.ts` callbacks
2. Ledger list / detail UI
3. Dealer statement reconstruction from ledger + audit

### Out of Scope (for now)

- Money receipt PDF (future)
- Due reports (PHASE_08)
- Collection analytics dashboard

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |
| Accounts | (seed if needed) | — |

---

## Notes

- `Dealer.currentBalance` = AR Balance (positive: dealer owes; negative: advance/credit)
- Cash posting occurs on **confirmation**; allocation applies pool to invoices without second balance mutation
- Collections immutable after confirmation — corrections via `reverseCollection()` only
- Allocation UI uses `grandTotal − collectionReceived` cap from server (not `currentDue − collectionReceived`)
- Delivery Challan remains NON-FINANCIAL
