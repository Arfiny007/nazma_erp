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
