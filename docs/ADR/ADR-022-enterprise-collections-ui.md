# ADR-022: Enterprise Collections UI — PHASE_06B

Date: 2026-06-30

Status: ACCEPTED

Phase: PHASE_06B_ENTERPRISE_COLLECTIONS_UI

Builds on: ADR-019, ADR-020, ADR-021

---

## Context

PHASE_06A delivered and certified the Collection Engine backend (schema,
server actions, allocation engine, posting, reversal). PHASE_06B implements
the accountant-grade Collections UI — list, unified create/confirm workspace,
allocation workflow, detail view, and reversal UX.

No backend business logic changes unless UI integration defects are found.
Receipt PDF, ledger, and reports remain deferred.

---

## Decision

### 1. Route architecture

| Route | Server | Client | Purpose |
|-------|--------|--------|---------|
| `/collections` | — | `page.tsx` | Enterprise list with filters |
| `/collections/new` | `page.tsx` | `page-client.tsx` | Create workspace |
| `/collections/[id]` | `page.tsx` | `page-client.tsx` | Detail (redirects Draft → edit) |
| `/collections/[id]/edit` | `page.tsx` | `page-client.tsx` | Draft edit only |
| `/collections/[id]/allocate` | `page.tsx` | `page-client.tsx` | Post-confirm allocation |

Hybrid pattern matches Invoices and Delivery Challans: server pages enforce RBAC
and prefetch DTOs; client pages render interactive workspace.

### 2. Component hierarchy

```
PageContainer
├── CollectionTable                    (list)
│   ├── CollectionSearch
│   ├── CollectionFilters (+ DealerCombobox)
│   └── CollectionStatusBadge
├── CollectionWorkspace                (create / edit / allocate)
│   ├── CollectionDealerSummaryCard
│   ├── CollectionInfoForm
│   ├── CollectionAllocationWorkspace
│   ├── CollectionAllocationSummary
│   └── Workflow actions
└── CollectionDetailView               (detail)
    ├── CollectionAdvanceBanner
    ├── Allocation history table
    ├── CollectionHistoryTimeline
    ├── Financial summary sidebar
    └── CollectionReverseDialog
```

### 3. Workspace architecture

The **Collection Workspace** is a unified accountant surface shared across
create, draft edit, and allocate modes via `CollectionWorkspaceMode`:

| Mode | Dealer picker | Form editable | Allocation inputs |
|------|---------------|---------------|-------------------|
| `create` | Yes | Yes | Disabled (Draft guard) |
| `edit` | No | Yes (Draft only) | Disabled |
| `allocate` | No | Read-only | Enabled |

**Workflow:**

1. Select dealer → `getDealerCollectionContext()` loads financial summary +
   open invoices (`allocatableOutstanding` from server `computeInvoiceOutstanding`).
2. Save Draft → `createCollection()` / `updateCollection()`.
3. Confirm → `confirmCollection()` → redirect to allocate when pool > 0.
4. Allocate → `previewCollectionAllocation()` (live) → `allocateCollection()`.

Cash posting occurs only on confirmation (ADR-020). UI never mutates
`Dealer.currentBalance` directly.

### 4. Allocation UX

- Outstanding invoices table: Invoice, Issue Date, Due Date, Outstanding
  (`grandTotal − collectionReceived`), Allocate input, Remaining.
- Live summary uses `previewCollectionAllocation()` when `collectionId` exists
  (allocate mode). Create/edit modes show UI-only sums for received vs entered
  amounts — not financial posting.
- Disabled when: invoice fully paid, collection reversed, collection draft,
  or unallocated pool = 0.

### 5. Advance payment UX

- When `unallocatedAmount > 0`, `CollectionAdvanceBanner` displays premium info
  message (not an error).
- When `Dealer.currentBalance < 0`, `AdvanceCreditIndicator` shows blue
  "Advance Credit" badge — never styled as error/warning.

### 6. Reversal UX

Detail page → Reverse button → `CollectionReverseDialog` (reason required) →
`reverseCollection()` → page refresh. Confirmed collections are never editable.

### 7. Server / client boundaries

| Concern | Layer |
|---------|-------|
| RBAC | Server (`enforcePermission` / `requirePermission`) |
| Financial caps | Server (`allocation-engine`, `previewCollectionAllocation`) |
| DTO transport | Decimal strings in `CollectionDetailDTO` |
| Money display | Client `useFormatMoney` |
| Allocation preview | Server action; client displays result |
| Audit history | Server `fetchCollectionHistory` in `loadCollectionDetailDTO` |

New read-only action: `getDealerCollectionContext()` — dealer summary +
allocatable invoices for workspace. No posting side effects.

### 8. RBAC mapping

Reuses existing permission matrix (no duplicate logic):

| UI action | Permission |
|-----------|------------|
| View list / detail | `collections:view` |
| Create | `collections:create` |
| Edit draft / confirm / allocate / reverse | `collections:edit` |
| Cancel draft | `collections:delete` |

Spec aliases (`collections:allocate`, `collections:reverse`) map to
`collections:edit` per ADR-020 server actions.

### 9. Future receipt integration

- Print button on list/detail is a disabled placeholder.
- `CollectionDetailView` and list actions reserve hooks for a future
  `CollectionDocumentPreview` component (mirroring Invoice document engine).
- No schema changes required — `collectionNo`, payment fields, and allocation
  rows are sufficient for money receipt PDF (PHASE post-06B).

---

## Consequences

### Positive

- Accountant-grade workspace comparable to enterprise ERP collection entry
- Certified backend reused without duplication of financial calculations
- Generic allocation workspace ready for non-invoice reference types
- Bilingual localization for all user-facing strings

### Deferred

- Money receipt PDF
- Ledger entries (PHASE_07)
- Due reports (PHASE_08)

---

## Verification

- `npx prisma generate`
- `npx tsc --noEmit`
- `npx eslint`

---

## References

- ADR-019 — Collections foundation
- ADR-020 — Collection engine
- ADR-021 — Financial certification
