## Project Name

Nazma Water Taps ERP

Brand:
Nazma Metal Industries

---

## Business Domain

Manufacturing and distribution of premium brass bathroom fittings.

Customers:

* Dealers
* Retail distributors
* Project contractors

---

## Core Modules

Priority Order:

1. Authentication
2. RBAC
3. Dealer Management
4. Product Management
5. Sales Orders
6. **Fulfillment Layer** (Delivery Challan)
7. Invoice Engine
8. Collections
9. Ledger
10. Due Reports
11. Audit Logs

---

## Commercial → Fulfillment → Financial Pipeline

The approved end-to-end workflow:

```
Sales Order
  → Delivery Challan   (NON-FINANCIAL — logistics)
  → Invoice            (FINANCIAL — receivables)
  → Collection
  → Ledger
  → Due Report
```

Key rules:

* One Sales Order may generate **multiple Delivery Challans** (partial delivery).
* One Delivery Challan generates **exactly one Invoice**.
* Invoice quantities come from Delivery Challan quantities, not directly from the order.
* **InvoiceItem is required** on every invoice — header-only invoices are forbidden.
* Delivery Challan must **never** affect dealer balance, ledger, due, or collections.
* Invoice **must** affect credit exposure, ledger, dealer balance, and due.

See ADR-011 for the full fulfillment architecture.

---

## Delivery Challan Module

The Delivery Challan is the logistics document that records physical shipment.

Ownership:

| Concern | Owner |
|---------|-------|
| Shipped quantities | Delivery Challan |
| Vehicle / driver / delivery mode | Delivery Challan |
| Revenue & receivables | Invoice (+ InvoiceItem) |
| Payment receipt | Collection |

Delivery Challan is **non-financial**. It exists to bridge the approved order
and the financial invoice without prematurely creating receivables.

---

## User Roles

Super_Admin

Manager

Accounts

SR

---

## Financial Philosophy

The ERP is accounting-sensitive.

Every **invoice** must eventually affect:

* Dealer Balance
* Due Amount
* Ledger Entries

Every **collection** must eventually affect:

* Dealer Balance
* Ledger Entries

**Delivery Challans are explicitly excluded** from all financial side effects.

No orphan financial records allowed.

---

## Localization

Supported languages:

* English
* Bengali

Switching language should not require page refresh.

---

## UI Philosophy

Enterprise SaaS

Characteristics:

* Clean spacing
* Premium typography
* High-density data tables
* Elegant dashboards
* Modern cards
* Smooth interactions

---

## Delivery Reporting — Future Roadmap

Post-invoice phases will add operational reporting on top of the challan layer:

* Delivery register (all challans, filterable by date / dealer / vehicle / status)
* Pending dispatch report (approved orders with undelivered quantities)
* Fulfillment rate dashboard (% delivered vs ordered)
* Challan PDF (printable dispatch document for driver / gate pass)

These depend on PHASE_05A–05D completion. See ADR-011 §Future Roadmap.

---

## Long-Term Goal

The codebase should be reusable as a multi-company ERP platform in future versions.

---

## Architecture Maturity (as of PHASE_06D — 2026-06-30)

**Overall ERP production readiness: 8.7 / 10** (ADR-024)

The commercial → fulfillment → financial → document pipeline is **production-certified** for controlled deployment:

```
Sales Order → Delivery Challan → Invoice → Collection → Allocation → Money Receipt
```

**Certified subsystems:** Orders (9.0), Delivery (9.0), Invoice (9.0), Collections (9.2), Money Receipt (9.0), Document Engine (9.0).

**Not yet built:** Ledger posting, opening balance, credit notes, dealer statements, due reports, management dashboards.

**Blocking defects:** None for Order → Invoice → Collection pipeline.

---

## Document Platform Architecture (PHASE_05D2, PHASE_06C)

ADR-017 established the invoice document engine. PHASE_06C upgraded it into a **reusable ERP Document Platform**.

### Canonical primitives (`src/components/documents/`)

| Primitive | Role |
|-----------|------|
| `DocumentLayout` | A4 shell + `extensionSlot` |
| `CompanyHeader` / `CompanyFooter` | Branding via `getCompanyBranding()` |
| `DocumentTitle` | Centered document heading |
| `DocumentParties` | Bill To / Received From |
| `DocumentMetadata` | Reference + labeled fields |
| `DocumentTable` | Generic print-safe grid |
| `DocumentFinancialSummary` | Server-sourced monetary lines |
| `DocumentNotes` | Remarks / terms |
| `DocumentSignature` / `DocumentSeal` | Authorization areas |
| `DocumentPrintToolbar` | Preview/print actions |

### Document composers

| Document | Component | Route |
|----------|-----------|-------|
| Invoice | `InvoicePrintable` | `/invoices/[id]/print` |
| Money Receipt | `MoneyReceiptPrintable` | `/collections/[id]/receipt` |

**Hard rules:** No client money math. Preview = Print = PDF. Vector HTML/CSS only (no html2canvas). Enterprise blue `#1a5dad`. Max 20 invoice rows per A4 page.

See ADR-017, ADR-023.

---

## Money Receipt Engine (PHASE_06C)

Accountant-grade money receipt for every **confirmed** collection (not Draft or Reversed).

| Layer | Artifact |
|-------|----------|
| Loader | `loadMoneyReceiptDocument()` |
| Mapper | `mapCollectionToReceiptDocument()` |
| Printable | `MoneyReceiptPrintable` |
| Guard | `canPrintMoneyReceipt()` |

Receipt number = `collectionNo`. Shows received, allocated, advance (unallocated), allocation table, payment method.

See ADR-023.

---

## Financial Posting Service (PHASE_05C1, PHASE_05C2A, PHASE_06A2)

**Location:** `src/lib/finance/posting-service.ts`

**Mandate:** ALL balance mutations route through this module. Direct `Dealer.currentBalance` updates from feature code are forbidden.

| Function | Event |
|----------|-------|
| `postReceivableIncrease()` | Invoice issue |
| `postReceivableDecrease()` | Collection confirm |
| `postReceivableDecreaseReversal()` | Collection reverse |

**Concurrency:** `lockDealerForFinancialUpdate()` — `SELECT … FOR UPDATE` before every financial mutation.

**Future (PHASE_07):** `createLedgerEntry()` inside posting callbacks; `postOpeningBalance()`, `postCreditNote()`, `postInvoiceReversal()`.

See ADR-014, ADR-015, ADR-024.

---

## Collection Allocation Abstraction (PHASE_06A1, PHASE_06A2)

Collections record **cash received**; allocation is a separate concern.

### Cash pool model

```
receivedAmount = allocatedAmount + unallocatedAmount
```

- Cash posted **once** on collection confirmation (`postReceivableDecrease()`).
- Allocation moves pool to invoices — **no second balance post**.

### Generic `FinancialReferenceType`

| Type | Handler status |
|------|----------------|
| `Invoice` | ✅ Implemented |
| `OpeningBalance` | Reserved (PHASE_07C) |
| `CreditNote` | Reserved |
| `DebitNote` | Reserved |
| `ManualAdjustment` | Reserved |
| `JournalEntry` | Reserved |

Polymorphic `CollectionAllocation(referenceType, referenceId)`. Certified extensible without redesign (ADR-024).

See ADR-019, ADR-020, ADR-021.

---

## Advance Payment Model (PHASE_06A2, PHASE_06B)

| Concern | Behavior |
|---------|----------|
| Overpayment | Allowed — full cash posted on confirm |
| Negative AR | `Dealer.currentBalance` may go negative (company owes dealer) |
| Pool | Unallocated amount remains in collection until allocated |
| UI | Blue "Advance Credit" badge — not error styling |
| Money receipt | Advance-retained message when no allocations |

Negative balance = advance credit, not data error. Certified for ledger and statement compatibility (ADR-024).

---

## Source-of-Truth Hierarchy (ADR-024)

```
TIER 1 — AUTHORITATIVE (PHASE_07+)
  LedgerEntry (append-only journal subledger)

TIER 2 — DOCUMENT TRUTH
  Invoice, InvoiceItem, Collection, CollectionAllocation

TIER 3 — OPERATIONAL CACHE
  Dealer.currentBalance
  Invoice.currentDue / collectionReceived
  Collection pool fields
```

`Dealer.currentBalance` is a **denormalized AR cache** — fast lookup and credit limit — reconcilable to ledger. Not primary accounting truth.

---

## Future Ledger Architecture (PHASE_07 — designed, not implemented)

### PHASE_07 breakdown (ADR-024)

| Phase | Scope |
|-------|-------|
| 07A | Ledger schema hardening (`postingKey`, enum alignment) |
| 07B | Ledger posting in `posting-service.ts` |
| 07C | Opening balance |
| 07D | Ledger UI + dealer subledger statement |
| 07E | Reconciliation & backfill |
| 07F | Chart of Accounts foundation (optional) |

### Dealer statement (hybrid)

- **Running balance:** `LedgerEntry` (authoritative once posted)
- **Line detail:** Documents (Invoice, Collection, future notes)
- **Pre-ledger fallback:** Document replay formula cross-checked against `currentBalance`

### Ledger principles

- Append-only entries; compensating reversals via `reversesEntryId`
- Posted only from `posting-service.ts`
- Dealer AR subledger first; full multi-account GL later
- `LedgerEntry.balance` must equal `Dealer.currentBalance` after each post

**No refactor required** of Invoice Engine, Collection Engine, or posting service boundaries — extend only.

---

## Current Implementation Status Summary

| Module | Status |
|--------|--------|
| Auth + RBAC | ✅ Complete |
| Dealers | ✅ Complete |
| Products | ✅ Complete |
| Sales Orders | ✅ Complete |
| Delivery Challans | ✅ Complete |
| Invoice Engine + UI + PDF | ✅ Complete |
| Collections Engine + UI | ✅ Complete |
| Money Receipt | ✅ Complete |
| Document Platform | ✅ Complete |
| Financial Architecture Certification | ✅ Complete (PHASE_06D) |
| Ledger | ❌ Not built |
| Due Reports | ❌ Not built |
| Audit Log UI | ❌ Not built |
| User Management | ❌ Not built |

---

## Governance Repository (PHASE_06D metadata dump)

Permanent institutional knowledge files (2026-07-01):

| File | Purpose |
|------|---------|
| `SYSTEM_CONTEXT.md` | Session bootstrap — full ERP context |
| `CLIENT_FEEDBACK_LOG.md` | Client request history |
| `FINANCIAL_INVARIANTS.md` | Mandatory accounting rules |
| `TECH_DEBT.md` | Deferred improvements |
| `KNOWN_RISKS.md` | Risk register |
| `ARCHITECTURE_DECISIONS_REJECTED.md` | Rejected designs + rationale |

---

## Next Priorities (post PHASE_06D)

1. **Invoice PDF Patch Upgrade** — client feedback layout polish (document platform only)
2. **PHASE_07A** — Ledger schema hardening
3. **PHASE_07B** — Ledger engine (posting integration)
4. **PHASE_07C** — Ledger UI (dealer subledger statement)
5. **Reporting** — due reports, cash book, territory analytics
6. **Analytics** — management dashboards
7. **Final Production Hardening** — reconciliation, concurrency tests, deployment checklist

See `NEXT_ACTION.md` for immediate implementation goals.
