# ADR-013: Delivery Challan UI

Date: 2026-06-25

Status: ACCEPTED

Phase: PHASE_05B_DELIVERY_CHALLAN_UI

Builds on: ADR-009 (Order UI), ADR-011 (fulfillment), ADR-012 (challan backend)

---

## Context

PHASE_05A2 delivered the complete Delivery Challan **backend** — Prisma models,
validators, workflow guards, and six server actions. PHASE_05B builds the **UI**
on that foundation: list, create, edit, detail, confirm/cancel workflow, and
fulfillment visualization.

The hard constraint matches ADR-009: **reuse, not duplication**. The UI consumes
existing DTOs, validators, server actions, and RBAC helpers. No business logic —
especially quantity reconciliation — is re-implemented on the client.

---

## Decision

### 1. UI architecture — hybrid Server/Client pattern (mirrors Order UI)

| Route | Server Component | Client Component |
|-------|------------------|------------------|
| `/delivery-challans` | (client list page) | `ChallanTable` |
| `/delivery-challans/new` | `enforcePermission("orders:create")` | `ChallanForm` (create) |
| `/delivery-challans/[id]` | `enforcePermission("orders:view")`, parallel fetch | `ChallanDetailView` |
| `/delivery-challans/[id]/edit` | `enforcePermission("orders:edit")`, Draft guard | `ChallanForm` (edit) |

* **Server Components** enforce RBAC and pre-load challan detail, order context,
  and enriched line fulfillment for the detail table.
* **Client Components** own interactivity: order picker, line quantity editor,
  live fulfillment summary, table filters, and workflow action dialogs.
* All strings use `challan.*` localization keys (EN + BN).

**UI-support server actions** (read-only / display helpers, no duplicated guards):

| Action | Purpose |
|--------|---------|
| `getOrderChallanContext` | Per-line ordered / delivered / draft / remaining / **allocatable** qty for create & edit forms |
| `getChallanDetailLines` | Enriched detail-table rows (ordered, delivered previously, current, remaining) |

**Additive DTO fields** on `DeliveryChallanDetailDTO`: `remarks`, `confirmedById`,
`confirmedByName`, `auditHistory[]`.

**Client-safe quantity helpers** in `src/lib/delivery/quantity-client.ts` mirror
`computeAllocatableQuantity` for input capping and progress display only — server
actions remain authoritative.

### 2. Component hierarchy

```
src/app/(dashboard)/delivery-challans/
  page.tsx                          → ChallanTable
  new/page.tsx + page-client.tsx    → ChallanForm (create)
  [id]/page.tsx + page-client.tsx   → ChallanDetailView
  [id]/edit/page.tsx + page-client  → ChallanForm (edit)

src/components/delivery-challans/
  challan-table.tsx                 → List (TanStack Table)
  challan-form.tsx                  → Create / edit shell
  eligible-order-combobox.tsx       → Approved / Partially_Delivered order picker
  challan-line-editor.tsx           → Per-line qty grid
  challan-fulfillment-summary.tsx   → Sticky live summary sidebar
  fulfillment-progress-bar.tsx      → Reusable progress + %
  challan-detail-view.tsx           → Read-only detail layout
  challan-workflow-actions.tsx      → Confirm / Cancel (Draft only)
  challan-history-timeline.tsx        → Audit timeline
  challan-status-badge.tsx          → Draft (gray) / Confirmed (green) / Cancelled (red)
  challan-empty-state.tsx           → List empty / no-results
```

Reused from Order module: `OrderFormSection`, `DealerCombobox`, `ProductSearch`,
`OrderStatusBadge`, `PageContainer`, `TableSkeleton`.

### 3. Workflow UX

Button visibility mirrors `src/lib/delivery/workflow.ts` guards (convenience only;
server re-validates):

| Action | Shown when | Permission |
|--------|-----------|------------|
| Create challan | Always on list (if permitted) | `orders:create` |
| Edit | `status === Draft` | `orders:edit` |
| Confirm | `status === Draft` && `itemCount >= 1` | `orders:edit` |
| Cancel | `status === Draft` | `orders:edit` |
| Print | Detail page (any status) | `orders:view` |

Create / edit form buttons:

* **Save as Draft** — calls `createDeliveryChallan` or `updateDeliveryChallan`
* **Confirm Dispatch** — save then `confirmDeliveryChallan` in sequence

Confirmed challans are read-only; edit route redirects to detail.

### 4. Fulfillment visualization

Per line (form + detail):

* Ordered, delivered (confirmed), remaining (display semantics per ADR-012 §3a)
* Allocatable cap shown on qty inputs (validation semantics)
* `FulfillmentProgressBar` with quantity-weighted percentage

Order-level sidebar summary updates live as the user enters challan quantities.

Detail page loads `getOrder().fulfillment` for overall order percent and status badge.

### 5. RBAC

Reuses Orders permissions (ADR-012 §9) — no `delivery:*` resource added:

| Capability | Permission |
|------------|------------|
| View / List | `orders:view` |
| Create | `orders:create` |
| Edit / Confirm / Cancel | `orders:edit` |

Middleware:

* `/delivery-challans` → `orders:view`
* `/delivery-challans/new` → `orders:create`
* `/delivery-challans/[id]/edit` → guarded at page via `enforcePermission("orders:edit")`

### 6. Future Invoice integration (PHASE_05C)

* Confirmed challans with `hasInvoice: false` will expose a **Create Invoice**
  action on the detail page (not built in PHASE_05B).
* Invoice quantities will equal confirmed challan line quantities exactly (ADR-012 §11).
* Credit-limit check runs at invoice issue, not at challan confirm.
* `DeliveryChallanDetailDTO.hasInvoice` is already surfaced for future UI gating.

---

## Consequences

* Full fulfillment UI without schema changes or backend rule changes.
* Quantity caps and over-delivery errors always originate from server actions.
* Navigation adds **Delivery Challans** under main nav (`orders:view`).
* Print uses `window.print()` with `print:hidden` on chrome; detail content is print-friendly.

---

## Verification

* `npx prisma generate` — OK
* `npx tsc --noEmit` — 0 errors
* `npx eslint` — 0 errors (1 pre-existing `useReactTable` warning on challan table)
* `npm test` — 9/9 workflow tests pass
* EN + BN `challan.*` keys complete
