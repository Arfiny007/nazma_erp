# ADR-014: Invoice Engine Backend

Date: 2026-06-25

Status: ACCEPTED

Phase: PHASE_05C1_INVOICE_ENGINE_BACKEND

Builds on: ADR-007, ADR-011, ADR-012, ADR-013

---

## Context

PHASE_05A–05B delivered the Delivery Challan layer (non-financial). Business
requires a **Financial Invoice Engine** that:

1. Issues exactly one invoice per **Confirmed** delivery challan.
2. Snapshots immutable `InvoiceItem` rows for audit and historical reporting.
3. Updates dealer receivables through a **single financial posting boundary**.
4. Validates credit limits **only at invoice issue** (not order or challan).
5. Prepares for Collections, Ledger, Credit Notes, and Returns without
   refactoring the invoice module.

This ADR governs PHASE_05C backend only. Invoice UI, PDF, Collections, and
LedgerEntry posting are explicitly out of scope.

---

## Decision

### 1. Financial boundary

```
Confirmed DeliveryChallan
        │
        ▼
   issueInvoice()          ← Invoice Engine (this phase)
        │
        ├── Create Invoice + InvoiceItem snapshots
        ├── Snapshot previousDue / currentDue
        └── postReceivableIncrease()  ← Financial Posting Service
                    │
                    ├── Dealer.currentBalance += grandTotal
                    └── AuditLog (DEALER_BALANCE_UPDATED)
```

**Delivery Challan code must never import** `src/lib/finance/` or mutate dealer
balance. **Invoice code must never** update `Dealer.currentBalance` directly.

### 2. InvoiceItem immutable snapshot strategy

Every issued invoice requires one or more `InvoiceItem` rows. Header-only
invoices are forbidden.

At issue time, each line permanently stores:

| Field | Source at issue |
|-------|-----------------|
| `productId` | Challan line |
| `productCode` | Product.sku (snapshot) |
| `productName` | Product.name (snapshot) |
| `unit` | Product.unit (snapshot) |
| `quantity` | DeliveryChallanItem.quantity (exact) |
| `unitPrice` | SalesOrderItem.unitPrice (historical) |
| `discount` | Proportional share of SalesOrderItem.discount |
| `lineTotal` | Decimal engine: `(qty × unitPrice) − discount` |

`challanItemId` and `orderItemId` are stored for traceability only. Pricing
never re-reads live Product or Order tables after issue.

### 3. Quantity source rule

Invoice quantities originate **only** from `DeliveryChallanItem`. The engine
never reads `SalesOrderItem.quantity` for billing qty. Unit price and discount
allocation reference the parent order line for historical commercial terms.

### 4. Previous Due snapshot

Immediately before persistence:

```
previousDue = Dealer.currentBalance   // read inside transaction
```

Stored on `Invoice.previousDue` permanently. Never recomputed from live dealer
state when displaying historical invoices.

### 5. Current Due strategy

At issue (Collections not implemented):

```
currentDue = previousDue + grandTotal
```

Stored on `Invoice.currentDue`. Future collection allocation will reduce
`currentDue` on the invoice and dealer balance through the same Financial
Posting Service — not by rewriting issued snapshots.

### 6. Financial Posting Service

Location: `src/lib/finance/posting-service.ts`

PHASE_05C implements `postReceivableIncrease()` only:

- Increases `Dealer.currentBalance` by invoice `grandTotal`
- Writes `DEALER_BALANCE_UPDATED` audit entry

**Does not** create `LedgerEntry` rows yet.

Future extensions (same module, same entry points):

| Future phase | Posting type |
|--------------|--------------|
| PHASE_07 Ledger | Debit receivable ledger line |
| PHASE_06 Collections | Credit receivable on payment |
| Returns / Credit Notes | Reversal postings |
| Opening balance | Initial balance posting |

### 7. Credit limit validation

Evaluated **only** in `issueInvoice()`:

```
projectedExposure = dealer.currentBalance + invoice.grandTotal
if projectedExposure > dealer.creditLimit → CREDIT_LIMIT_EXCEEDED
```

Uses existing `wouldExceedCreditLimit()` from `src/lib/utils/credit-limit.ts`.
Not evaluated on Sales Order or Delivery Challan actions.

RBAC: `invoices:create` (Accounts, Super_Admin). SR and Manager cannot issue.

### 8. Invoice status

Schema supports: `Draft`, `Issued`, `Paid`, `Partial`, `Overdue`.

`issueInvoice()` always creates `Issued`. Payment-driven statuses are deferred
to Collections (PHASE_06).

### 9. Audit events

| Action | Entity | Payload |
|--------|--------|---------|
| `INVOICE_CREATED` | Invoice | invoice, challan, order, dealer, totals, dues, actor |
| `DEALER_BALANCE_UPDATED` | Dealer | balance before/after, invoice reference |

Both written inside the issuing transaction.

### 10. Challan eligibility guards

| Challan status | Invoice allowed? |
|----------------|------------------|
| Draft | ❌ `CHALLAN_NOT_CONFIRMED` |
| Confirmed (no invoice) | ✅ Once |
| Confirmed (has invoice) | ❌ `INVOICE_ALREADY_EXISTS` |
| Cancelled | ❌ `CHALLAN_CANCELLED` |

Enforced by `src/lib/invoices/workflow.ts` + unique `Invoice.deliveryChallanId`.

### 11. Server actions

| Action | Permission |
|--------|------------|
| `issueInvoice` | `invoices:create` |
| `getInvoice` | `invoices:view` |
| `listInvoices` | `invoices:view` |

Single Prisma transaction per issue; no N+1; one challan load with nested items.

### 12. Schema addition

`InvoiceItem` model + migration `20250625120000_add_invoice_item`.

`Invoice.items` one-to-many relation. `DeliveryChallanItem.invoiceItem` optional
one-to-one back-link for traceability.

---

## Consequences

- Confirmed challans with `hasInvoice: false` are invoice-eligible (UI in PHASE_05D).
- Dealer list credit indicators reflect updated balance after issue.
- Ledger and Collections plug into `posting-service.ts` without touching invoice actions.
- Historical invoices remain stable even if product prices or dealer balance change later.

---

## Out of scope (PHASE_05C)

- Invoice UI / PDF (PHASE_05D)
- Collections / payment allocation
- LedgerEntry creation
- Due reports / analytics
- Credit note / sales return workflows

---

## Verification

- [x] `InvoiceItem` model + migration
- [x] `issueInvoice` / `getInvoice` / `listInvoices`
- [x] Financial Posting Service boundary
- [x] Credit check at issue only
- [x] Immutable line snapshots
- [x] `INVOICE_CREATED` + `DEALER_BALANCE_UPDATED` audit
- [x] Workflow unit tests
- [x] `npx prisma generate` / `tsc` / `eslint`
