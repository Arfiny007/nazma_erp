# ADR-007: One Sales Order → Many Invoices

Date: 2026-06-23

Status: ACCEPTED

Phase: PHASE_00C_INVOICE_RELATION_CORRECTION

---

## Context

The original schema (PHASE_00B_SCHEMA_HARDENING) modeled the relationship between
`SalesOrder` and `Invoice` as a strict one-to-one. This was enforced by:

- `Invoice.orderId String @unique` — the `@unique` constraint physically prevented
  more than one invoice from referencing the same order.
- `SalesOrder.invoice Invoice?` — the singular optional back-relation reflected the
  1:1 cardinality at the Prisma type level.

A business rule clarification requires that **one SalesOrder may generate multiple
Invoices** (for example: partial deliveries, staged shipments, or split billing
against a single approved order). The 1:1 constraint blocks this real-world workflow
and must be corrected before the Invoice engine (PHASE_05) is built.

---

## Decision

Convert the `SalesOrder` ↔ `Invoice` relationship from one-to-one to one-to-many,
using the **minimum** schema change required. No other models are redesigned.

### 1. Remove the uniqueness constraint on the foreign key

`Invoice.orderId` keeps the column and keeps the relation, but the `@unique`
attribute is removed. This is the single change that lifts the database-level
restriction.

```
// Before
orderId String     @unique
order   SalesOrder @relation(fields: [orderId], references: [id])

// After
orderId String
order   SalesOrder @relation(fields: [orderId], references: [id])
```

### 2. Add a non-unique index on the foreign key

Removing `@unique` also removes the implicit index that previously backed lookups
by `orderId`. A plain `@@index([orderId])` is added to `Invoice` to preserve query
performance when fetching all invoices for an order.

### 3. Change the back-relation to a list

`SalesOrder.invoice Invoice?` becomes `SalesOrder.invoices Invoice[]` to express the
one-to-many cardinality on the Prisma side.

---

## Scope Boundaries (explicitly NOT changed)

- **Collection** — already many-to-one to `Invoice` via optional `invoiceId`. It works
  unchanged; collections continue to attach to whichever invoice they pay against.
- **LedgerEntry** — polymorphic (`referenceType` + `referenceId`, no FK). Order/invoice
  agnostic; no change required.
- **DueReport** — aggregates at the dealer level only; no order/invoice relation; no
  change required.
- **Dealer, Product, Project** — untouched.

No migration is run as part of this phase. No application/Orders code is built.

---

## Consequences

- The schema now permits 1 Order → Many Invoices.
- **Financial reconciliation becomes application logic.** With multiple invoices per
  order, the schema does not (and should not) enforce that the sum of invoice amounts
  reconciles to `SalesOrder.grandTotal`. Split/partial-invoice allocation must be
  handled in the Invoice engine (PHASE_05).
- **Due sequencing** (`previousDue` / `currentDue`) across multiple invoices of the same
  order must be ordered deterministically (e.g., by `issueDate` / `invoiceNo`) in
  application logic.
- A future enhancement may add an "invoiced quantity" field to `SalesOrderItem` to
  support partial-shipment invoicing. This is intentionally out of scope here.

---

## Verification

- `npx prisma format` — schema formatting and relation validation.
- `npx prisma generate` — Prisma Client regeneration with the new `invoices Invoice[]`
  relation field.
- Migration intentionally deferred (per phase instruction).
