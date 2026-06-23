# ADR-010 — Order Dealer Combobox: Transport Diagnostics & Error Boundary

- **Status:** Accepted
- **Date:** 2026-06-23
- **Phase:** PHASE_04C_ORDER_COMBOBOX_DIAGNOSTICS
- **Supersedes / amends:** none (additive hardening of ADR-009 Order UI)

---

## Context

On the Create Order screen (`/orders/new`) the `DealerCombobox` rendered
**"No dealers found"** even though dealers existed. Prior investigation had
already ruled out the data and logic layers:

- The database returns dealers.
- `listDealers` returns dealers.
- DTO mapping (`toDealerDTO`) is correct.
- Search / filter (`where` builder) is correct.
- The combobox render logic is correct.

The defect was isolated to the **transport / error boundary** of the client
component.

### Root cause

`DealerCombobox` loaded dealers like this:

```ts
const response = await listDealers({ ... });
setResults(response.success ? response.data.items : []);
```

There were two compounding defects:

1. **Silent failure-to-empty coercion.** Any `{ success: false }` envelope was
   collapsed to `[]`, which the UI renders as the empty state
   _"No dealers found"_. A real failure was indistinguishable from a genuinely
   empty result.
2. **No `try/catch`.** A Server Action invocation does **not** return
   `{ success: false }` for transport/framework failures — it **throws**. The
   most common trigger in this project is a **stale Server Action reference**:
   the open browser tab holds a client bundle that points at a Server Action id
   which no longer exists after the server was rebuilt (the team runs
   `docker-compose up --build`, and HMR/redeploys both rotate action ids). Next
   then rejects the call with _"Failed to find Server Action … This request
   might be from an older or newer deployment."_ With no `catch`, that rejection
   was unhandled and the combobox never escaped its initial state.

This is why every layer checked out in isolation but the live UI showed empty:
the failure lived entirely in how the client consumed the action's result.

It is worth noting the original issue was **not** caused by middleware, the
session, or RBAC on `listDealers` itself — `listDealers` carries no permission
guard. The mishandled transport boundary was the sole defect. Permission and
session paths are nevertheless now classified because they _can_ surface here
once guards are added or when middleware redirects an action POST.

---

## Decision

Treat the dealer load as an explicit state machine and **never** convert a
failure into an empty list.

### 1. Typed load state

```ts
type DealerLoadState =
  | { status: "loading" }
  | { status: "ready"; items: DealerDTO[] }
  | { status: "error"; kind: DealerLoadErrorKind; messageKey: string };
```

### 2. Five distinct failure classes

| Kind            | Source                                                | Message key                          |
| --------------- | ----------------------------------------------------- | ------------------------------------ |
| Empty result    | `success` with `items.length === 0`                   | `order.form.dealer.empty`            |
| `ACTION_FAILURE`| typed `{ success: false }` (validation / internal)    | `order.form.dealer.error.failed`     |
| `NETWORK`       | thrown `TypeError: Failed to fetch` / offline         | `order.form.dealer.error.network`    |
| `PERMISSION`    | redirect to `/access-denied` (`NEXT_REDIRECT`)        | `order.form.dealer.error.permission` |
| `SESSION`       | redirect to sign-in (`NEXT_REDIRECT`)                 | `order.form.dealer.error.session`    |
| `STALE_ACTION`  | "Failed to find Server Action … older/newer deployment" | `order.form.dealer.error.stale`    |

`{ success: false }` envelopes are classified by `error.code`; thrown errors are
classified by inspecting `message` + `digest`.

### 3. Meaningful, actionable UI

The popover now renders a dedicated `role="alert"` error state with a localized
message and an action: **Retry** for recoverable errors, **Refresh page** for a
stale Server Action (the only correct recovery for a rotated action id).

### 4. Dev-only diagnostics

`logDealerDiagnostic()` emits a single `console.warn` with the failure kind and
context, guarded by `process.env.NODE_ENV === "production"` so production stays
quiet.

---

## Consequences

### Positive

- Transport failures are visible and actionable instead of masquerading as
  "empty".
- A stale Server Action (post-rebuild) tells the user exactly what to do.
- Failures are diagnosable in development without adding production noise.
- All new strings are localized (EN + BN); no hard-coded copy.

### Trade-offs

- Thrown errors are classified heuristically from message/digest strings, which
  can change across Next.js versions. The default fallback is the safe, generic
  `ACTION_FAILURE` ("Failed to load dealers"), so a missed pattern degrades
  gracefully rather than silently.

### Scope

UI-only, additive. No changes to the Dealer module, the Orders backend, RBAC, or the schema. No Invoice / Collection / Ledger work.

---

## Addendum — Visibility fix (2026-06-24)

Runtime proof showed `response.success === true`, `items.length > 0`, and
`state.status === "ready"` while the user still could not see or select dealers.

### Root cause (visibility)

`OrderFormSection` applied `overflow-hidden` to the card shell. The dealer
dropdown is `position: absolute; z-20` and opens downward from the trigger. The
list `<ul>` rendered below the section’s clip edge (~34px past the card border)
and was not painted or clickable — a pure CSS clipping defect, not a data or
state bug.

### Decision

1. Remove `overflow-hidden` from `OrderFormSection` (card rounding preserved via
   border on the section itself; body content is inset with padding).
2. Pass `sectionClassName="relative z-20"` on the Dealer & Project section so
   the open dropdown paints above the Order Items card (later DOM sibling).

`product-form-section.tsx` is unchanged — no Product Form regression.

### Files

- `src/components/orders/order-form-section.tsx`
- `src/components/orders/order-form.tsx`
