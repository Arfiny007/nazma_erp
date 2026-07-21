# FINAL ARCHITECTURE DOCUMENTATION — Nazma Water Taps ERP

## PHASE_12B.1 Addendum (2026-07-20)

Territory Product Sales dynamic filter SQL alias hotfix.

| Concern | Decision |
|---------|----------|
| Bug | `eligible_invoice_items` WHERE referenced `eii.*` before that CTE existed |
| Fix | Stage-aware `buildEligibleInvoiceItemFilters()` — aliases `ii` / `p` / `c` only |
| Certification | RULE_PRODUCT_SALES_16 |
| ADR | ADR-061 query-stage filter section |
| Architecture | Unchanged CTE pipeline; localized query-generation regression only |

## PHASE_12B Addendum (2026-07-20)

Territory-wise Product Sales Report & role-aware Top-Selling Products dashboard chart.

| Concern | Decision |
|---------|----------|
| Sold quantity | `SUM(InvoiceItem.quantity)` for Issued/Paid/Partial/Overdue |
| Sale date | `Invoice.issueDate` |
| Territory attribution | `DealerOwnershipHistory` as-of issueDate; fallback to current dealer territory with diagnostics |
| Permission | `reports:territory-product-sales:view` — Super_Admin + Manager + SR |
| Route | `/reports/product-sales-by-territory` |
| Filters | Shared `parseTerritoryProductSalesFilters` (URL canonical) |
| Dashboard | Additive `topProductsByQuantity` horizontal bar via analytics service |
| Decimal | Aggregation in Prisma.Decimal; chart converts only at visual boundary |
| ADR | ADR-061 |
| Frozen engines | Untouched |

## PHASE_12A.1 Addendum (2026-07-20)

SR Performance Filter Stabilization, Split Print, Repository-Wide ESLint Closure, and Deployment-Parity.

| Concern | Decision |
|---------|----------|
| Filter contract | Shared `parseSrPerformanceFilters` — URL is canonical |
| Dates | Local `YYYY-MM-DD` parse/serialize; exclusive upper bound `to+1 day` |
| Attribution warnings | Dealer ownership integrity only — not multi-SR territory assignment |
| Print | `mode=individual` \| `mode=overview` independently |
| Soft-resolve | Invalid `srId` canonicalized via SSR redirect + client URL sync; compatible territory keeps `srId` |
| Certification | `phase` / `phase12a1Approved` / `approved`; RULE_SR_REPORT_01–15 |
| ESLint | Four baseline `set-state-in-effect` defects remediated (derived state + `useSyncExternalStore`); no suppressions |
| Deployment parity | App container must run certified image (`RUNNING_IMAGE_MATCH=true`) before FULLY CERTIFIED |
| ADR | ADR-060 stabilization + ESLint + deployment-parity revision |
| Frozen engines | Untouched |

## PHASE_12A Addendum (2026-07-19)

Printable SR Performance & Ledger Dashboard (`/reports/sr-performance`).

| Concern | Decision |
|---------|----------|
| Permission | `reports:sr-performance:view` — Super_Admin + Manager |
| Financial source | `LedgerEntry` only (not `Dealer.currentBalance`) |
| Previous Due | Latest ledger balance before `from` using statement ORDER BY DESC |
| Sales / Collection | Issue debit; Collection credit − Collection Reversal debit |
| Formula | Balance/Net = Previous Due + Sales − Collection (Prisma.Decimal) |
| Attribution | Active ownership `assignedSrId`; integrity diagnostics for duplicate/ambiguous/missing ownership |
| Queries | Bounded findMany + 2 parameterized `$queryRaw` aggregates (anti-N+1) |
| Print | Document Platform composer; split individual/overview modes |
| ADR | ADR-060 |
| Frozen engines | Untouched (posting, statement, due, territory RBAC impl, dashboard) |

---

CLIENT_FEEDBACK_LOG.md
Client Feedback Log — Nazma Water Taps ERP
Permanent chronological record of significant client and business requests, architectural responses, and delivery status. This document preserves change history across AI sessions and team handoffs.

Last updated: 2026-06-30 (PHASE_06D complete)

How to Read This Log
Status	Meaning
Implemented
Delivered and verified in codebase
Deferred
Approved for a future phase; not yet built
Pending
Acknowledged; not yet scheduled
Rejected
Considered and intentionally not adopted
Entries (Chronological)
1. Enterprise ERP Quality — Foundation
Field	Detail
Date/Phase
PHASE_01 — 2026 (early project)
Client Request
Build a premium, enterprise-grade ERP — not a basic admin template
Business Reason
Nazma Metal Industries requires professional tooling for dealers, accounts staff, and management; brand reputation depends on polish
Architecture Decision
Stripe / Linear / Vercel Enterprise design language; high-density tables, skeleton states, bilingual EN/BN, Docker-first deployment
Current Status
Implemented (ongoing standard across all modules)
Related ADR
—
Related Phase
PHASE_01_FOUNDATION, all subsequent UI phases
2. English + Bengali Localization
Field	Detail
Date/Phase
PHASE_01 — 2026
Client Request
Full bilingual support; language switch without page refresh
Business Reason
Dealers and staff operate in both English and Bengali
Architecture Decision
public/locales/{en,bn}/common.json; useLanguage() hook; translation keys mandatory — no hardcoded UI strings
Current Status
Implemented
Related ADR
—
Related Phase
PHASE_01_FOUNDATION
3. Role-Based Access Control
Field	Detail
Date/Phase
PHASE_AUTH_02 — 2026
Client Request
Four roles with distinct permissions: Super_Admin, Manager, Accounts, SR
Business Reason
Separation of duties — SRs sell, Accounts handle money, Managers approve
Architecture Decision
Centralized permissions.ts matrix; middleware route guards; requirePermission() on server actions
Current Status
Implemented
Related ADR
—
Related Phase
PHASE_AUTH_02_RBAC
4. Partial Invoicing / Multiple Invoices per Order
Field	Detail
Date/Phase
PHASE_00C — 2026-06-23
Client Request
One sales order may produce multiple invoices (partial shipments, staged billing)
Business Reason
Real-world distribution: orders are rarely fulfilled in a single shipment
Architecture Decision
Remove @unique on Invoice.orderId; SalesOrder.invoices Invoice[]; reconciliation is application logic
Current Status
Implemented (schema); fulfillment path refined in ADR-011
Related ADR
ADR-007
Related Phase
PHASE_00C_INVOICE_RELATION_CORRECTION
5. Delivery Challan Workflow (Fulfillment Layer)
Field	Detail
Date/Phase
PHASE_05A — 2026-06-25
Client Request
Separate physical delivery from financial invoicing; record what was shipped before billing
Business Reason
Goods move before payment; receivables must not be created at dispatch; audit trail for logistics
Architecture Decision
Order → Delivery Challan → Invoice pipeline; challan is NON-FINANCIAL; one challan → exactly one invoice
Current Status
Implemented
Related ADR
ADR-011, ADR-012, ADR-013
Related Phase
PHASE_05A–05B
6. Partial Delivery Support
Field	Detail
Date/Phase
PHASE_05A — 2026-06-25
Client Request
Ship and bill portions of an order across multiple deliveries
Business Reason
Warehouse capacity, vehicle loads, and dealer acceptance often require split shipments
Architecture Decision
One order → many challans; derived remainingQty / allocatableQty; Partially_Delivered order status; over-delivery guards
Current Status
Implemented
Related ADR
ADR-011, ADR-012
Related Phase
PHASE_05A2, PHASE_05B
7. Invoice Must Not Come Directly from Order
Field	Detail
Date/Phase
PHASE_05A — 2026-06-25
Client Request
(Implicit via fulfillment layer approval) Bill only what was physically dispatched
Business Reason
Prevents premature receivables; aligns revenue with shipment evidence
Architecture Decision
Invoice quantities sourced exclusively from DeliveryChallanItem; confirmed challan required
Current Status
Implemented
Related ADR
ADR-011, ADR-014
Related Phase
PHASE_05C1
8. Mandatory Line-Item Invoices (No Header-Only)
Field	Detail
Date/Phase
PHASE_05C — 2026-06-25
Client Request
Every invoice must show product-level detail for audit and reporting
Business Reason
Product-level sales reports, GST/VAT audit readiness, partial-shipment accuracy
Architecture Decision
InvoiceItem required on every invoice; immutable snapshots at issue; header-only invoices forbidden
Current Status
Implemented
Related ADR
ADR-011, ADR-014
Related Phase
PHASE_05C1
9. Credit Limit at Invoice Issue Only
Field	Detail
Date/Phase
PHASE_05C — 2026-06-25
Client Request
Do not block order approval or challan dispatch on credit; check exposure when invoicing
Business Reason
Operations must continue; financial risk gate belongs at receivable creation
Architecture Decision
wouldExceedCreditLimit() in issueInvoice() only; challan actions have zero credit impact
Current Status
Implemented
Related ADR
ADR-011, ADR-014
Related Phase
PHASE_05C1
10. Enterprise Invoice UI
Field	Detail
Date/Phase
PHASE_05D1 — 2026-06-25
Client Request
Professional invoice list, detail, and issue workflow matching order/challan UX quality
Business Reason
Accounts team issues invoices daily; must be fast, filterable, and auditable
Architecture Decision
Hybrid Server/Client pages; eligible challan picker; server preview before issue; no client money math
Current Status
Implemented
Related ADR
ADR-016
Related Phase
PHASE_05D1
11. Client-Approved Invoice Layout / Redesign
Field	Detail
Date/Phase
PHASE_05D2 — 2026-06-27
Client Request
Printable invoice matching approved Nazma business document layout
Business Reason
Invoices are legal/commercial documents sent to dealers; must reflect company identity
Architecture Decision
Enterprise Document Engine: DocumentLayout, section components, single InvoicePrintable pipeline
Current Status
Implemented
Related ADR
ADR-017
Related Phase
PHASE_05D2
12. 20-Row Printable Invoice (A4 Fixed Grid)
Field	Detail
Date/Phase
PHASE_05D2 / PHASE_05D3 — 2026-06-27
Client Request
Standard A4 invoice with fixed product table accommodating up to 20 line items without layout breakage
Business Reason
Typical Nazma invoices fit one page; consistent print appearance for dealers
Architecture Decision
DOCUMENT_MAX_PRODUCT_ROWS = 20; fixed row height; placeholder padding rows; screen warning for >20 lines
Current Status
Implemented (1–20 rows certified); >20 lines Deferred
Related ADR
ADR-017, ADR-018
Related Phase
PHASE_05D2, PHASE_05D3
13. Remove Bank Details from Invoice
Field	Detail
Date/Phase
PHASE_05D2 — 2026-06-27
Client Request
Omit bank account details from printed invoice
Business Reason
Approved design decision — payment handled separately; reduces document clutter
Architecture Decision
Bank details section intentionally omitted from InvoicePrintable; collection captures payment method separately
Current Status
Implemented (omission is the approved design)
Related ADR
ADR-017
Related Phase
PHASE_05D2
14. Official Nazma Branding on Documents
Field	Detail
Date/Phase
PHASE_05D2 — 2026-06-27
Client Request
Company logo, name, address, contact on all printable documents
Business Reason
Brand identity on every document leaving the company
Architecture Decision
getCompanyBranding() in company-branding.ts; public/branding/nazma-logo.png; CompanyHeader / CompanyFooter
Current Status
Implemented (hardcoded defaults); settings UI Deferred
Related ADR
ADR-017, ADR-023
Related Phase
PHASE_05D2, PHASE_06C
15. Browser Print + Save-as-PDF (No Raster PDF)
Field	Detail
Date/Phase
PHASE_05D2 — 2026-06-27
Client Request
Print and PDF export from the same preview; professional output
Business Reason
Avoid low-quality screenshot PDFs; vector output for accounting archives
Architecture Decision
Single React tree → window.print() → browser Save as PDF; no html2canvas/server Chromium
Current Status
Implemented
Related ADR
ADR-017, ADR-018
Related Phase
PHASE_05D2
16. Invoice Financial Block — Previous Due / Current Due / Outstanding
Field	Detail
Date/Phase
PHASE_05D3 — 2026-06-27
Client Request
Invoice must show dealer's running account position at time of issue
Business Reason
Dealers need to see total obligation including prior balance on every invoice
Architecture Decision
previousDue snapshot at issue; currentDue = previousDue + grandTotal; outstanding server-computed
Current Status
Implemented
Related ADR
ADR-014, ADR-018
Related Phase
PHASE_05C1, PHASE_05D3
17. Payment Terms Aligned with Due Date (30 Days)
Field	Detail
Date/Phase
PHASE_05D3 — 2026-06-27
Client Request
Payment terms text must match actual dueDate on invoice
Business Reason
Mismatched terms (7 days text vs 30-day due date) confuses dealers
Architecture Decision
INVOICE_DEFAULT_DUE_DAYS = 30; payment terms use {days} interpolation
Current Status
Implemented
Related ADR
ADR-018
Related Phase
PHASE_05D3
18. VAT Not Shown on Orders (Included in Price)
Field	Detail
Date/Phase
PHASE_04 — 2026
Client Request
Unit prices are VAT-inclusive; do not add separate VAT line on orders
Business Reason
Nazma pricing model includes tax in quoted prices
Architecture Decision
vat = 0.00 in order calculator; VAT row on invoice shows 0 with included-in-price semantics
Current Status
Implemented
Related ADR
ADR-008, ADR-009
Related Phase
PHASE_04A, PHASE_04B
19. Collections — Cash Receipt Separate from Allocation
Field	Detail
Date/Phase
PHASE_06A1 — 2026-06-28
Client Request
Record cash received first; apply to invoices later (including advance/overpayment)
Business Reason
Dealers often pay before invoice allocation is decided; advance payments are common
Architecture Decision
Collection cash pool model: receivedAmount = allocatedAmount + unallocatedAmount; confirm posts cash once
Current Status
Implemented
Related ADR
ADR-019, ADR-020
Related Phase
PHASE_06A1, PHASE_06A2
20. Generic Allocation Engine (Not Invoice-Only)
Field	Detail
Date/Phase
PHASE_06A1 — 2026-06-28
Client Request
Payments should eventually apply to credit notes, opening balances, adjustments — not only invoices
Business Reason
Enterprise ERP requires polymorphic payment application for future document types
Architecture Decision
CollectionAllocation with FinancialReferenceType enum; reference-resolver.ts handler pattern
Current Status
Implemented (Invoice handler); other types Deferred
Related ADR
ADR-019, ADR-020, ADR-024
Related Phase
PHASE_06A2
21. Advance Payment / Negative AR Balance
Field	Detail
Date/Phase
PHASE_06A2 — 2026-06-28
Client Request
Accept overpayment; dealer credit must be representable in the system
Business Reason
Large dealers prepay; credit must carry forward to future invoices
Architecture Decision
Negative Dealer.currentBalance allowed; isAdvancePayment flag; blue "Advance Credit" UI badge
Current Status
Implemented
Related ADR
ADR-019, ADR-020, ADR-021, ADR-024
Related Phase
PHASE_06A2, PHASE_06B
22. Collection Reversal with Audit Trail
Field	Detail
Date/Phase
PHASE_06A2 — 2026-06-28
Client Request
Correct erroneous collections without editing confirmed records
Business Reason
Accounting requires compensating entries, not silent edits
Architecture Decision
reverseCollection() with required reason; postReceivableDecreaseReversal(); status Reversed
Current Status
Implemented
Related ADR
ADR-020, ADR-021
Related Phase
PHASE_06A2, PHASE_06B
23. Enterprise Collections UI
Field	Detail
Date/Phase
PHASE_06B — 2026-06-30
Client Request
Full collection workspace: create, confirm, allocate, reverse — matching invoice UX quality
Business Reason
Accounts team processes daily cash receipts; must be efficient and error-resistant
Architecture Decision
Unified workspace; server allocation preview; dealer financial summary sidebar; bilingual
Current Status
Implemented
Related ADR
ADR-022
Related Phase
PHASE_06B
24. Money Receipt Printable Document
Field	Detail
Date/Phase
PHASE_06C — 2026-06-30
Client Request
Accountant-grade money receipt for every confirmed collection — preview, print, PDF
Business Reason
Legal proof of payment for dealers; internal audit requirement
Architecture Decision
MoneyReceiptPrintable; route /collections/[id]/receipt; shared document platform; draft/reversed blocked
Current Status
Implemented
Related ADR
ADR-023
Related Phase
PHASE_06C
25. Dealer Profile / Reporting Foundation Fields
Field	Detail
Date/Phase
PHASE_06A1 — 2026-06-28
Client Request
Dealer master should support sales targets, territory analytics, and activity tracking
Business Reason
Management needs SR performance dashboards and territory collection reports
Architecture Decision
monthlyTarget, yearlyTarget, totalSales, lastCollectionDate, lastInvoiceDate on Dealer
Current Status
Deferred (schema ready; computation and UI not built)
Related ADR
ADR-019, ADR-024
Related Phase
PHASE_06A1; reporting phases TBD
26. Due Reports / Overdue Tracking
Field	Detail
Date/Phase
PROJECT_BRAIN — ongoing
Client Request
Due amount reports by dealer, aging, territory
Business Reason
Collections team prioritizes follow-up on overdue accounts
Architecture Decision
DueReport model exists; Invoice.currentDue, dueDate, status ready; report UI not built
Current Status
Deferred
Related ADR
ADR-021, ADR-024
Related Phase
PHASE_08_DUE_REPORTS
27. Ledger / Dealer Statement
Field	Detail
Date/Phase
PROJECT_BRAIN — ongoing
Client Request
Full financial ledger and printable dealer account statement
Business Reason
Accountants require running balance history and audit-grade statements
Architecture Decision
Hybrid statement: LedgerEntry running balance + document line detail; posting service extension
Current Status
Deferred (architecture certified; implementation next)
Related ADR
ADR-024
Related Phase
PHASE_07A–07D
28. Delivery Challan PDF / Gate Pass
Field	Detail
Date/Phase
ADR-011 Future Roadmap
Client Request
Printable dispatch document for driver and gate security
Business Reason
Physical goods movement requires paper trail at warehouse gate
Architecture Decision
Reuse document platform (DocumentLayout + challan sections)
Current Status
Deferred
Related ADR
ADR-011, ADR-017, ADR-023
Related Phase
Post PHASE_05D
29. Delivery Reporting (Register, Pending Dispatch, Fulfillment Rate)
Field	Detail
Date/Phase
ADR-011 Future Roadmap
Client Request
Operational reports on delivery performance
Business Reason
Management visibility into fulfillment efficiency
Architecture Decision
Query challan + order derived quantities; no new schema required
Current Status
Deferred
Related ADR
ADR-011
Related Phase
Post PHASE_05D
30. Territory / Area Collection Analytics
Field	Detail
Date/Phase
ADR-021 / ADR-024
Client Request
Collection and sales reports grouped by dealer territory
Business Reason
SR and regional manager performance tracking
Architecture Decision
Dealer.territory + invoice/collection joins; optional denormalization later
Current Status
Deferred
Related ADR
ADR-021, ADR-024
Related Phase
Reporting phase TBD
31. Management Dashboard / Analytics
Field	Detail
Date/Phase
ADR-024
Client Request
Executive dashboard with sales, collections, dues, fulfillment KPIs
Business Reason
Leadership needs at-a-glance business health
Architecture Decision
Aggregate from Invoice, Collection, DeliveryChallan; totalSales denormalization optional
Current Status
Deferred
Related ADR
ADR-024
Related Phase
Post PHASE_07
32. Invoice Layout Refinements (QA Pass)
Field	Detail
Date/Phase
PHASE_05D3 — 2026-06-27
Client Request
Fix payment terms mismatch; show outstanding on detail; VAT row on issue preview; Bengali Bill To/Ship To
Business Reason
Production QA before collections phase
Architecture Decision
Remediations in ADR-018; centralized useFormatMoney; hasMoneyValue() comparisons
Current Status
Implemented
Related ADR
ADR-018
Related Phase
PHASE_05D3
33. Bill To = Ship To (Dealer-Only B2B)
Field	Detail
Date/Phase
PHASE_05D3 — 2026-06-27
Client Request
(Accepted limitation) Same party on both address columns
Business Reason
Nazma sells to dealers directly; separate ship-to rarely needed in v1
Architecture Decision
Both columns populated from dealer record; future project ship-to optional
Current Status
Implemented (acceptable v1)
Related ADR
ADR-018
Related Phase
PHASE_05D2
34. Sales Person = Territory (v1)
Field	Detail
Date/Phase
PHASE_05D2 — 2026-06-27
Client Request
Show sales person on invoice
Business Reason
Dealer knows their territory contact
Architecture Decision
salesPerson maps to Dealer.territory for v1; proper SR denormalization deferred
Current Status
Implemented (approximation); proper SR mapping Deferred
Related ADR
ADR-018
Related Phase
PHASE_05D2
35. UI/UX — DealerCombobox Reliability
Field	Detail
Date/Phase
PHASE_04C — 2026-06
Client Request
Dealer dropdown on order form must work reliably — not clipped, not silently empty on error
Business Reason
Order creation blocked if dealer cannot be selected
Architecture Decision
Transport error boundary; localized error states; z-index fix for section stacking
Current Status
Implemented
Related ADR
ADR-010
Related Phase
PHASE_04C
36. UI/UX — Enterprise Data Tables
Field	Detail
Date/Phase
PHASE_02B through PHASE_06B
Client Request
Search, filter, sort, pagination on all list views
Business Reason
High-volume daily operations require fast data discovery
Architecture Decision
TanStack Table; server-side list actions; consistent filter/skeleton/empty patterns
Current Status
Implemented (orders, products, dealers, challans, invoices, collections)
Related ADR
ADR-004, ADR-009, ADR-013, ADR-016, ADR-022
Related Phase
Multiple
37. Credit Limit Manager Override
Field	Detail
Date/Phase
ADR-011 Future
Client Request
Manager should be able to override credit block with audit
Business Reason
Trusted dealers occasionally exceed limit with management approval
Architecture Decision
RBAC-gated override workflow with audit log
Current Status
Deferred
Related ADR
ADR-011
Related Phase
Future enhancement
38. Email / SMS Invoice and Receipt Delivery
Field	Detail
Date/Phase
ADR-017 / ADR-023 Out of Scope
Client Request
Send documents to dealers electronically
Business Reason
Faster delivery; reduced printing
Architecture Decision
Deferred until document pipeline stable
Current Status
Deferred
Related ADR
ADR-017, ADR-023
Related Phase
Post PHASE_07
39. Invoice Void / Credit Note
Field	Detail
Date/Phase
ADR-024
Client Request
Correct issued invoices (returns, billing errors)
Business Reason
Accountants cannot operate without reversal mechanism for receivables
Architecture Decision
postCreditNote() / postInvoiceReversal() via posting service; never edit issued lines
Current Status
Deferred
Related ADR
ADR-024
Related Phase
PHASE_07B or dedicated phase
40. Collections Linked Directly to Invoice (Legacy Model)
Field	Detail
Date/Phase
PHASE_06A1 — 2026-06-28
Client Request
(Architectural — not a client ask) Legacy init schema had Collection.invoiceId
Business Reason
Enterprise ERP requires cash pool + generic allocation
Architecture Decision
Rejected direct invoice link; replaced with CollectionAllocation polymorphic model
Current Status
Rejected (superseded)
Related ADR
ADR-019
Related Phase
PHASE_06A1
FINANCIAL_INVARIANTS.md
Financial Invariants — Nazma Water Taps ERP
Authoritative engineering rulebook. Every rule below is mandatory. Violation constitutes a production defect and potential accounting corruption.

Certification basis: ADR-015, ADR-021, ADR-024
Last updated: 2026-06-30

1. Dealer Balance (Dealer.currentBalance)
Rule	Detail
Sole writer
ONLY src/lib/finance/posting-service.ts may mutate Dealer.currentBalance
Semantics
Positive = dealer owes company (AR); Zero = settled; Negative = company owes dealer (advance/credit)
Role
Operational cache for fast lookup, credit limit, UI badges — NOT primary accounting source of truth
Reconciliation
Must reconcile to ledger entries (PHASE_07+) and document replay
Forbidden
Direct dealer.update({ currentBalance }) from feature code, UI, or allocation engine
2. Decimal Handling
Rule	Detail
Database
All monetary fields: Decimal @db.Decimal(18, 2)
Application
Use Prisma Decimal type; never JavaScript number for money
Calculations
Decimal-safe engines only (order-calculator, invoice-calculator, Prisma { increment } / { decrement })
Display
format-money.ts / useFormatMoney for presentation only — not calculation
Forbidden
parseFloat, Number(), floating-point arithmetic on money
3. Transaction Boundaries
Rule	Detail
Atomicity
Every financial mutation occurs inside a single prisma.$transaction
Scope
Document persistence + posting service + audit log + related field updates commit together or roll back together
Examples
issueInvoice(), confirmCollection(), allocateCollection(), reverseCollection()
Forbidden
Multi-step financial updates across separate transactions without compensating design
4. Dealer Row Lock
Rule	Detail
Function
lockDealerForFinancialUpdate() in src/lib/finance/dealer-lock.ts
Mechanism
SELECT … FOR UPDATE on dealer row before any balance read or write
Required on
Invoice issue, collection confirm, allocate, deallocate, reverse
Purpose
Prevent lost updates, stale previousDue, credit limit TOCTOU under concurrent access
Forbidden
Financial mutations without dealer lock when balance or credit is involved
5. Financial Posting Service
Rule	Detail
Location
src/lib/finance/posting-service.ts
Mandate
ALL future financial operations MUST pass through this module
Current functions
postReceivableIncrease(), postReceivableDecrease(), postReceivableDecreaseReversal()
Future functions
postOpeningBalance(), postCreditNote(), postDebitNote(), postInvoiceReversal(), postJournalEntry()
Side effects
Balance update + audit log (+ ledger entry in PHASE_07)
Forbidden
Feature-level balance mutations bypassing posting service
6. Pipeline Financial Boundaries
Sales Order — NON-FINANCIAL
No Dealer.currentBalance changes
No ledger entries
No due report impact
Commercial terms only
Delivery Challan — NON-FINANCIAL
Must NEVER update Dealer.currentBalance
Must NEVER create LedgerEntry rows
Must NEVER affect DueReport aggregates
Must NEVER record collections
Must NOT import src/lib/finance/
Credit limit NOT evaluated at dispatch
Invoice — FINANCIAL BOUNDARY BEGINS HERE
Revenue recognized at issue (status → Issued)
postReceivableIncrease() on issue
Updates dealer balance, previousDue, currentDue
Credit limit evaluated at issue only
Immutable after issue (lines never edited)
Collection Confirm — FINANCIAL (Cash)
postReceivableDecrease() on confirmation
Full receivedAmount posted once
Collection immutable after confirmation
Allocation — NON-BALANCE
Moves cash within collection pool
Updates Invoice.collectionReceived and currentDue
Must NEVER call posting service for balance changes
Cash was already posted on confirmation
Money Receipt / Document Platform — PRESENTATION ONLY
Must NEVER calculate financial values
All amounts from server DTO strings
Preview = Print = PDF (same component tree)
7. Invoice Invariants
Rule	Detail
Source
One confirmed DeliveryChallan → exactly one Invoice
Quantities
From DeliveryChallanItem only — never from SalesOrderItem.quantity directly
Lines required
InvoiceItem mandatory; header-only invoices forbidden
Immutability
Issued invoice lines are permanent snapshots; product/price changes do not alter issued lines
Snapshots
previousDue captured from locked dealer balance at issue; never recomputed from live state for historical display
currentDue
previousDue + grandTotal at issue; reduced by allocation, not by re-issue
Duplicate prevention
Unique deliveryChallanId; idempotent re-issue returns existing invoice
Forbidden
Editing issued InvoiceItem rows; voiding without compensating entry (future credit note)
8. Collection Invariants
Rule	Detail
Pool invariant
receivedAmount = allocatedAmount + unallocatedAmount — enforced after every pool mutation
Immutability
Confirmed collections cannot be edited; corrections via reverseCollection() only
Cash posting
Balance decreases exactly once on confirmation
Advance
Negative AR allowed; no floor on balance decrement
Reversal
postReceivableDecreaseReversal() restores balance; invoice fields reversed per allocation row
Idempotency
Duplicate confirmation returns early without double-posting
Forbidden
Editing confirmed collection headers; double cash posting on allocation
9. Allocation Invariants
Rule	Detail
Cap
Allocatable amount = invoice.grandTotal − invoice.collectionReceived
Overpayment guard
collectionReceived must never exceed grandTotal
Pool cap
Single allocation cannot exceed unallocatedAmount
Uniqueness
One allocation per (collectionId, referenceType, referenceId)
Dealer match
Reference document must belong to same dealer as collection
No balance post
Allocation must NEVER directly modify Dealer.currentBalance
Forbidden
Using currentDue − collectionReceived as allocation cap (double-counts payments)
10. Advance Payment Invariants
Rule	Detail
Receipt
Full cash posted on collection confirm regardless of immediate allocation
Credit
Unallocated portion remains in pool; dealer balance may go negative
Application
Future invoice allocation reduces invoice dues without additional cash post
Display
Advance shown as credit (blue badge), not error state
Forbidden
Rejecting collection that would create negative AR
11. Quantity / Fulfillment Invariants
Rule	Detail
Derived quantities
remainingQty and allocatableQty computed from challan history — not stored columns
Over-delivery
requestedQty ≤ allocatableQty on every challan create/update/confirm
Confirmed only
Only confirmed challan quantities count toward delivered totals
Draft reservation
Draft challans reduce allocatableQty but not remainingQty display
Forbidden
Persisted remainingQuantity on SalesOrderItem; billing qty from order instead of challan
12. Audit Invariants
Rule	Detail
Retention
Never delete financial history
Events
INVOICE_CREATED, DEALER_BALANCE_UPDATED, COLLECTION_*, DEALER_BALANCE_DECREASED
Immutability
Audit log entries are append-only
Reversal audit
COLLECTION_REVERSED* preserves allocation amounts even when allocation rows deleted
Forbidden
Hard-deleting invoices, confirmed collections, or ledger entries
13. Reversal Invariants
Rule	Detail
Model
Compensating transactions only — never silent edits
Collection
Status → Reversed; balance restored; invoice fields reversed
Invoice
Not yet implemented — future postInvoiceReversal() / credit note
Ledger
Future entries linked via reversesEntryId
Forbidden
Rewriting historical financial document values in place
14. Source-of-Truth Hierarchy
TIER 1 — AUTHORITATIVE (PHASE_07+)
  LedgerEntry (append-only journal subledger)
TIER 2 — DOCUMENT TRUTH
  Invoice, InvoiceItem, Collection, CollectionAllocation
TIER 3 — OPERATIONAL CACHE
  Dealer.currentBalance
  Invoice.currentDue / collectionReceived
  Collection pool fields
Reports and statements must not trust Tier 3 alone without reconciliation to Tier 1/2.

15. Concurrency Invariants
Rule	Detail
Serialization
Same-dealer financial operations serialized via row lock
Atomic updates
Balance changes use Prisma { increment } / { decrement } with post-write assertion
Idempotency
Invoice issue and collection confirm have idempotent retry paths
Future
Ledger posting requires postingKey unique constraint
16. Credit Limit Invariants
Rule	Detail
When
Evaluated only at issueInvoice()
Formula
projectedExposure = dealer.currentBalance + invoice.grandTotal
Lock
Credit check uses balance from dealer row lock
Not evaluated
Order approval, challan dispatch, collection
Forbidden
Credit check without dealer lock under concurrency
17. Document Platform Invariants
Rule	Detail
No client math
React components display server-formatted strings only
Single pipeline
Same component for preview, print, and PDF
Print guard
Draft and reversed documents blocked from print routes
Forbidden
Client-side sum/subtract of monetary fields; rasterized PDF generation
Enforcement Checklist for New Code
Before merging any financial feature:


 Uses Decimal(18,2) — no number for money

 Inside prisma.$transaction

 Calls lockDealerForFinancialUpdate() when touching balance

 Routes balance changes through posting-service.ts

 Writes audit log in same transaction

 Does not mutate immutable issued documents

 Allocation does not double-post cash

 Delivery challan code has zero finance imports

 Document UI displays server values only
TECH_DEBT.md
Technical Debt Register — Nazma Water Taps ERP
Known deferred improvements categorized by priority. Each item includes rationale for deferral.

Last updated: 2026-06-30 (PHASE_06D)

HIGH Priority
H1. Ledger Posting Not Implemented
Field	Detail
Description
LedgerEntry model exists but no rows are created; posting service writes balance + audit only
Why deferred
Invoice and collections pipeline required first; ADR-024 certified architecture before ledger build
Risk if ignored
No authoritative journal; statements rely on document replay
Target phase
PHASE_07B
H2. Ledger Schema Hardening
Field	Detail
Description
LedgerEntry.referenceType is String not enum; missing postingKey, postingType, reversesEntryId, createdById
Why deferred
Schema designed in PHASE_00B; hardening planned as isolated migration before posting logic
Risk if ignored
Type drift, duplicate entries on retry, weak reversal linkage
Target phase
PHASE_07A
H3. Invoice Void / Credit Note Workflow
Field	Detail
Description
No mechanism to reverse issued invoices (returns, billing errors)
Why deferred
Collections and allocation engine prioritized; compensating model designed in ADR-024
Risk if ignored
Accountants cannot correct issued receivables in-system
Target phase
PHASE_07B or dedicated phase
H4. Multi-Page Invoice Support (>20 Lines)
Field	Detail
Description
Invoices with more than 20 line items show screen warning; print truncates beyond 20 rows
Why deferred
95%+ Nazma invoices fit one A4 page; fixed grid certified for 1–20 rows first
Risk if ignored
Large orders produce incomplete printed invoices
Target phase
Post-Collections document enhancement
H5. Balance Reconciliation Job
Field	Detail
Description
No automated check that Dealer.currentBalance matches ledger or document replay
Why deferred
Requires ledger posting (PHASE_07) before meaningful reconciliation
Risk if ignored
Silent balance drift undetected in production
Target phase
PHASE_07E
H6. postingKey Idempotency on All Postings
Field	Detail
Description
Invoice issue and collection confirm have idempotent paths; ledger lacks postingKey unique constraint
Why deferred
Ledger not yet posting; key design documented in ADR-024
Risk if ignored
Duplicate ledger lines on network retry
Target phase
PHASE_07A–07B
MEDIUM Priority
M1. Server-Side Headless PDF Generation
Field	Detail
Description
PDF export uses browser Save-as-PDF; output varies by browser
Why deferred
Vector HTML/CSS pipeline delivers acceptable quality; avoids Chromium infrastructure cost
Risk if ignored
Minor visual variance across browsers; no server-side PDF automation
Target phase
Optional future
M2. Company Settings Module
Field	Detail
Description
Branding hardcoded in getCompanyBranding() / DEFAULT_COMPANY_BRANDING
Why deferred
Extension point ready; settings UI not blocking core operations
Risk if ignored
Branding changes require code deploy
Target phase
Future settings phase
M3. Collection Concurrency Integration Tests
Field	Detail
Description
Invoice concurrency tests exist (PHASE_05C2A); collection pattern mirrors but lacks dedicated tests
Why deferred
Dealer lock pattern proven on invoice path; audit certified collection engine at 9.2/10
Risk if ignored
Lower confidence under high concurrent collection load
Target phase
Pre-production hardening or PHASE_07
M4. CollectionAllocation Soft-Delete on Reversal
Field	Detail
Description
Allocation rows hard-deleted on reversal; historical allocation list incomplete from DB alone
Why deferred
Audit log preserves amounts (COLLECTION_REVERSED_MISALLOCATION); acceptable for v1
Risk if ignored
Statement reconstruction requires audit join after reversal
Target phase
Optional enhancement
M5. Dealer Analytics Field Population
Field	Detail
Description
totalSales, lastCollectionDate, lastInvoiceDate schema exists but not auto-updated
Why deferred
Reporting phase not started; fields reserved for future dashboards
Risk if ignored
Dealer profile shows stale/zero analytics
Target phase
Reporting phase
M6. Due Report UI
Field	Detail
Description
DueReport model unused; no overdue/aging report screens
Why deferred
Core collection recording prioritized over reporting
Risk if ignored
Collections team lacks systematic overdue visibility
Target phase
PHASE_08
M7. Dealer Statement UI
Field	Detail
Description
Hybrid statement architecture designed; no printable statement route
Why deferred
Requires ledger posting for authoritative running balance column
Risk if ignored
Accountants cannot generate account statements from ERP
Target phase
PHASE_07D
M8. Composite Database Indexes for Reporting
Field	Detail
Description
Missing (dealerCode, collectionDate) on Collection; partial coverage on Invoice date indexes
Why deferred
Current data volume acceptable; indexes planned before scale
Risk if ignored
Slow statement/aging queries at scale
Target phase
PHASE_07–08
M9. Invoice.issuedById Denormalization
Field	Detail
Description
Issuing user only in audit log, not on invoice header
Why deferred
Audit trail sufficient for v1; reporting convenience enhancement
Risk if ignored
Extra audit join for "issued by" reports
Target phase
Reporting enhancement
M10. Credit Limit Manager Override Workflow
Field	Detail
Description
Credit block is hard stop; no RBAC-gated override with audit
Why deferred
ADR-011 marked as future enhancement; basic credit check sufficient for launch
Risk if ignored
Manager cannot approve exceptions in-system
Target phase
Future enhancement
M11. Delivery Challan PDF
Field	Detail
Description
Challan detail has basic print; no enterprise document-engine challan printable
Why deferred
Invoice and money receipt documents prioritized
Risk if ignored
Gate pass / driver document not enterprise-grade
Target phase
Post PHASE_06
M12. Logistics Field Migration off Invoice
Field	Detail
Description
deliveryMode, vehicleNo, driverName may still exist on legacy Invoice columns
Why deferred
Application treats them as challan attributes; full column removal deferred
Risk if ignored
Schema ambiguity for future maintainers
Target phase
Future schema cleanup
M13. Chart of Accounts / Full GL
Field	Detail
Description
No COA, Trial Balance, P&L, Balance Sheet
Why deferred
AR subledger first; multi-account GL is platform-level scope
Risk if ignored
Cannot produce statutory financial statements
Target phase
PHASE_07F+
LOW Priority
L1. QR Codes on Documents
Field	Detail
Description
DocumentLayout.extensionSlot reserved; no QR implementation
Why deferred
Not required for v1 document delivery
Target phase
Future
L2. Barcode on Documents
Field	Detail
Description
No barcode rendering on invoices or receipts
Why deferred
Nazma B2B workflow does not require barcode scanning in v1
Target phase
Future
L3. Digital Signatures
Field	Detail
Description
DocumentSignature is placeholder area; no cryptographic signature
Why deferred
Physical signature workflow sufficient for current operations
Target phase
Future
L4. Company Seal Image
Field	Detail
Description
DocumentSeal placeholder; no seal image asset
Why deferred
Cosmetic; signature area sufficient for v1
Target phase
Future
L5. Full Modal Focus Trap
Field	Detail
Description
Document preview modal has initial focus + Escape; tab can escape dialog
Why deferred
Accessibility polish; core modal UX functional
Target phase
Accessibility polish phase
L6. Email / SMS Document Delivery
Field	Detail
Description
No automated sending of invoices or receipts
Why deferred
Print/PDF workflow sufficient; delivery infrastructure not scoped
Target phase
Post PHASE_07
L7. Denormalized Header Fields on Invoice
Field	Detail
Description
dealerName, orderNo, challanNo not denormalized on invoice header
Why deferred
Joins work; denormalization is resilience optimization for historical PDFs
Target phase
Future
L8. Proper Sales Person (SR) Mapping
Field	Detail
Description
salesPerson on invoice maps to dealer territory, not assigned SR user
Why deferred
Acceptable v1 approximation per ADR-018
Target phase
Reporting enhancement
L9. Separate Ship-To Address
Field	Detail
Description
Bill To and Ship To show same dealer address
Why deferred
Dealer-only B2B model; project ship-to rare in v1
Target phase
Future
L10. Challan Reversal / Return Workflow
Field	Detail
Description
Cancelled challan status exists; no formal return challan
Why deferred
Out of initial fulfillment scope per ADR-011
Target phase
Future
L11. Credit Reservation at Order Approval
Field	Detail
Description
No credit headroom reservation when order approved
Why deferred
ADR-011 explicitly defers; credit checked at invoice only
Target phase
Future enhancement
L12. useReactTable ESLint Warnings
Field	Detail
Description
Pre-existing lint warnings on table dependency arrays
Why deferred
Non-blocking; zero errors on CI
Target phase
Code quality sweep
L13. Audit Log UI Module
Field	Detail
Description
Audit events written; no dedicated audit log browser (PHASE_09)
Why deferred
Per-module timelines sufficient for v1
Target phase
PHASE_09
L14. User Management CRUD
Field	Detail
Description
Super Admin seed only; no user management UI
Why deferred
PHASE_10 scope
Target phase
PHASE_10
L15. Opening Balance Document
Field	Detail
Description
FinancialReferenceType.OpeningBalance reserved; no handler
Why deferred
Requires ledger + onboarding workflow
Target phase
PHASE_07C
KNOWN_RISKS.md
Known Risks — Nazma Water Taps ERP
Remaining production risks as of PHASE_06D (2026-06-30). None are blocking for controlled production use of Order → Invoice → Collection pipeline.

Overall readiness: 8.7 / 10 (ADR-024)

Financial Risks
F1. No Invoice Void / Credit Note
Attribute	Value
Severity
Medium
Impact
Cannot correct issued receivables in-system; manual workarounds required
Likelihood
Medium (billing errors occur in any business)
Mitigation
Design postInvoiceReversal() / credit note in PHASE_07; never edit issued lines
Future Phase
PHASE_07B or dedicated credit note phase
F2. Dealer.currentBalance as Sole Truth
Attribute	Value
Severity
Medium
Impact
Reports trusting cache without reconciliation may show incorrect balances
Likelihood
Low (posting service is sole writer; lock prevents lost updates)
Mitigation
Treat as operational cache; implement ledger + reconciliation job (PHASE_07E)
Future Phase
PHASE_07E
F3. Allocation Rows Deleted on Reversal
Attribute	Value
Severity
Low
Impact
Cannot reconstruct allocation history from DB alone after reversal
Likelihood
Low (reversals should be rare)
Mitigation
Audit log COLLECTION_REVERSED_MISALLOCATION preserves amounts; optional soft-delete
Future Phase
Optional enhancement
F4. No Opening Balance Handler
Attribute	Value
Severity
Medium
Impact
Cannot onboard dealers with pre-existing AR balance at go-live
Likelihood
High at production migration
Mitigation
postOpeningBalance() + PHASE_07C migration script
Future Phase
PHASE_07C
F5. Advance Payment GL Treatment
Attribute	Value
Severity
Low
Impact
Negative AR correct in subledger; full GL needs Customer Deposits liability account
Likelihood
Low until full GL required
Mitigation
AR subledger certified; map to liability account in COA phase
Future Phase
PHASE_07F+
Architecture Risks
A1. LedgerEntry Schema Stale
Attribute	Value
Severity
Medium
Impact
Type drift (referenceType String), no idempotency key, weak reversal linkage
Likelihood
Certain if ledger built without hardening
Mitigation
PHASE_07A schema migration before any posting logic
Future Phase
PHASE_07A
A2. Full GL Not Architected
Attribute	Value
Severity
Medium
Impact
Trial Balance, P&L, Balance Sheet impossible
Likelihood
Certain until COA phase
Mitigation
AR subledger first; COA + JournalLine in PHASE_07F
Future Phase
PHASE_07F+
A3. Single-Company Assumption
Attribute	Value
Severity
Low
Impact
Multi-company platform goal requires tenant isolation later
Likelihood
Low for Nazma single-entity deployment
Mitigation
Clean module boundaries; avoid hardcoded company assumptions in business logic
Future Phase
Platform v2
Performance Risks
P1. Dealer Row Lock Serialization
Attribute	Value
Severity
Low
Impact
Concurrent financial operations for same dealer queue sequentially
Likelihood
Medium under heavy same-dealer load
Mitigation
Keep transactions minimal; standard ERP trade-off; acceptable for B2B volume
Future Phase
Monitor in production
P2. Missing Composite Indexes
Attribute	Value
Severity
Low
Impact
Slow dealer statements and aging reports at scale
Likelihood
Low at initial data volume; increases over time
Mitigation
Add (dealerCode, collectionDate), (dealerCode, issueDate) before reporting phase
Future Phase
PHASE_07–08
P3. totalSales Not Computed
Attribute	Value
Severity
Low
Impact
Dealer analytics dashboards show zero/stale sales totals
Likelihood
Certain until reporting built
Mitigation
Compute from Invoice aggregates in reporting layer
Future Phase
Reporting phase
Concurrency Risks
C1. No Collection Concurrency Integration Tests
Attribute	Value
Severity
Low
Impact
Unproven edge cases under parallel collection/allocation for same dealer
Likelihood
Low (dealer lock mirrors proven invoice pattern)
Mitigation
Add tests mirroring PHASE_05C2A invoice concurrency suite
Future Phase
Pre-production hardening
C2. Long Transaction Under Dealer Lock
Attribute	Value
Severity
Low
Impact
Extended lock duration blocks other financial ops for same dealer
Likelihood
Low with current minimal transaction scope
Mitigation
No external API calls inside financial transactions; monitor lock duration
Future Phase
Ongoing
Reporting Risks
R1. Operational Reports Not Built
Attribute	Value
Severity
Medium
Impact
Due reports, cash book, territory analytics unavailable in UI
Likelihood
Certain
Mitigation
Schema and data model certified ready (ADR-021, ADR-024); build in PHASE_08
Future Phase
PHASE_08
R2. Statement Reconstruction Gaps
Attribute	Value
Severity
Low
Impact
Pre-ledger statements require document replay + audit for full history
Likelihood
Medium during PHASE_07 transition
Mitigation
Hybrid architecture: ledger running balance + document lines (ADR-024)
Future Phase
PHASE_07D
R3. DueReport Model Unused
Attribute	Value
Severity
Low
Impact
Scheduled aging snapshots not available
Likelihood
Certain until PHASE_08
Mitigation
Query live Invoice fields for v1; use DueReport for scheduled snapshots later
Future Phase
PHASE_08
UI Risks
U1. No Modal Focus Trap
Attribute	Value
Severity
Low
Impact
Keyboard users may tab outside document preview modal
Likelihood
Medium for accessibility-dependent users
Mitigation
Initial focus + Escape key; full focus trap in accessibility polish
Future Phase
Accessibility polish
U2. Advance Credit UX Confusion
Attribute	Value
Severity
Low
Impact
Users may misinterpret negative balance as error
Likelihood
Low (blue badge treatment implemented)
Mitigation
"Advance Credit" labeling; money receipt advance-retained message
Future Phase
Ongoing UX refinement
U3. Nav Placeholders for Unbuilt Modules
Attribute	Value
Severity
Low
Impact
/reports, /ledger may 404 if navigated
Likelihood
Low (sidebar may hide or placeholder)
Mitigation
Build modules or hide nav items until ready
Future Phase
PHASE_07–08
Printing Risks
PR1. Invoice >20 Lines Truncation
Attribute	Value
Severity
Medium
Impact
Printed invoice incomplete for large line counts
Likelihood
Low (most invoices ≤20 lines)
Mitigation
Screen warning banner; detail view shows all lines; multi-page deferred
Future Phase
Document engine enhancement
PR2. Browser PDF Variance
Attribute	Value
Severity
Low
Impact
Minor layout differences across Chrome/Edge/Firefox print engines
Likelihood
Medium
Mitigation
Accepted by design (ADR-017); test on target browsers; optional server PDF later
Future Phase
Optional
PR3. Hardcoded Company Branding
Attribute	Value
Severity
Low
Impact
Branding changes require code deploy
Likelihood
Low (branding rarely changes)
Mitigation
getCompanyBranding() extension point; company settings module
Future Phase
Settings phase
Scalability Risks
S1. Dealer Lock Contention at Scale
Attribute	Value
Severity
Low
Impact
Throughput ceiling for single high-volume dealer
Likelihood
Low for Nazma B2B scale
Mitigation
Acceptable ERP pattern; monitor p99 transaction time
Future Phase
Production monitoring
S2. No Read Replicas / Caching Layer
Attribute	Value
Severity
Low
Impact
All reads hit primary PostgreSQL
Likelihood
Low at initial scale
Mitigation
Index optimization; connection pooling via Docker; scale when needed
Future Phase
Infrastructure phase
S3. Reporting Readiness Score 7.0/10
Attribute	Value
Severity
Medium
Impact
Management visibility limited until reporting layer built
Likelihood
Certain
Mitigation
Certified data model; phased report delivery PHASE_08+
Future Phase
PHASE_08
Security Risks
SEC1. Seed Credentials in Documentation
Attribute	Value
Severity
Low (dev only)
Impact
Default admin credentials in NEXT_ACTION.md
Likelihood
High if deployed without password rotation
Mitigation
Rotate credentials before production; never use seed passwords in prod
Future Phase
Deployment checklist
SEC2. RBAC on Financial Actions
Attribute	Value
Severity
Low
Impact
Unauthorized financial mutations if RBAC bypassed
Likelihood
Low (middleware + action guards implemented)
Mitigation
Centralized requirePermission(); no inline permission checks only
Future Phase
Ongoing security review
ARCHITECTURE_DECISIONS_REJECTED.md
Rejected Architecture Decisions — Nazma Water Taps ERP
Important designs that were considered and intentionally rejected. Preserves reasoning for future maintainers and AI sessions.

Last updated: 2026-06-30

1. Invoice Directly from Sales Order
Looked Attractive Because
Simpler pipeline: fewer entities, faster to build
ADR-007 already allowed one order → many invoices
Order contains all commercial terms (price, discount, quantity)
Why Rejected
Creates receivables before physical shipment evidence
Cannot distinguish "ordered" from "shipped" quantities
Credit exposure would be premature
No logistics audit trail (vehicle, driver, dispatch date)
Violates separation of commercial, logistics, and financial layers
Adopted Architecture (Superior)
Sales Order → Delivery Challan (non-financial) → Invoice (financial)
Invoice quantities from DeliveryChallanItem only
Revenue recognized at invoice issue after confirmed dispatch
One challan → exactly one invoice
References: ADR-011, ADR-014

2. Collections Linked Directly to Invoice
Looked Attractive Because
Simple Collection.invoiceId foreign key
Immediate payment-to-invoice association
Matches basic bookkeeping mental model
Why Rejected
Cannot represent advance payments (cash before allocation)
Cannot support partial allocation across multiple invoices
Cannot extend to credit notes, opening balances, adjustments
Couples cash receipt timing with invoice application timing
Legacy init-schema model blocked enterprise patterns
Adopted Architecture (Superior)
Collection as cash pool: receivedAmount = allocatedAmount + unallocatedAmount
CollectionAllocation with polymorphic (referenceType, referenceId)
Cash posted on confirmation; allocation moves pool without second balance post
FinancialReferenceType enum extensible to future document types
References: ADR-019, ADR-020, ADR-024

3. Derived Dealer Balance (No Posting Service)
Looked Attractive Because
Balance always computed fresh from invoices and collections
No cache drift possible
Simpler write path — just insert documents
Why Rejected
Expensive aggregation on every credit check and UI render
Race conditions under concurrent issue/collection without centralized mutation
Credit limit check requires consistent snapshot at decision time
Enterprise ERPs use subsidiary ledger documents + cached customer balance
Statement and ledger require explicit posting events anyway
Adopted Architecture (Superior)
Dealer.currentBalance as denormalized AR cache
Single write path: src/lib/finance/posting-service.ts only
lockDealerForFinancialUpdate() + atomic increment/decrement
Future LedgerEntry as Tier 1 authoritative source; balance reconciles to ledger
References: ADR-014, ADR-015, ADR-019, ADR-024

4. Invoice Without InvoiceItem (Header-Only)
Looked Attractive Because
Faster schema and UI — header totals copied from order
Fewer rows to manage on partial shipments
Simpler print layout
Why Rejected
No product-level audit trail on issued invoices
Cannot support accurate partial-shipment billing
Product sales reporting impossible from invoice data alone
Header totals could drift from line sums without enforcement
Violates enterprise accounting standards
Adopted Architecture (Superior)
InvoiceItem mandatory on every invoice
Immutable snapshots at issue: product code, name, unit, qty, price, discount, line total
Header totals derived from line sum via Decimal engine
Pricing never re-read from live Product/Order tables after issue
References: ADR-011, ADR-014, ADR-018

5. Stored remainingQuantity on Order Lines
Looked Attractive Because
Fast UI display without aggregation query
Simple "remaining = stored value" mental model
Avoids summing challan lines on every form load
Why Rejected
Drift risk: every challan create/confirm/cancel requires compensating update
Two sources of truth (SalesOrderItem.quantity vs stored remaining)
Audit reconstruction harder — must trust mutable column
Draft vs confirmed challan semantics cannot be captured in one stored field
Adopted Architecture (Superior)
Derived quantity model from challan history
remainingQty = ordered − confirmed (display / completion)
allocatableQty = ordered − confirmed − draft (validation guard)
Single persisted ordered qty; challan lines are append-only shipment events
References: ADR-012 §3

6. Order Immutability on Any Challan (Including Draft)
Looked Attractive Because
Maximum safety — order frozen as soon as dispatch planning starts
Simpler guard: challanCount > 0 → locked
Why Rejected
Draft challans are abandonable intent, not dispatch events
Would block legitimate order corrections while drafts exist
Business needs to cancel/edit drafts and revise order before confirmed dispatch
Adopted Architecture (Superior)
Order structural edits blocked only after first Confirmed challan
Draft challans reduce allocatableQty but allow order edits (Manager/Super_Admin)
Cancel/delete draft releases capacity reservation
References: ADR-012 §6

7. Client-Side Money Calculations
Looked Attractive Because
Instant live totals in forms without server round-trip
Familiar pattern from spreadsheet UIs
Reduces server action calls
Why Rejected
JavaScript number cannot represent decimal money safely
Duplicates Decimal engine logic — drift between preview and persist
Financial display surfaces must match persisted values exactly
ERP financial accuracy is non-negotiable
Adopted Architecture (Superior)
Server calculator for all monetary computation (order-calculator, invoice-calculator)
Client collects raw inputs; server preview actions return formatted DTO strings
format-money.ts / useFormatMoney for display only
Document platform: React never sums or subtracts money
References: ADR-009, ADR-016, ADR-017, ADR-023

8. Rasterized / Server-Screenshot PDF
Looked Attractive Because
Pixel-perfect identical output across all browsers
Familiar html2canvas / Puppeteer screenshot approach
Server controls entire render pipeline
Why Rejected
Blurry text on print; not suitable for accountant-grade documents
Large file sizes; not vector/scalable
Server Chromium infrastructure cost and maintenance
Screenshot pipeline diverges from print pipeline (preview ≠ PDF risk)
Adopted Architecture (Superior)
Single React component tree for preview, print, and PDF
Vector HTML/CSS via window.print() → browser Save as PDF
document-print.css with A4 isolation, print-color-adjust: exact
Preview = Print = PDF guaranteed (same DOM)
References: ADR-017, ADR-018, ADR-023

9. Bank Details on Invoice
Looked Attractive Because
Standard on many commercial invoices
Dealers know where to transfer payment
Reduces separate payment instruction documents
Why Rejected
Client-approved design decision to omit
Payment captured through Collections module with method/reference fields
Money receipt shows payment details in collection context
Reduces invoice document clutter
Adopted Architecture (Superior)
Bank details on collection record (bankName, referenceNumber, paymentMethod)
Invoice focuses on receivable position (previous due, current due, outstanding)
Money receipt as payment proof document
References: ADR-017

10. Allocation Posts Dealer Balance
Looked Attractive Because
Each invoice payment immediately reduces dealer balance
Balance always reflects "net applied" position intuitively
Why Rejected
Double-counting: cash already posted on collection confirmation
Would require reversal gymnastics on deallocation
Violates ERP principle: cash receipt ≠ application
Advance payments would break (cash posted before any invoice exists)
Adopted Architecture (Superior)
Cash posted once on confirmCollection() via postReceivableDecrease()
Allocation updates invoice collectionReceived / currentDue and collection pool only
Dealer balance reflects total cash in/out; invoice dues reflect application
References: ADR-020, ADR-021, ADR-024

11. currentDue − collectionReceived as Allocation Cap
Looked Attractive Because
Matches statement "outstanding" display semantics
currentDue already stored on invoice and decreases with allocation
Why Rejected
Double-counts payments: allocation symmetrically decrements currentDue AND increments collectionReceived
Cap shrinks by 2× payment amount
Blocked full invoice settlement when previousDue = 0
Allowed overpayment past grandTotal when previousDue > 0
Found and remediated in PHASE_06A3
Adopted Architecture (Superior)
Allocatable cap = grandTotal − collectionReceived
Defense-in-depth guard in applyInvoiceAllocation()
Display outstanding may use currentDue − collectionReceived for statement position (different semantics)
References: ADR-021

12. Pure Client Component Pages for RBAC
Looked Attractive Because
Matches early dealer form pattern
Simpler page structure
All logic in one client file
Why Rejected
Client-side redirect for forbidden access causes flash of unauthorized content
RBAC enforcement must be server-first
Session/permission data should not be exposed to client for gate decisions alone
Adopted Architecture (Superior)
Thin Server Component shell: enforcePermission() + data fetch
Client Component for interactivity and translations
Middleware route prefix protection as first line
References: ADR-004, ADR-009, ADR-016

13. discountPercent Column on Sales Order
Looked Attractive Because
Store discount as percentage for display
Familiar from retail POS systems
Why Rejected
Unnecessary schema column — discount computed from lines
Order calculator already handles discount amount from line inputs
Risk of percent vs amount inconsistency
Adopted Architecture (Superior)
Per-line discount amounts on SalesOrderItem
Header discount derived by Decimal engine
Single source: line-level commercial terms
References: ADR-009

14. Credit Limit at Order Approval or Challan Dispatch
Looked Attractive Because
Early risk gate prevents over-commitment
Manager sees credit issues before warehouse work
Why Rejected
Blocks operations when exposure is not yet financial
Challan dispatch is logistics — no receivable created
Order approval is commercial commitment, not billing
Business requested credit check at billing boundary only
Adopted Architecture (Superior)
Credit limit evaluated only at issueInvoice()
projectedExposure = currentBalance + grandTotal under dealer lock
Challan and order actions have zero credit impact
References: ADR-011, ADR-014

15. Editing Confirmed Financial Documents
Looked Attractive Because
Quick fix for data entry errors
Simpler than reversal workflow
Why Rejected
Destroys audit trail
Breaks statement reconstruction
Violates enterprise accounting immutability
Concurrent edits corrupt balance integrity
Adopted Architecture (Superior)
Issued invoices: immutable lines; future credit note for corrections
Confirmed collections: immutable; reverseCollection() with compensating post
All corrections create new events, never rewrite history
References: ADR-019, ADR-020, ADR-024

16. Separate Print and PDF Templates
Looked Attractive Because
Optimize each output format independently
Print-specific simplified layout
Why Rejected
Preview ≠ Print ≠ PDF drift risk (observed failure mode in many ERPs)
Duplicate maintenance of financial values and layout
ADR-018 certification requires single pipeline consistency
Adopted Architecture (Superior)
One InvoicePrintable / MoneyReceiptPrintable component
CSS handles screen scale vs print native A4
Financial values from single server mapper
References: ADR-017, ADR-018, ADR-023

17. Legacy PaymentMethod Enum for Collections
Looked Attractive Because
Reuse existing enum; fewer schema objects
Why Rejected
Legacy enum values don't match collection payment types (e.g., Mobile_Banking vs MobileBanking)
Collections need richer method set (OnlineTransfer, Other)
Mixing concerns between old and new models
Adopted Architecture (Superior)
Dedicated CollectionPaymentMethod enum
Legacy PaymentMethod retained elsewhere for backward compatibility
Clear domain separation
References: ADR-019

SYSTEM_CONTEXT.md
System Context — Nazma Water Taps ERP
Definitive engineering context for AI sessions and new maintainers.

Read this document first. Then consult PROJECT_BRAIN.md, CURRENT_PHASE.md, and relevant ADRs.

Last updated: 2026-06-30
Current phase: PHASE_06D complete → Next: PHASE_07A_LEDGER_SCHEMA_HARDENING
Production readiness: 8.7 / 10

1. Project Overview
Nazma Water Taps ERP is a production-grade B2B ERP for Nazma Metal Industries — manufacturer and distributor of premium brass bathroom fittings.

Attribute	Value
Domain
Dealer management, sales orders, fulfillment, invoicing, collections, ledger (planned)
Customers
Dealers, retail distributors, project contractors
Languages
English + Bengali (no page refresh on switch)
Deployment
Docker-first; Netlify-compatible Next.js
Long-term goal
Reusable multi-company ERP platform
2. Technology Stack
Layer	Technology
Framework
Next.js App Router, React 19, TypeScript strict
Styling
Tailwind CSS, Shadcn UI
Forms
React Hook Form + Zod
Tables
TanStack Table
ORM
Prisma
Database
PostgreSQL 16
Auth
Auth.js v5, JWT sessions, bcrypt
Money
Prisma Decimal(18,2) — never JS number
Testing
Vitest
i18n
public/locales/{en,bn}/common.json
3. User Roles
Role	Typical responsibilities
Super_Admin
Full system access
Manager
Order approval, edits, oversight
Accounts
Invoices, collections, financial documents
SR
Sales orders, dealer interaction (no invoice issue)
RBAC: centralized src/lib/permissions.ts; requirePermission() on actions; enforcePermission() on pages; middleware route guards.

4. Business Workflow
Commercial → Fulfillment → Financial Pipeline
Sales Order (commercial)
    ↓
Delivery Challan (logistics — NON-FINANCIAL)
    ↓
Invoice (financial — receivables created)
    ↓
Collection (cash receipt)
    ↓
Allocation (apply cash to invoices)
    ↓
Money Receipt (printable proof)
    ↓
Ledger (PHASE_07 — not yet implemented)
    ↓
Due Report (PHASE_08 — not yet implemented)
Cardinality Rules
Relationship	Rule
Order → Challan
One-to-many (partial delivery)
Challan → Invoice
One-to-one
Order → Invoice
One-to-many (via challans)
Collection → Allocation
One-to-many (polymorphic references)
5. Financial Workflow
When Money Moves
Event	Balance effect	Posting function
Invoice issue
+ grandTotal
postReceivableIncrease()
Collection confirm
− receivedAmount
postReceivableDecrease()
Collection reverse
+ receivedAmount
postReceivableDecreaseReversal()
Allocation
None on balance
Pool + invoice fields only
Advance Payment
Dealer pays more than immediate invoice allocation
Dealer.currentBalance goes negative (company owes dealer)
Unallocated cash remains in collection pool
Future invoices consume credit without new cash collection
Credit Limit
Checked only at invoice issue
projectedExposure = currentBalance + grandTotal
Under dealer row lock
6. Module Map
Module	Status	Key routes
Auth + RBAC
✅ Complete
/login, /access-denied
Dealers
✅ Complete
/dealers
Products
✅ Complete
/products
Sales Orders
✅ Complete
/orders
Delivery Challans
✅ Complete
/delivery-challans
Invoices
✅ Complete
/invoices, /invoices/issue, /invoices/[id]/print
Collections
✅ Complete
/collections, /collections/[id]/allocate
Money Receipt
✅ Complete
/collections/[id]/receipt
Ledger
❌ Not built
—
Due Reports
❌ Not built
—
Audit Log UI
❌ Not built
—
User Management
❌ Not built
—
7. Document Platform Architecture
Location: src/components/documents/

Primitives (shared)
DocumentLayout, CompanyHeader, CompanyFooter, DocumentTitle, DocumentParties, DocumentMetadata, DocumentTable, DocumentFinancialSummary, DocumentNotes, DocumentSignature, DocumentSeal, DocumentPrintToolbar

Document Composers
Document	Component	Route
Invoice
InvoicePrintable
/invoices/[id]/print
Money Receipt
MoneyReceiptPrintable
/collections/[id]/receipt
Pipeline
Server DTO → mapper → Printable component → preview modal / print route → window.print()
Rules: No client money math. Preview = Print = PDF. Vector HTML/CSS only. Max 20 invoice line rows per A4 page.

Branding
src/lib/documents/company-branding.ts → getCompanyBranding()
Logo: public/branding/nazma-logo.png

8. Financial Posting Service
Location: src/lib/finance/posting-service.ts
Mandate: ALL balance mutations go through this module.

Function	Trigger
postReceivableIncrease()
Invoice issue
postReceivableDecrease()
Collection confirm
postReceivableDecreaseReversal()
Collection reverse
Concurrency: lockDealerForFinancialUpdate() — SELECT … FOR UPDATE in dealer-lock.ts

Future (PHASE_07): createLedgerEntry() inside posting callbacks; postOpeningBalance(), postCreditNote(), postInvoiceReversal()

9. Allocation Engine
Location: src/lib/collections/allocation-engine.ts, reference-resolver.ts

Polymorphic CollectionAllocation(referenceType, referenceId)
FinancialReferenceType: Invoice (implemented), OpeningBalance, CreditNote, DebitNote, ManualAdjustment, JournalEntry (reserved)
Pool invariant: receivedAmount = allocatedAmount + unallocatedAmount
Allocatable cap: grandTotal − collectionReceived per invoice
No balance posting on allocation
10. Dealer Balance Model
Field	Semantics
Dealer.currentBalance
AR cache: positive = dealer owes; negative = advance credit
Dealer.creditLimit
Maximum exposure at invoice issue
Invoice.previousDue
Snapshot of balance before this invoice
Invoice.currentDue
Running due on this invoice (reduced by allocation)
Invoice.collectionReceived
Sum allocated to this invoice
Collection.receivedAmount
Total cash received
Collection.unallocatedAmount
Advance pool remainder
Source of truth hierarchy (ADR-024):

LedgerEntry (future authoritative)
Financial documents (Invoice, Collection, Allocation)
Dealer.currentBalance (operational cache)
11. Key Domain Models (Prisma)
Model	Role
SalesOrder / SalesOrderItem
Commercial commitment
DeliveryChallan / DeliveryChallanItem
Logistics (non-financial)
Invoice / InvoiceItem
Receivable document + immutable line snapshots
Collection / CollectionAllocation
Cash receipt + polymorphic application
Dealer
Customer master + AR cache
LedgerEntry
Journal subledger (schema exists; posting deferred)
AuditLog
Append-only event trail
12. Completed Phases
Phase	Description
PHASE_01
Foundation, localization
PHASE_02
Dealer backend + UI
PHASE_03
Product backend + UI
PHASE_00B/00C
Schema hardening, invoice relation fix
PHASE_AUTH
Authentication + RBAC
PHASE_04
Sales Order backend + UI
PHASE_05A–05B
Delivery Challan backend + UI
PHASE_05C1–05C2A
Invoice engine + financial audit + concurrency hotfix
PHASE_05D1–05D3
Invoice UI + document engine + production QA
PHASE_06A1–06A3
Collections schema + engine + financial certification
PHASE_06B
Collections UI
PHASE_06C
Money Receipt + document platform upgrade
PHASE_06D
Financial architecture certification (ADR-024)
13. Outstanding Phases
Phase	Description
PHASE_07A
Ledger schema hardening
PHASE_07B
Ledger posting integration
PHASE_07C
Opening balance
PHASE_07D
Ledger UI + dealer subledger statement
PHASE_07E
Reconciliation & backfill
PHASE_07F
Chart of Accounts foundation (optional)
PHASE_08
Due reports
PHASE_09
Audit log UI
PHASE_10
User management
14. Architecture Philosophy
Separation of concerns — logistics ≠ receivables ≠ cash ≠ application
Immutable financial documents — corrections via reversal/compensation, never in-place edits
Single posting boundary — all balance mutations through posting service
Snapshot discipline — historical documents stable regardless of master data changes
Extension over rewrite — polymorphic allocation, posting service callbacks, document platform primitives
Certify before build — architecture ADRs before implementation phases
Enterprise ERP patterns — comparable to SAP B1, NetSuite, Dynamics BC, Odoo Enterprise
15. Coding Philosophy
TypeScript strict — no any
Server actions for mutations; server components for data fetch + RBAC
Zod validators for all inputs
DTO layer — monetary values as decimal strings in API responses
ActionResult envelope — consistent error handling across modules
Workflow guards — src/lib/{module}/workflow.ts per domain
Reuse conventions — read surrounding code before adding; match naming and patterns
Minimal scope — smallest correct diff; no unrelated changes
16. Financial Safety Rules (Quick Reference)
Never use JS number for money
Never mutate Dealer.currentBalance outside posting service
Never import finance into delivery challan code
Never calculate money in React components
Always use prisma.$transaction for financial mutations
Always lockDealerForFinancialUpdate() before balance operations
Never edit issued invoice lines or confirmed collection headers
Allocation never posts balance — cash posts on confirm only
Invoice quantities from challan only
Reversals are compensating transactions only
Full detail: FINANCIAL_INVARIANTS.md

17. Maintainability Rules
Every user-facing string: translation key (EN + BN)
Read ARCHITECTURE.md, PROJECT_BRAIN.md, CURRENT_PHASE.md before new modules
Read prisma/schema.prisma before creating models — extend, never duplicate
Document significant decisions in docs/ADR/
Update CURRENT_PHASE.md, IMPLEMENTATION_STATUS.md, CHANGELOG.md, NEXT_ACTION.md on phase completion
No JavaScript files; no Redux; no Sequelize/Mongoose
18. Refactoring Rules
Do not refactor posting service boundaries without ADR
Do not merge logistics and financial layers
Document platform changes must preserve preview = print = PDF
Schema changes require migration + prisma generate verification
Financial fixes belong in workflow/posting layer, not UI workarounds
When extending allocation, add handler in reference-resolver.ts — do not redesign schema
19. Testing Philosophy
Unit tests on workflow guards and calculators (*.test.ts)
Integration/concurrency tests for financial paths (require DATABASE_URL)
npm test must pass before phase sign-off
Tests prove real behavior — no trivial assertions
Collection concurrency tests: recommended gap to fill
20. ERP Quality Goals
Goal	Standard
Financial accuracy
Decimal-safe; single posting path; certified invariants
Enterprise UX
Stripe/Linear/Vercel density; skeleton/empty/error states
Accessibility
Semantic tables, dialog roles, keyboard support (focus trap deferred)
Localization
Full EN/BN parity
Audit
Append-only events; no financial history deletion
Print quality
A4 vector documents; accountant-grade layout
Security
RBAC on all financial routes and actions
Scalability
Dealer lock serialization; index plan for reporting
21. Target Architecture Level
Target: Enterprise B2B ERP comparable to mid-market commercial systems.

Current maturity:

Capability	Level
Order → Collection pipeline
Production-certified
Document engine
Production-certified
AR


Continuing SYSTEM_CONTEXT.md from section 21.

21. Target Architecture Level
Target: Enterprise B2B ERP comparable to mid-market commercial systems.

Capability	Level
Order → Collection pipeline
Production-certified
Document engine
Production-certified
AR subledger
Architecture certified; ledger posting pending
Full GL (TB / P&L / BS)
Not designed
Operational reporting
Data model ready; UI not built
Multi-company platform
Future goal
22. Current Production Readiness
Overall score: 8.7 / 10 (ADR-024, 2026-06-30)

Subsystem	Score
Orders
9.0
Delivery
9.0
Invoice
9.0
Collections
9.2
Money Receipt
9.0
Document Engine
9.0
Financial Posting
8.5
Generic Allocation
8.5
Advance Payment
9.0
Audit
8.0
Security
8.5
Scalability
7.5
Ledger Readiness
8.5
Reporting Readiness
7.0
Suitable for controlled production
Sales order creation and approval
Partial delivery via delivery challans
Invoice issue, preview, print, and PDF
Collection recording, allocation, and reversal
Money receipt printing
Not yet production-ready
Ledger posting and dealer subledger statements
Due reports and aging
Invoice void / credit notes
Opening balance onboarding
Management dashboards and analytics
Full statutory financial statements
Blocking defects
None identified for the Order → Invoice → Collection pipeline as of PHASE_06D.

23. Critical File Locations
Concern	Path
Posting service
src/lib/finance/posting-service.ts
Dealer lock
src/lib/finance/dealer-lock.ts
Invoice workflow
src/lib/invoices/workflow.ts
Collection workflow
src/lib/collections/workflow.ts
Allocation engine
src/lib/collections/allocation-engine.ts
Reference resolver
src/lib/collections/reference-resolver.ts
Invoice issue
src/lib/actions/invoices/issue-invoice.ts
Document branding
src/lib/documents/company-branding.ts
Invoice mapper
src/lib/documents/map-invoice-document.ts
Receipt mapper
src/lib/documents/map-collection-receipt.ts
Print CSS
src/components/documents/styles/document-print.css
Permissions
src/lib/permissions.ts
RBAC guards
src/lib/rbac/guards.ts
Schema
prisma/schema.prisma
24. ADR Index (Key References)
ADR	Topic
ADR-007
One order → many invoices
ADR-011
Fulfillment pipeline (challan layer)
ADR-012
Delivery challan backend design
ADR-014
Invoice engine
ADR-015
Financial integrity audit
ADR-017
Enterprise document engine
ADR-018
Invoice production certification
ADR-019
Collections foundation
ADR-020
Collection engine
ADR-021
Collection financial certification
ADR-023
Money receipt engine
ADR-024
Financial architecture certification
25. Session Bootstrap Checklist
For a new AI or developer session:

Read SYSTEM_CONTEXT.md (this document)
Read CURRENT_PHASE.md for active phase
Read NEXT_ACTION.md for immediate tasks
Read IMPLEMENTATION_STATUS.md for verification state
Read PROJECT_BRAIN.md for business domain
Read prisma/schema.prisma before any schema work
Read relevant ADR before modifying a module
Never violate FINANCIAL_INVARIANTS.md
Check TECH_DEBT.md and KNOWN_RISKS.md before architectural changes
Check CLIENT_FEEDBACK_LOG.md for business intent behind features
Check ARCHITECTURE_DECISIONS_REJECTED.md before proposing rejected patterns
26. Next Action
PHASE_07A — Ledger Schema Hardening

Extend LedgerEntry: postingKey, referenceNo, postingType, postingDate, reversesEntryId, createdById
Align referenceType to FinancialReferenceType enum
Add @@unique([postingKey])
Migration only — no posting logic yet
Then PHASE_07B: wire createLedgerEntry() into existing posting functions.

27. Governance Documents
Document	Purpose
CLIENT_FEEDBACK_LOG.md
Permanent client change history
FINANCIAL_INVARIANTS.md
Mandatory accounting rules
TECH_DEBT.md
Deferred improvements register
KNOWN_RISKS.md
Production risk register
ARCHITECTURE_DECISIONS_REJECTED.md
Rejected designs and rationale
SYSTEM_CONTEXT.md
This document — session bootstrap
CURRENT_PHASE.md
Active phase status
IMPLEMENTATION_STATUS.md
Verification evidence
NEXT_ACTION.md
Immediate next steps
CHANGELOG.md
Release history
docs/ADR/*.md
Architecture decision records