# ADR-016: Enterprise Invoice UI

Date: 2026-06-25

Status: ACCEPTED

Phase: PHASE_05D1_ENTERPRISE_INVOICE_UI

Builds on: ADR-009, ADR-013, ADR-014, ADR-015

---

## Context

PHASE_05C delivered the Invoice Engine backend — `issueInvoice`, `getInvoice`,
`listInvoices`, immutable `InvoiceItem` snapshots, and Financial Posting Service
integration. PHASE_05D1 builds the **UI only**: list, detail, and issue workflow.

Hard constraints:

* **No client-side money math** — all totals from server preview / persisted DTOs
* **No PDF, print, Collections, or Ledger** in this phase
* **Reuse** existing server actions, DTOs, RBAC, and Order/Challan UI patterns
* **Business rules** enforced by backend; UI shows backend errors only

---

## Decision

### 1. UI architecture — hybrid Server/Client (mirrors Order + Challan UI)

| Route | Server Component | Client Component |
|-------|------------------|------------------|
| `/invoices` | (client list page) | `InvoiceTable` |
| `/invoices/[id]` | `enforcePermission("invoices:view")`, `getInvoice` | `InvoiceDetailView` |
| `/invoices/issue` | `enforcePermission("invoices:create")` | `IssueInvoicePageClient` |

* **Server Components** enforce RBAC and pre-load invoice detail (items + audit).
* **Client Components** own interactivity: table filters, challan picker, issue
  dialog, and navigation after success.
* All strings use `invoice.*` localization keys (EN + BN).

### 2. UI-support server actions (read-only / display)

| Action | Permission | Purpose |
|--------|------------|---------|
| `previewInvoiceFromChallan` | `invoices:create` | Server Decimal preview before issue |
| `listInvoiceEligibleChallans` | `invoices:create` | Confirmed challans without invoice |

Existing actions reused without modification to business logic:

| Action | Permission |
|--------|------------|
| `listInvoices` | `invoices:view` |
| `getInvoice` | `invoices:view` |
| `issueInvoice` | `invoices:create` |

`getInvoice` extended to attach `auditHistory[]` from `AuditLog` (additive DTO).

### 3. Component hierarchy

```
src/app/(dashboard)/invoices/
  page.tsx                          → InvoiceTable
  [id]/page.tsx + page-client.tsx   → InvoiceDetailView
  issue/page.tsx + page-client.tsx  → Issue workflow

src/components/invoices/
  invoice-table.tsx                 → List (TanStack Table)
  invoice-filters.tsx               → Status / dealer / date filters
  invoice-search.tsx                → Search wrapper
  invoice-status-badge.tsx          → Issued / Paid / etc.
  invoice-empty-state.tsx
  invoice-skeleton.tsx
  invoice-detail-view.tsx           → Read-only detail layout
  invoice-header-card.tsx
  invoice-metadata-card.tsx
  invoice-dealer-card.tsx
  invoice-items-table.tsx
  invoice-totals-card.tsx           → Sticky financial summary (detail)
  invoice-financial-summary.tsx     → Issue preview sidebar
  invoice-history-timeline.tsx      → Audit events
  invoice-timeline.tsx              → Commercial pipeline visualization
  invoice-actions.tsx               → Issue (challan) / PDF placeholder (detail)
  issue-invoice-dialog.tsx          → Modal issue from challan detail
  eligible-challan-combobox.tsx     → Confirmed, uninvoiced challan picker
```

Reused from Order/Challan modules: `DealerCombobox`, `ProductSearch`,
`PageContainer`, `TableSkeleton`.

### 4. Issue Invoice UX

```
Confirmed Delivery Challan (hasInvoice: false)
        ↓
previewInvoiceFromChallan()   ← server Decimal engine
        ↓
User reviews financial summary
        ↓
issueInvoice()                ← existing backend
        ↓
Navigate to /invoices/[id]
```

Entry points:

* `/invoices/issue` — full-page workflow with `EligibleChallanCombobox`
* Challan detail sidebar — `InvoiceActions` + `IssueInvoiceDialog`
* List page — "Issue Invoice" button (Accounts / Super_Admin)

Never shown for: Draft challan, Cancelled challan, already invoiced challan.
Backend returns typed errors (`CHALLAN_NOT_CONFIRMED`, `INVOICE_ALREADY_EXISTS`,
`CREDIT_LIMIT_EXCEEDED`, etc.) — displayed via `messageKey` localization.

### 5. Financial display rules

| Rule | Implementation |
|------|----------------|
| No client totals | `formatMoney()` display only; values from DTO strings |
| Issue preview | `previewInvoiceFromChallan` calls `buildInvoiceFromChallanLines` |
| Detail totals | Read `Invoice.subtotal`, `grandTotal`, `previousDue`, `currentDue` |
| Immutable lines | `InvoiceItemsTable` renders `InvoiceItemDTO` snapshots |

### 6. RBAC

| Capability | Permission | Layer |
|------------|------------|-------|
| List / detail | `invoices:view` | middleware + `enforcePermission` |
| Issue invoice | `invoices:create` | middleware `/invoices/issue` + actions |
| Issue button render | `hasPermission` | client conditional only |

No inline role checks. Accounts + Super_Admin can issue; Manager + SR read-only.

### 7. State management

* **List page**: local React state for filters, pagination, sort; `listInvoices`
  server action on dependency change.
* **Issue page**: selected challan → debounced `previewInvoiceFromChallan`;
  issue → `router.push` to detail.
* **Detail page**: server-fetched `InvoiceDetailDTO`; no client mutations
  (invoice is immutable).
* **No global store** — matches Order/Challan pattern.

### 8. Invoice lifecycle (UI perspective)

```
Approved Order
      ↓
Delivery Challan (Draft → Confirmed)
      ↓
Issue Invoice (PHASE_05D1 — this ADR)
      ↓
Invoice List / Detail (read-only)
      ↓
PDF Export (PHASE_05D2 — future)
      ↓
Collection (PHASE_06 — future)
```

### 9. Future integration points

| Future phase | UI hook |
|--------------|---------|
| PDF | Replace `invoice.pdf.placeholder*` in `InvoiceActions` |
| Collections | Add payment allocation panel on detail; reduce `currentDue` display |
| Ledger | Link from detail to ledger entries via posting reference |
| Email | Action button in `InvoiceActions` |

Backend extension points unchanged per ADR-014/015 — UI plugs in without
refactoring invoice engine.

---

## Consequences

* Accounts users can issue invoices from confirmed challans with credit-limit
  feedback from backend.
* Invoice list supports operational search across invoice, order, challan, dealer.
* Challan detail shows "Issue Invoice" when eligible.
* PDF and Collections deferred cleanly with placeholder UI.

---

## Out of scope (PHASE_05D1)

* PDF generation / print layout
* Collections / payment recording
* Ledger views
* Due reports / analytics
* Credit notes / returns
* Email invoice

---

## Verification

- [x] `/invoices` list with search, filters, pagination, sorting
- [x] `/invoices/[id]` immutable detail with financial summary
- [x] `/invoices/issue` workflow with server preview
- [x] Issue from challan detail via dialog
- [x] RBAC: middleware + page guards + conditional render
- [x] EN + BN `invoice.*` keys
- [x] No client-side money calculation
- [x] `npx prisma generate` / `tsc` / `eslint`
