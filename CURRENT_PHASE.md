# CURRENT_PHASE.md

Current Phase:

PHASE_02C_DEALER_FORMS

Status:

COMPLETE

---

## Objectives

Build the Dealer Create and Edit workflows on top of the existing data layer:

* Create Dealer form
* Edit Dealer form (pre-filled from existing record)
* Client-side validation via the existing Zod schemas
* Loading states during submission and edit-record loading
* Success and error feedback (banners + inline field errors)
* English / Bengali localization

---

## Deliverables

src/app/(dashboard)/dealers/new/page.tsx

src/app/(dashboard)/dealers/[dealerCode]/edit/page.tsx

src/components/dealers/dealer-form.tsx

src/components/dealers/dealer-form-section.tsx

public/locales/en/common.json (dealer form + validation keys)

public/locales/bn/common.json (dealer form + validation keys)

src/app/(dashboard)/dealers/page.tsx (added "New Dealer" entry point)

---

## Implementation Notes

* Uses React Hook Form with `@hookform/resolvers/zod` and the existing
  `createDealerSchema` as the single client-side validation source for both
  create and edit (the `updateDealer` action re-validates server-side).
* Form values are typed off the schema: `z.input` for controls, `z.output`
  for the validated payload handed to the server actions.
* Consumes the existing `createDealer`, `updateDealer`, and `getDealer` server
  actions and `DealerDTO` types (no new data layer).
* Edit page loads the record client-side via `getDealer({ dealerCode })`,
  mirroring the list page's client + server-action pattern; shows a form
  skeleton while loading and an error state on failure.
* Credit limit uses a Decimal-safe currency input: digits + at most two
  decimals, no negative values, thousands grouping for display only (BigInt
  grouping — no floating-point math), so the stored value matches
  `Decimal(18,2)`.
* Typed action errors map `fieldErrors` to inline messages and `messageKey`
  to a banner; all messages resolve through localization keys (en + bn).
* Responsive layout: single column on mobile, two-column form sections on
  desktop; address spans the full width.
* On success a confirmation banner is shown, then the user is redirected to
  the dealer list with a router refresh.

---

## Completion Criteria

Phase 02C is complete when:

* Create Dealer persists via `createDealer` and redirects on success
* Edit Dealer loads via `getDealer` and persists via `updateDealer`
* Validation errors render inline; action errors render as a banner
* Loading spinner shows during submission; skeleton shows while loading a record
* Credit limit input is currency-formatted, non-negative, and Decimal-safe
* All user-facing strings use localization keys (en + bn)
* TypeScript passes (`tsc --noEmit`)
* ESLint passes (0 errors)

All criteria met.

---

## Next Phase

PHASE_02D_DEALER_PROFILE
