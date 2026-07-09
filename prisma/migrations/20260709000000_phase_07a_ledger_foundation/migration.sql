-- PHASE_07A_LEDGER_FOUNDATION
--
-- Hardens `LedgerEntry` into an append-only accounting subledger and
-- introduces the `LedgerPostingType` enum. Extends `FinancialReferenceType`
-- with `Collection` so ledger entries can identify collection-sourced events.
--
-- `LedgerEntry` currently has no rows (posting service never wrote to it).
-- The `referenceType` String column is therefore recreated as a typed enum
-- without a data backfill. If your environment has rows in `LedgerEntry`,
-- back them up and reconcile the new columns manually before applying.
--
-- See ADR-024 §4 and ADR-025.

-- ─── Enum extensions ────────────────────────────────────────────────────────

-- Extend FinancialReferenceType so ledger entries can reference Collection
-- documents (collection cash receipts, reversals). Purely additive; existing
-- allocation runtime guards continue to reject Collection at allocation time.
ALTER TYPE "public"."FinancialReferenceType" ADD VALUE IF NOT EXISTS 'Collection';

-- Discrete accounting posting events for LedgerEntry
CREATE TYPE "public"."LedgerPostingType" AS ENUM (
  'Issue',
  'Collection',
  'Reversal',
  'OpeningBalance',
  'CreditNote',
  'DebitNote',
  'ManualAdjustment',
  'JournalEntry',
  'Adjustment'
);

-- ─── LedgerEntry hardening ──────────────────────────────────────────────────

-- Drop the loose String referenceType column; recreate as typed enum.
ALTER TABLE "public"."LedgerEntry" DROP COLUMN "referenceType";
ALTER TABLE "public"."LedgerEntry"
  ADD COLUMN "referenceType" "public"."FinancialReferenceType" NOT NULL;

-- Human-readable reference (e.g. `INV-000123`, `COL-000045`)
ALTER TABLE "public"."LedgerEntry"
  ADD COLUMN "referenceNo" TEXT NOT NULL;

-- System timestamp when the entry was posted (append-only)
ALTER TABLE "public"."LedgerEntry"
  ADD COLUMN "postingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Posting event type
ALTER TABLE "public"."LedgerEntry"
  ADD COLUMN "postingType" "public"."LedgerPostingType" NOT NULL;

-- Idempotency key
ALTER TABLE "public"."LedgerEntry"
  ADD COLUMN "postingKey" TEXT NOT NULL;

-- Compensating reversal link
ALTER TABLE "public"."LedgerEntry"
  ADD COLUMN "reversesEntryId" TEXT;

-- Actor audit
ALTER TABLE "public"."LedgerEntry"
  ADD COLUMN "createdById" TEXT;

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "LedgerEntry_postingKey_key"
  ON "public"."LedgerEntry"("postingKey");

CREATE INDEX "LedgerEntry_postingDate_idx"
  ON "public"."LedgerEntry"("postingDate");

CREATE INDEX "LedgerEntry_dealerCode_transactionDate_idx"
  ON "public"."LedgerEntry"("dealerCode", "transactionDate");

CREATE INDEX "LedgerEntry_dealerCode_postingDate_idx"
  ON "public"."LedgerEntry"("dealerCode", "postingDate");

CREATE INDEX "LedgerEntry_reversesEntryId_idx"
  ON "public"."LedgerEntry"("reversesEntryId");

CREATE INDEX "LedgerEntry_createdById_idx"
  ON "public"."LedgerEntry"("createdById");

-- ─── Foreign keys ───────────────────────────────────────────────────────────

ALTER TABLE "public"."LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_reversesEntryId_fkey"
  FOREIGN KEY ("reversesEntryId")
  REFERENCES "public"."LedgerEntry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_createdById_fkey"
  FOREIGN KEY ("createdById")
  REFERENCES "public"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
