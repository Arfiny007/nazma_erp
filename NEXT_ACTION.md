# NEXT ACTION

## Current State

PHASE_05D1_ENTERPRISE_INVOICE_UI is **complete**:

- Invoice list (`/invoices`) with search, filters, pagination, sorting
- Invoice detail (`/invoices/[id]`) — immutable lines, financial summary, audit timeline
- Issue workflow (`/invoices/issue`) + challan detail dialog
- Server financial preview — no client-side money math
- EN + BN localization (`invoice.*`)
- ADR-016

**Not yet built:** Invoice PDF, Collections, Ledger, Due Reports.

---

## Next Phase: PHASE_05D2 — Invoice PDF

### Implementation Goals

1. Printable invoice PDF layout on detail page
2. Print stylesheet / server PDF generation
3. EN + BN PDF labels

### Out of Scope

- Collections, Ledger posting, payment allocation

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |
| Accounts | (seed if needed) | — |

---

## Notes

- Delivery Challan remains NON-FINANCIAL
- Invoice issue requires `invoices:create` (Accounts, Super_Admin)
- Never update `Dealer.currentBalance` outside `postReceivableIncrease()`
- Invoice UI displays backend totals only — never recomputes on client
