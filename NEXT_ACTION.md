# NEXT ACTION

## Current State

PHASE_05D3_ENTERPRISE_INVOICE_QA is **complete**:

- Full pipeline certified (Order → Challan → Issue → Preview → Print → PDF)
- Financial values consistent across all surfaces
- Production readiness score: **9.0 / 10**
- ADR-018 — Invoice Production Certification
- Invoice module **certified for Collections**

**Not yet built:** Collections, Ledger, Due Reports.

---

## Next Phase: PHASE_06 — Collections

### Implementation Goals

1. Collection recording against invoices
2. `postReceivableDecrease()` in Financial Posting Service
3. Update `currentDue` and `collectionReceived` on payment
4. Invoice status transitions (Partial / Paid)

### Out of Scope

- Ledger posting (PHASE_07)
- Due reports (PHASE_08)
- Multi-page invoice (>20 lines)

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
- Never update `Dealer.currentBalance` outside `postReceivableIncrease()` / `postReceivableDecrease()`
- Document PDF uses browser Save-as-PDF — no html2canvas / rasterization
- Printable invoice limited to 20 line items per A4 page (see ADR-018)
