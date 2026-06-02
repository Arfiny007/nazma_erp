# CURRENT_PHASE.md

Current Phase:

PHASE_02B_DEALER_LIST_UI

Status:

COMPLETE

---

## Objectives

Build the Dealer List page and supporting UI components (read-only listing):

* Dealer listing table (TanStack Table)
* Debounced search input
* Server-driven pagination controls
* Loading skeletons
* Empty + no-results states
* Credit status badge (green / yellow / red)
* English / Bengali localization

---

## Deliverables

src/app/(dashboard)/dealers/page.tsx

src/components/dealers/dealer-table.tsx

src/components/dealers/dealer-search.tsx

src/components/dealers/dealer-credit-badge.tsx

src/components/dealers/dealer-empty-state.tsx

public/locales/en/common.json (dealer keys)

public/locales/bn/common.json (dealer keys)

---

## Implementation Notes

* Uses the existing dashboard layout shell ((dashboard)/layout.tsx) and PageContainer.
* Consumes the existing `listDealers` server action and `DealerDTO` types (no new data layer).
* Server-side pagination and sorting via the action's page / sortBy / sortOrder params;
  sortable columns are limited to those in `DEALER_SORT_FIELDS`.
* Credit bands reuse the pre-computed `credit` utilization on each `DealerDTO`:
  green 0-84%, yellow 85-99%, red 100%+.
* Sticky table header, horizontal scroll for mobile, dimmed refetch state.
* No mock data, no create/edit form, no profile page.

---

## Completion Criteria

Phase 02B is complete when:

* Dealer list renders real data from `listDealers`
* Search, pagination, and column sorting work end-to-end
* Credit status badge maps utilization to green / yellow / red
* Loading skeletons, empty state, and error state are present
* All user-facing strings use localization keys (en + bn)
* TypeScript passes (`tsc --noEmit`)
* ESLint passes (0 errors)

All criteria met.

---

## Next Phase

PHASE_02C_DEALER_FORMS
