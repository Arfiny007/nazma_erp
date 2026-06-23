# ADR-009: Sales Order UI

Date: 2026-06-23

Status: ACCEPTED

Phase: PHASE_04B_ORDER_UI

---

## Context

PHASE_04A delivered the complete Sales Order **backend** (validators, DTOs,
server actions, the Decimal-safe calculation engine, the status workflow, and
the approval audit trail — see ADR-008). PHASE_04B builds the **UI** on top of
that backend: the order list, the create/edit forms with a live financial
summary, the order detail page, and the approval workflow (Approve / Reject /
Cancel).

The hard constraint for this phase is **reuse, not duplication**: the UI must
consume the existing DTOs, validators, server actions, RBAC helpers, and the
financial calculator. No business logic — least of all monetary arithmetic —
may be re-implemented on the client.

This ADR documents the UI architecture, the approval-workflow UX, and the
pricing-override / discount-percentage rationale.

---

## Decision

### 1. UI architecture — hybrid Server/Client component pattern

The module follows the same hybrid pattern established for Products in
PHASE_03C:

| Route | Server Component (`page.tsx`) | Client Component |
|-------|-------------------------------|------------------|
| `/orders` | (client page) lists via action | `OrderTable` |
| `/orders/new` | `enforcePermission("orders:create")`, fetch active products | `OrderForm` (create) |
| `/orders/[id]` | `enforcePermission("orders:view")`, `getOrder` | `OrderDetailView` |
| `/orders/[id]/edit` | `enforcePermission("orders:edit")`, `getOrder` + dealer + products | `OrderForm` (edit) |

* **Server Components** enforce RBAC at the page boundary and pre-load data
  (active product catalog, dealer, order detail) to avoid client waterfalls.
* **Client Components** own interactivity: searchable comboboxes, the dynamic
  line editor, the debounced live summary, sorting, filtering, and pagination.
* All user-facing strings are localization keys resolved through
  `useLanguage()` (EN + BN); no hard-coded copy.
* Enterprise UX baseline: skeleton loading, explicit error states with retry,
  empty states, responsive layouts (sticky summary on desktop, stacked on
  mobile), keyboard-friendly popovers, and `aria-live` regions for the live
  totals.

A small, additive set of **UI-support backend** pieces was added (no business
logic duplicated):

* `previewOrderTotals` — a server action that runs the existing
  `calculateOrderTotals` engine for the live summary (see §3).
* `listDealerProjects` — a read-only action listing a dealer's active projects
  for the "existing project" selector (there is no Project module yet).
* `OrderSummaryDTO.createdByName` — an additive display field (the list's
  "Created By" column) populated by including `createdBy` in the existing
  summary projection.

### 2. Approval workflow UX

The `ApprovalActions` component renders **only the actions the current state and
role permit** — "visible only when allowed":

| Action | Shown when | Permission |
|--------|-----------|------------|
| Approve | status ∈ {Draft, Pending_Approval, Rejected} | `orders:approve` |
| Reject | status ∈ {Draft, Pending_Approval} | `orders:approve` |
| Cancel | status ∉ {Cancelled, Delivered} **and** `invoiceCount === 0` | `orders:edit` |

When no action is permitted the component renders nothing. Every action opens a
confirmation dialog; Reject and Cancel expose an **optional reason** that flows
straight into the existing action's audit trail. The buttons call the existing
`approveOrder` / `rejectOrder` / `cancelOrder` actions verbatim; the server
remains the sole authority and re-validates the workflow guards (the UI gating
is a convenience, not the enforcement boundary). On success the client calls
`router.refresh()` so the new status, badge, and history timeline reflect the
server result.

The visibility rules intentionally **mirror** the backend workflow guards
(`assertCanApprove`, `assertCanReject`, `assertCanCancel`) rather than
re-deriving them, so a button is never shown for an action the server would
reject.

### 3. Pricing override & discount-percentage rationale

**Per-line price override.** The product master `currentPrice` is only a
default. When a product is chosen the line's unit price is pre-filled with it,
but the user may overwrite the price (an explicit "Price overridden" hint is
shown). The overridden price is sent as the line's `unitPrice`, which the
backend already captures at order time — so historical orders keep their agreed
price even if the master price later changes.

**Order-level discount as a percentage.** The business requirement is an
order-level discount **percentage** (e.g. 30%), while the backend model stores
**per-line discount amounts** and sums them. Rather than add a percentage
concept to the schema, the percentage is treated as a UI affordance that is
converted to per-line discount amounts **on the server**:

```
lineDiscount_i = round(lineSubtotal_i * percent / 100, 2)     # Decimal, HALF_UP
orderDiscount  = Σ lineDiscount_i                              # exactly what the order stores
grandTotal     = subtotal − orderDiscount
```

This conversion lives in the `previewOrderTotals` action and runs through the
existing `calculateOrderTotals` engine, so:

* **No monetary math runs on the client.** The client only collects raw
  quantities, unit prices, and a discount percentage, then renders the decimal
  strings the server returns.
* **The preview cannot disagree with the saved order.** The per-line discount
  amounts returned by the preview are the *same* values submitted to
  `createOrder` / `updateOrder`; summing rounded per-line discounts is precisely
  what the persisted order computes.

The live summary is debounced (~300 ms) and recomputed on every quantity, price,
line, or discount change. At submit time the preview is re-run synchronously to
obtain authoritative per-line discounts before the create/update call.

**VAT is never shown or computed** (business rule: VAT is already in the price);
the engine's `vat` output is always `0.00` and the UI omits it entirely.

### 4. Create vs. edit status transitions

The form exposes status-aware submit buttons that map onto the writable status
edges the backend allows (`updateOrder` only permits Draft ↔ Pending_Approval):

| Context | Buttons |
|---------|---------|
| Create | "Save as Draft" (Draft) · "Submit for Approval" (Pending_Approval) |
| Edit — Draft | "Save as Draft" (Draft) · "Submit for Approval" (Pending_Approval) |
| Edit — Pending_Approval | "Move to Draft" (Draft) · "Save Changes" (no status change) |
| Edit — Approved / Rejected | "Save Changes" (no status change) |

Approved orders remain editable by Manager / Super_Admin (enforced by the page
guard and the backend); cancelled/delivered orders are blocked by the backend
workflow guards.

### 5. RBAC

All access control flows through the centralized permission system — no inline
role string checks:

* **Pages** call `enforcePermission()` (redirect to `/access-denied`).
* **Middleware** adds `/orders/new → orders:create` (more specific before the
  general `/orders → orders:view`). `/orders/[id]/edit` is guarded at the page
  via `enforcePermission("orders:edit")`, matching the Products precedent.
* **Conditional rendering** (New Order button, Edit button, approval actions)
  uses `hasPermission(role, …)` from `src/lib/permissions.ts`.
* **Server actions** already call `requirePermission()` (unchanged from
  PHASE_04A); the new `previewOrderTotals` and `listDealerProjects` actions are
  guarded by `orders:view`.

Resulting role matrix (unchanged from the backend phase):

| Role | View | Create | Edit | Approve / Reject | Cancel |
|------|:----:|:------:|:----:|:----------------:|:------:|
| Super_Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ✅ | ✅ |
| SR | ✅ | ✅ | ❌ | ❌ | ❌ |
| Accounts | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Consequences

* The live financial summary is authoritative because it shares the exact
  server calculation path used at persistence time — no rounding drift, no
  duplicated math, no floating-point money on the client.
* Adding the order-level discount percentage as a UI-only transform avoided a
  schema change while still satisfying the business rule.
* Two small read-only/utility server actions were introduced; both are RBAC
  guarded and contain no business logic beyond reusing the calculator and a
  scoped project query.
* `OrderSummaryDTO` gained a `createdByName` display field; the summary
  projection now includes `createdBy { id, name }`.
* The approval UX duplicates the workflow *gating* (button visibility) for
  convenience but not the *enforcement*, which remains exclusively server-side.

---

## Alternatives considered

* **Compute totals on the client.** Rejected — it would duplicate the Decimal
  engine, risk floating-point drift, and could disagree with the saved order.
* **Add a `discountPercent` column to `SalesOrder`.** Rejected — unnecessary
  schema change; the percentage is fully recoverable from the stored per-line
  discount amounts and is a presentation concern.
* **A dedicated Project module / picker page.** Deferred — out of scope; the
  inline "create or select existing project" flow on the order form is
  sufficient for this phase and reuses the backend's inline-project support.
