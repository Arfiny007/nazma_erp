import { OpeningBalanceSource, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { OpeningBalanceError } from "@/lib/finance/initialization/opening-balance-errors";
import {
  createOpeningBalanceRecord,
  postOpeningBalanceRecord,
  validateOpeningBalanceRecord,
} from "@/lib/finance/initialization/opening-balance";
import {
  assertDealerExists,
  assertDealerNotInitialized,
  collectOpeningBalanceValidationIssues,
} from "@/lib/finance/initialization/opening-balance-validation";
import type { OpeningBalanceRecord } from "@/lib/finance/initialization/opening-balance-types";
import type {
  OpeningBalanceDTO,
  OpeningBalanceFieldError,
} from "@/types/opening-balance";

/**
 * Financial Initialization Engine — orchestration layer (PHASE_07C).
 *
 * Wraps the core workflow (`opening-balance.ts`) in `prisma.$transaction`,
 * resolves dealer existence / uniqueness up front, and converts persisted
 * rows into transport-safe DTOs. Server actions (`src/lib/actions/opening-balance/`)
 * call ONLY this module — never the core engine or `posting-service.ts`
 * directly — so RBAC, Zod parsing, and revalidation stay in one place.
 *
 * @see ADR-028
 */

const openingBalanceDetailInclude = {
  dealer: { select: { companyName: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.OpeningBalanceInclude;

type OpeningBalanceDetailRow = Prisma.OpeningBalanceGetPayload<{
  include: typeof openingBalanceDetailInclude;
}>;

export function toOpeningBalanceDTO(row: OpeningBalanceDetailRow): OpeningBalanceDTO {
  return {
    id: row.id,
    dealerCode: row.dealerCode,
    dealerName: row.dealer.companyName,
    amount: row.amount.toFixed(2),
    effectiveDate: row.effectiveDate.toISOString(),
    status: row.status,
    source: row.source,
    referenceNo: row.referenceNo,
    remarks: row.remarks,
    createdById: row.createdById,
    createdByName: row.createdBy.name,
    validatedAt: row.validatedAt?.toISOString() ?? null,
    validatedById: row.validatedById,
    postedAt: row.postedAt?.toISOString() ?? null,
    postedById: row.postedById,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    ledgerEntryId: row.ledgerEntryId,
    postingKey: row.postingKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function loadOpeningBalanceDTO(
  id: string,
): Promise<OpeningBalanceDTO | null> {
  const row = await prisma.openingBalance.findUnique({
    where: { id },
    include: openingBalanceDetailInclude,
  });
  return row ? toOpeningBalanceDTO(row) : null;
}

function isDealerCodeUniqueViolation(
  error: Prisma.PrismaClientKnownRequestError,
): boolean {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((field) => String(field).includes("dealerCode"));
  }
  if (typeof target === "string") {
    return target.includes("dealerCode");
  }
  return false;
}

/**
 * Creates a Draft Opening Balance for a dealer.
 *
 * Checks dealer existence AND uniqueness inside the same transaction as the
 * insert, then relies on the `dealerCode` unique constraint as the final
 * backstop against a race between two concurrent draft attempts for the
 * same dealer.
 */
export async function createOpeningBalanceDraftForDealer(params: {
  dealerCode: string;
  amount: Prisma.Decimal;
  effectiveDate: Date;
  remarks: string | null;
  actorId: string;
}): Promise<OpeningBalanceRecord> {
  try {
    return await prisma.$transaction(async (tx) => {
      const dealer = assertDealerExists(
        await tx.dealer.findUnique({
          where: { dealerCode: params.dealerCode },
          select: { dealerCode: true },
        }),
      );

      assertDealerNotInitialized(
        await tx.openingBalance.findUnique({
          where: { dealerCode: dealer.dealerCode },
          select: { id: true },
        }),
      );

      return createOpeningBalanceRecord(
        tx,
        {
          dealerCode: dealer.dealerCode,
          amount: params.amount,
          effectiveDate: params.effectiveDate,
          source: OpeningBalanceSource.Manual,
          remarks: params.remarks,
        },
        params.actorId,
      );
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      isDealerCodeUniqueViolation(error)
    ) {
      throw new OpeningBalanceError(
        "ALREADY_INITIALIZED",
        "openingBalance.error.alreadyInitialized",
      );
    }
    throw error;
  }
}

export interface OpeningBalanceValidationOutcome {
  valid: boolean;
  issues: OpeningBalanceFieldError[];
  record: OpeningBalanceRecord | null;
}

/**
 * Runs business validation for the "Validation" wizard step and, only when
 * every check passes, transitions Draft → Validated. Draft and Validation
 * NEVER touch `Dealer.currentBalance` or the ledger — this function performs
 * no posting of any kind.
 */
export async function validateOpeningBalanceDraft(
  id: string,
  actorId: string,
): Promise<OpeningBalanceValidationOutcome> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.openingBalance.findUnique({ where: { id } });
    if (!existing) {
      throw new OpeningBalanceError(
        "RECORD_NOT_FOUND",
        "openingBalance.error.notFound",
      );
    }

    const dealer = await tx.dealer.findUnique({
      where: { dealerCode: existing.dealerCode },
      select: { dealerCode: true },
    });

    const issues = collectOpeningBalanceValidationIssues({
      amount: existing.amount,
      effectiveDate: existing.effectiveDate,
      dealerExists: Boolean(dealer),
    });

    if (issues.length > 0) {
      return { valid: false, issues, record: null };
    }

    // Idempotent — re-running validation on an already-Validated (or later)
    // record is a no-op read, never re-transitions or throws.
    if (existing.status !== "Draft") {
      return {
        valid: true,
        issues: [],
        record: {
          id: existing.id,
          dealerCode: existing.dealerCode,
          amount: existing.amount,
          effectiveDate: existing.effectiveDate,
          status: existing.status,
          source: existing.source,
          referenceNo: existing.referenceNo,
          remarks: existing.remarks,
          createdById: existing.createdById,
          validatedAt: existing.validatedAt,
          validatedById: existing.validatedById,
          postedAt: existing.postedAt,
          postedById: existing.postedById,
          lockedAt: existing.lockedAt,
          ledgerEntryId: existing.ledgerEntryId,
          postingKey: existing.postingKey,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        },
      };
    }

    const record = await validateOpeningBalanceRecord(tx, id, actorId);
    return { valid: true, issues: [], record };
  });
}

export interface OpeningBalancePostOutcomeResult {
  record: OpeningBalanceRecord;
  alreadyPosted: boolean;
}

/**
 * Posts (and locks) a Validated Opening Balance. The ONLY path from here to
 * the ledger is `postOpeningBalanceRecord` → `posting-service.postOpeningBalance`
 * → `createLedgerEntry`. Never bypassed.
 */
export async function postOpeningBalanceDraft(
  id: string,
  actorId: string,
): Promise<OpeningBalancePostOutcomeResult> {
  return prisma.$transaction((tx) => postOpeningBalanceRecord(tx, id, actorId));
}
