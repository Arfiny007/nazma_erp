# Rejected Architecture Decisions — Nazma Water Taps ERP

Important designs that were considered and intentionally rejected. Preserves reasoning for future maintainers and AI sessions.

**Last updated:** 2026-07-01 (REPOSITORY_MIGRATION_AND_METADATA_DUMP)

---

## 1. Invoice Directly from Sales Order

**Looked attractive because:** Simpler pipeline; ADR-007 already allowed one order → many invoices; order contains all commercial terms.

**Why rejected:**
- Creates receivables before physical shipment evidence
- Cannot distinguish ordered from shipped quantities
- Credit exposure would be premature
- No logistics audit trail
- Violates separation of commercial, logistics, and financial layers

**Adopted architecture:** Order → Delivery Challan (non-financial) → Invoice; quantities from `DeliveryChallanItem` only.

**References:** ADR-011, ADR-014

---

## 2. Collections Linked Directly to Invoice

**Looked attractive because:** Simple `Collection.invoiceId` FK; immediate payment-to-invoice association.

**Why rejected:**
- Cannot represent advance payments
- Cannot support partial allocation across multiple invoices
- Cannot extend to credit notes, opening balances, adjustments
- Couples cash receipt timing with application timing

**Adopted architecture:** Cash pool model + polymorphic `CollectionAllocation`; cash posted on confirm; allocation moves pool only.

**References:** ADR-019, ADR-020, ADR-024

---

## 3. Derived Dealer Balance (No Posting Service)

**Looked attractive because:** Balance always fresh from aggregation; no cache drift.

**Why rejected:**
- Expensive on every credit check and UI render
- Race conditions under concurrent issue/collection
- Credit limit requires consistent snapshot at decision time

**Adopted architecture:** `Dealer.currentBalance` as denormalized AR cache; sole writer `posting-service.ts`; dealer lock + atomic increment/decrement.

**References:** ADR-014, ADR-015, ADR-019, ADR-024

---

## 4. Invoice Without InvoiceItem (Header-Only)

**Why rejected:** No product-level audit; partial-shipment billing inaccurate; sales reporting impossible; header/line drift risk.

**Adopted architecture:** Mandatory `InvoiceItem` with immutable snapshots at issue.

**References:** ADR-011, ADR-014, ADR-018

---

## 5. Stored remainingQuantity on Order Lines

**Why rejected:** Drift risk on every challan mutation; two sources of truth; draft vs confirmed semantics uncapturable in one column.

**Adopted architecture:** Derived `remainingQty` / `allocatableQty` from challan history.

**References:** ADR-012 §3

---

## 6. Order Immutability on Any Challan (Including Draft)

**Why rejected:** Draft challans are abandonable intent; blocks legitimate order corrections.

**Adopted architecture:** Structural edits blocked only after first **Confirmed** challan.

**References:** ADR-012 §6

---

## 7. Client-Side Money Calculations

**Why rejected:** JS `number` unsafe for decimals; preview/persist drift; ERP accuracy non-negotiable.

**Adopted architecture:** Server calculators; preview actions return DTO strings; React display only.

**References:** ADR-009, ADR-016, ADR-017, ADR-023

---

## 8. Rasterized / Server-Screenshot PDF (html2canvas)

**Why rejected:** Blurry text; large files; server Chromium cost; preview ≠ PDF risk.

**Adopted architecture:** Single React tree; vector HTML/CSS via `window.print()` → Save as PDF.

**References:** ADR-017, ADR-018, ADR-023

---

## 9. Bank Details on Invoice

**Why rejected:** Client-approved omission; payment via Collections module; reduces invoice clutter.

**Adopted architecture:** Bank details on collection record; money receipt as payment proof.

**References:** ADR-017

---

## 10. Allocation Posts Dealer Balance

**Why rejected:** Double-counting (cash already posted on confirm); breaks advance payments; violates cash receipt ≠ application principle.

**Adopted architecture:** Cash once on `confirmCollection()`; allocation updates invoice dues and pool only.

**References:** ADR-020, ADR-021, ADR-024

---

## 11. currentDue − collectionReceived as Allocation Cap

**Why rejected:** Double-counts payments; blocked full settlement; allowed overpayment when `previousDue > 0`. Remediated PHASE_06A3.

**Adopted architecture:** Cap = `grandTotal − collectionReceived`; guard in `applyInvoiceAllocation()`.

**References:** ADR-021

---

## 12. Pure Client Component Pages for RBAC

**Why rejected:** Flash of unauthorized content; RBAC must be server-first.

**Adopted architecture:** Server Component shell + `enforcePermission()`; middleware first line.

**References:** ADR-004, ADR-009, ADR-016

---

## 13. discountPercent Column on Sales Order

**Why rejected:** Unnecessary schema; percent vs amount inconsistency risk.

**Adopted architecture:** Per-line discount amounts; header derived by Decimal engine.

**References:** ADR-009

---

## 14. Credit Limit at Order Approval or Challan Dispatch

**Why rejected:** Blocks operations before receivable exists; business requested billing-boundary check only.

**Adopted architecture:** Credit limit at `issueInvoice()` only under dealer lock.

**References:** ADR-011, ADR-014

---

## 15. Editing Confirmed Financial Documents

**Why rejected:** Destroys audit trail; breaks statement reconstruction; corrupts balance integrity.

**Adopted architecture:** Immutable after issue/confirm; `reverseCollection()` and future credit notes.

**References:** ADR-019, ADR-020, ADR-024

---

## 16. Separate Print and PDF Templates

**Why rejected:** Preview/print/PDF drift; duplicate maintenance.

**Adopted architecture:** One `InvoicePrintable` / `MoneyReceiptPrintable`; CSS handles screen vs print.

**References:** ADR-017, ADR-018, ADR-023

---

## 17. Legacy PaymentMethod Enum for Collections

**Why rejected:** Value mismatch; insufficient method set for collections domain.

**Adopted architecture:** Dedicated `CollectionPaymentMethod` enum.

**References:** ADR-019

---

## 18. Deleting Collections or Financial Records

**Why rejected:** Accounting requires append-only history; audit and ledger reconstruction impossible.

**Adopted architecture:** Reversal status + compensating posts; headers retained forever.

**References:** ADR-019, ADR-020, ADR-024

---

## 19. Mutable Invoice Totals After Issue

**Why rejected:** Breaks `previousDue`/`currentDue` semantics; corrupts allocation caps.

**Adopted architecture:** Immutable header totals and lines after issue; future credit note for adjustments.

**References:** ADR-014, ADR-024

---

## 20. Direct Dealer Balance Mutations from Feature Code

**Why rejected:** Multiple write paths; lost updates; unreconcilable cache.

**Adopted architecture:** `grep`-verified single path: `posting-service.ts` only.

**References:** ADR-015, ADR-024

---

## 21. Ledger Mutations Outside Posting Service

**Why rejected:** Bypasses balance assertion; breaks idempotency and audit coupling.

**Adopted architecture (PHASE_07):** `createLedgerEntry()` only inside `posting-service.ts`.

**References:** ADR-024

---

## 22. Multiple Printable Implementations per Document Type

**Why rejected:** ADR-018 certification requires single pipeline consistency.

**Adopted architecture:** Document platform primitives + one composer per document type.

**References:** ADR-017, ADR-023

---

## 23. Screenshot PDFs for Archival

**Why rejected:** Non-vector; unsuitable for accountant archives; separate render path.

**Adopted architecture:** Browser-native vector PDF from same DOM as print.

**References:** ADR-017

---

## 24. Invoice Editing After Issue

**Why rejected:** Same as §15; additionally breaks printed document legal standing.

**Adopted architecture:** No edit path for issued invoices; credit note workflow deferred to PHASE_07.

**References:** ADR-014, ADR-024

---

## 25. Storing Derived Quantities (Delivered Qty on Order Line)

**Why rejected:** Same class of problem as §5; compensating updates on every challan event.

**Adopted architecture:** Sum confirmed challan lines at read time.

**References:** ADR-012

---

## Cross-References

- `CLIENT_FEEDBACK_LOG.md` — business requests behind several rejections
- `FINANCIAL_INVARIANTS.md` — positive rules corresponding to rejections
- `docs/ADR/` — full decision context
