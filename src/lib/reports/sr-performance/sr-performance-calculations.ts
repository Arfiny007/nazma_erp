import { Prisma } from "@prisma/client";
import type { FinancialReferenceType, LedgerPostingType } from "@prisma/client";

/**
 * Decimal-safe financial helpers for SR Performance — PHASE_12A / ADR-060.
 *
 * Never convert money to JavaScript `number`. All arithmetic uses Prisma.Decimal.
 */

export const ZERO = new Prisma.Decimal(0);

export function normalizeAggregate(
  value: Prisma.Decimal | null | undefined,
): Prisma.Decimal {
  return value ?? ZERO;
}

/**
 * Client formula columns:
 *   Balance Due / Net Balance = Previous Due + Sales - Collection
 */
export function calculateBalanceDue(
  previousDue: Prisma.Decimal,
  sales: Prisma.Decimal,
  collection: Prisma.Decimal,
): Prisma.Decimal {
  return previousDue.plus(sales).minus(collection);
}

export const calculateNetBalance = calculateBalanceDue;

/**
 * Full ledger movement for the period: SUM(debit - credit).
 * Used for reconciliation against the Sales/Collection column formula.
 */
export function calculateActualClosing(
  previousDue: Prisma.Decimal,
  ledgerMovement: Prisma.Decimal,
): Prisma.Decimal {
  return previousDue.plus(ledgerMovement);
}

export function calculateReconciliationDelta(
  previousDue: Prisma.Decimal,
  ledgerMovement: Prisma.Decimal,
  calculatedBalance: Prisma.Decimal,
): Prisma.Decimal {
  return calculateActualClosing(previousDue, ledgerMovement).minus(calculatedBalance);
}

export interface PeriodMovementContribution {
  sales: Prisma.Decimal;
  collection: Prisma.Decimal;
  ledgerMovement: Prisma.Decimal;
  isUnsupported: boolean;
}

/**
 * Classifies a single ledger entry into Sales / Collection / unsupported.
 *
 * Collection reversals (postingType=Reversal, referenceType=Collection) reduce
 * period collection via debit rather than appearing as sales.
 */
export function classifyPeriodEntry(entry: {
  postingType: LedgerPostingType;
  referenceType: FinancialReferenceType;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
}): PeriodMovementContribution {
  const debit = normalizeAggregate(entry.debit);
  const credit = normalizeAggregate(entry.credit);
  const ledgerMovement = debit.minus(credit);

  if (entry.postingType === "Issue") {
    return {
      sales: debit,
      collection: ZERO,
      ledgerMovement,
      isUnsupported: false,
    };
  }

  if (entry.postingType === "Collection") {
    return {
      sales: ZERO,
      collection: credit,
      ledgerMovement,
      isUnsupported: false,
    };
  }

  if (
    entry.postingType === "Reversal" &&
    entry.referenceType === "Collection"
  ) {
    return {
      sales: ZERO,
      collection: debit.negated(),
      ledgerMovement,
      isUnsupported: false,
    };
  }

  return {
    sales: ZERO,
    collection: ZERO,
    ledgerMovement,
    isUnsupported: true,
  };
}

export function sumTotals(
  rows: ReadonlyArray<{
    previousDue: Prisma.Decimal;
    sales: Prisma.Decimal;
    collection: Prisma.Decimal;
    balanceDue?: Prisma.Decimal;
    netBalance?: Prisma.Decimal;
  }>,
): {
  previousDue: Prisma.Decimal;
  sales: Prisma.Decimal;
  collection: Prisma.Decimal;
  netBalance: Prisma.Decimal;
} {
  let previousDue = ZERO;
  let sales = ZERO;
  let collection = ZERO;
  let netBalance = ZERO;

  for (const row of rows) {
    previousDue = previousDue.plus(row.previousDue);
    sales = sales.plus(row.sales);
    collection = collection.plus(row.collection);
    const balance = row.balanceDue ?? row.netBalance ?? calculateBalanceDue(
      row.previousDue,
      row.sales,
      row.collection,
    );
    netBalance = netBalance.plus(balance);
  }

  return { previousDue, sales, collection, netBalance };
}

export function buildDealerFinancials(aggregate: {
  previousDue: Prisma.Decimal;
  sales: Prisma.Decimal;
  collection: Prisma.Decimal;
  ledgerMovement: Prisma.Decimal;
  unsupportedPostingCount: number;
}): {
  previousDue: Prisma.Decimal;
  sales: Prisma.Decimal;
  collection: Prisma.Decimal;
  balanceDue: Prisma.Decimal;
  reconciliationDelta: Prisma.Decimal;
  unsupportedPostingCount: number;
} {
  const previousDue = normalizeAggregate(aggregate.previousDue);
  const sales = normalizeAggregate(aggregate.sales);
  const collection = normalizeAggregate(aggregate.collection);
  const ledgerMovement = normalizeAggregate(aggregate.ledgerMovement);
  const balanceDue = calculateBalanceDue(previousDue, sales, collection);
  const reconciliationDelta = calculateReconciliationDelta(
    previousDue,
    ledgerMovement,
    balanceDue,
  );

  return {
    previousDue,
    sales,
    collection,
    balanceDue,
    reconciliationDelta,
    unsupportedPostingCount: aggregate.unsupportedPostingCount,
  };
}
