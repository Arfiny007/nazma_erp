import { OpeningBalanceStatus, Prisma } from "@prisma/client";

import { lockDealerForFinancialUpdate } from "@/lib/finance/dealer-lock";
import { postOpeningBalance as postOpeningBalanceLedgerEntry } from "@/lib/finance/posting-service";
import {
  assertDraftForValidation,
  assertNotLocked,
  assertPreviousBalanceZero,
  assertRecordFound,
  assertValidatedForPosting,
} from "@/lib/finance/initialization/opening-balance-validation";
import { OpeningBalanceError } from "@/lib/finance/initialization/opening-balance-errors";
import type {
  OpeningBalancePostOutcome,
  OpeningBalanceRecord,
  OpeningBalanceRecordInput,
  OpeningBalanceWriteClient,
} from "@/lib/finance/initialization/opening-balance-types";

/**
 * Financial Initialization Engine — core workflow (PHASE_07C).
 *
 * This module is the REUSABLE core: every function is producer-agnostic
 * (`OpeningBalanceRecordInput.source` may be `Manual` today, `CsvImport` /
 * `ExcelImport` / `ErpMigration` tomorrow) and takes an already-open Prisma
 * transaction. `opening-balance-service.ts` wraps these in `prisma.$transaction`
 * and maps rows to DTOs for the server-action layer; a future bulk importer
 * calls these SAME functions in a loop — see `postOpeningBalanceBatch` below.
 *
 * State machine (permanent, never bypassed):
 *
 *   NotInitialized  (no row)
 *         │  createOpeningBalanceRecord
 *         ▼
 *       Draft            — editable, never touches balance/ledger
 *         │  validateOpeningBalanceRecord
 *         ▼
 *     Validated          — ready, never touches balance/ledger
 *         │  postOpeningBalanceRecord
 *         ▼
 *   Posted + Locked       — ONE immutable LedgerEntry (or none for amount=0),
 *                           Dealer.currentBalance updated, forever immutable
 *
 * Posted and Locked are set in the SAME transaction/instant — there is no
 * reviewable state between "the ledger entry exists" and "this record can
 * never be touched again" (ADR-028 §4).
 *
 * @see ADR-028, FINANCIAL_INVARIANTS.md §18
 */

const OPENING_BALANCE_REFERENCE_PREFIX = "OB" as const;

export function buildOpeningBalanceReferenceNo(dealerCode: string): string {
  return `${OPENING_BALANCE_REFERENCE_PREFIX}-${dealerCode}`;
}

/**
 * Creates a Draft `OpeningBalance` row. Fails the unique `dealerCode`
 * constraint (mapped by the service layer to `ALREADY_INITIALIZED`) if the
 * dealer already has any record — Draft, Validated, Posted, or Locked.
 */
export async function createOpeningBalanceRecord(
  tx: OpeningBalanceWriteClient,
  input: OpeningBalanceRecordInput,
  actorId: string,
): Promise<OpeningBalanceRecord> {
  const row = await tx.openingBalance.create({
    data: {
      dealerCode: input.dealerCode,
      amount: input.amount,
      effectiveDate: input.effectiveDate,
      source: input.source,
      remarks: input.remarks ?? null,
      referenceNo: buildOpeningBalanceReferenceNo(input.dealerCode),
      status: OpeningBalanceStatus.Draft,
      createdById: actorId,
    },
  });

  return toOpeningBalanceRecord(row);
}

/**
 * Draft → Validated. Never touches `Dealer.currentBalance` or the ledger —
 * validation is a pure status transition plus an audit-friendly timestamp.
 */
export async function validateOpeningBalanceRecord(
  tx: OpeningBalanceWriteClient,
  recordId: string,
  actorId: string,
): Promise<OpeningBalanceRecord> {
  const existing = assertRecordFound(
    await tx.openingBalance.findUnique({ where: { id: recordId } }),
  );

  assertDraftForValidation(existing.status);

  const row = await tx.openingBalance.update({
    where: { id: recordId },
    data: {
      status: OpeningBalanceStatus.Validated,
      validatedAt: new Date(),
      validatedById: actorId,
    },
  });

  return toOpeningBalanceRecord(row);
}

/**
 * Validated → Posted + Locked. The ONLY function in this module that mutates
 * `Dealer.currentBalance` — and it does so exclusively via
 * `postOpeningBalance()` in `posting-service.ts`, which is the sole writer of
 * `LedgerEntry`. Never inserts a ledger row directly.
 *
 * Idempotent: if the record is already `Locked`, returns it unchanged with
 * `alreadyPosted: true` instead of re-posting or throwing — this is the
 * "posting twice must never create a duplicate" guarantee at the workflow
 * layer, on top of the `postingKey` uniqueness guarantee at the ledger layer.
 */
export async function postOpeningBalanceRecord(
  tx: Prisma.TransactionClient,
  recordId: string,
  actorId: string,
): Promise<OpeningBalancePostOutcome> {
  const existing = assertRecordFound(
    await tx.openingBalance.findUnique({ where: { id: recordId } }),
  );

  if (existing.status === OpeningBalanceStatus.Locked) {
    return { record: toOpeningBalanceRecord(existing), alreadyPosted: true };
  }

  assertValidatedForPosting(existing.status);
  assertNotLocked(existing.status);

  const lockedDealer = await lockDealerForFinancialUpdate(
    tx,
    existing.dealerCode,
  );

  // Re-check AFTER acquiring the dealer lock (same idiom as
  // `issue-invoice-transaction.ts`'s post-lock idempotent challan check): a
  // concurrent caller may have posted+locked this exact record while we were
  // blocked waiting for the lock. Without this, the losing transaction would
  // observe a non-zero `currentBalance` from the winner's commit and fail
  // loudly at `assertPreviousBalanceZero` instead of replaying idempotently.
  const afterLock = assertRecordFound(
    await tx.openingBalance.findUnique({ where: { id: recordId } }),
  );
  if (afterLock.status === OpeningBalanceStatus.Locked) {
    return { record: toOpeningBalanceRecord(afterLock), alreadyPosted: true };
  }

  // Opening balance is defined as the dealer's first-ever posting. If a
  // dealer somehow already carries a non-zero balance (e.g. legacy data
  // seeded outside this engine), refuse rather than silently compounding it.
  assertPreviousBalanceZero(lockedDealer.currentBalance);

  const referenceNo =
    existing.referenceNo ?? buildOpeningBalanceReferenceNo(existing.dealerCode);

  const postingResult = await postOpeningBalanceLedgerEntry({
    tx,
    dealerCode: existing.dealerCode,
    amount: existing.amount,
    previousBalance: lockedDealer.currentBalance,
    userId: actorId,
    effectiveDate: existing.effectiveDate,
    referenceNo,
    openingBalanceId: existing.id,
    remarks: existing.remarks,
  });

  const now = new Date();
  const row = await tx.openingBalance.update({
    where: { id: recordId },
    data: {
      status: OpeningBalanceStatus.Locked,
      referenceNo,
      postedAt: now,
      postedById: actorId,
      lockedAt: now,
      ledgerEntryId: postingResult.ledgerEntryId,
      postingKey: postingResult.ledgerPostingKey,
    },
  });

  return { record: toOpeningBalanceRecord(row), alreadyPosted: false };
}

/**
 * Bulk-posting entry point reserved for future Bulk Opening Balance Import /
 * ERP Migration. Runs each record's `postOpeningBalanceRecord` independently
 * so one bad row never rolls back an entire batch. Not called by the
 * PHASE_07C manual wizard — ships now so the importer needs zero engine
 * changes, only a new caller.
 */
export async function postOpeningBalanceBatch(
  tx: Prisma.TransactionClient,
  recordIds: string[],
  actorId: string,
): Promise<{
  succeeded: OpeningBalancePostOutcome[];
  failed: Array<{ recordId: string; error: string }>;
}> {
  const succeeded: OpeningBalancePostOutcome[] = [];
  const failed: Array<{ recordId: string; error: string }> = [];

  for (const recordId of recordIds) {
    try {
      const outcome = await postOpeningBalanceRecord(tx, recordId, actorId);
      succeeded.push(outcome);
    } catch (error) {
      failed.push({
        recordId,
        error:
          error instanceof OpeningBalanceError
            ? error.code
            : error instanceof Error
              ? error.message
              : "UNKNOWN_ERROR",
      });
    }
  }

  return { succeeded, failed };
}

type OpeningBalanceRow = Awaited<
  ReturnType<OpeningBalanceWriteClient["openingBalance"]["create"]>
>;

function toOpeningBalanceRecord(row: OpeningBalanceRow): OpeningBalanceRecord {
  return {
    id: row.id,
    dealerCode: row.dealerCode,
    amount: row.amount,
    effectiveDate: row.effectiveDate,
    status: row.status,
    source: row.source,
    referenceNo: row.referenceNo,
    remarks: row.remarks,
    createdById: row.createdById,
    validatedAt: row.validatedAt,
    validatedById: row.validatedById,
    postedAt: row.postedAt,
    postedById: row.postedById,
    lockedAt: row.lockedAt,
    ledgerEntryId: row.ledgerEntryId,
    postingKey: row.postingKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
