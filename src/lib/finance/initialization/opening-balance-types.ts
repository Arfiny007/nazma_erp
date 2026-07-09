import type {
  OpeningBalanceSource,
  OpeningBalanceStatus,
  Prisma,
} from "@prisma/client";

/**
 * Financial Initialization Engine — internal domain contracts.
 *
 * `OpeningBalance` is the first workflow on a permanent platform. Every type
 * here is deliberately generic over "record producer" (`source`) so future
 * workflows (Bulk Opening Balance Import, ERP Migration, Company
 * Initialization, Branch Initialization, Fiscal Year Initialization) reuse
 * the exact same engine — see `src/lib/finance/initialization/opening-balance.ts`.
 *
 * @see ADR-028
 */

export type { OpeningBalanceSource, OpeningBalanceStatus };

/**
 * Producer-agnostic record input. A Manual UI wizard, a future CSV/Excel
 * importer, and an ERP migration script all converge on this shape before
 * calling `createOpeningBalanceRecord`. Nothing here is Manual-specific.
 */
export interface OpeningBalanceRecordInput {
  dealerCode: string;
  /** Signed opening amount. Positive = dealer owes; negative = advance credit; zero = allowed. */
  amount: Prisma.Decimal;
  effectiveDate: Date;
  source: OpeningBalanceSource;
  remarks?: string | null;
}

/** Persisted projection of an `OpeningBalance` row used across the engine. */
export interface OpeningBalanceRecord {
  id: string;
  dealerCode: string;
  amount: Prisma.Decimal;
  effectiveDate: Date;
  status: OpeningBalanceStatus;
  source: OpeningBalanceSource;
  referenceNo: string | null;
  remarks: string | null;
  createdById: string;
  validatedAt: Date | null;
  validatedById: string | null;
  postedAt: Date | null;
  postedById: string | null;
  lockedAt: Date | null;
  ledgerEntryId: string | null;
  postingKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Minimal Prisma delegate surface the engine needs — keeps unit tests stubbable. */
export type OpeningBalanceWriteClient = Pick<
  Prisma.TransactionClient,
  "openingBalance" | "dealer" | "auditLog"
>;

/**
 * Outcome of a single record's post step. `alreadyPosted` distinguishes a
 * genuine first-time post from an idempotent replay against an already
 * Locked record — both return the same shape so callers (including future
 * bulk import) don't need to branch on it.
 */
export interface OpeningBalancePostOutcome {
  record: OpeningBalanceRecord;
  alreadyPosted: boolean;
}

/**
 * Batch posting result — reserved for future Bulk Opening Balance Import /
 * ERP Migration workflows. Not exercised by the PHASE_07C manual UI, but
 * fixes the contract now so the importer never needs a different engine.
 */
export interface OpeningBalanceBatchResult {
  succeeded: OpeningBalancePostOutcome[];
  failed: Array<{ dealerCode: string; error: string }>;
}
