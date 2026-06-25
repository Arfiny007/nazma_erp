import { Prisma } from "@prisma/client";

/**
 * Pessimistic dealer row lock for financial mutations.
 *
 * Must be acquired at the start of any transaction that reads
 * `Dealer.currentBalance` for credit checks, `previousDue` snapshots, or
 * receivable postings. Serializes same-dealer invoice issue under READ COMMITTED.
 *
 * @see ADR-015 — dealer balance concurrency remediation
 */

export interface LockedDealerFinancialSnapshot {
  dealerCode: string;
  creditLimit: Prisma.Decimal;
  currentBalance: Prisma.Decimal;
}

type DealerLockRow = {
  dealerCode: string;
  creditLimit: Prisma.Decimal;
  currentBalance: Prisma.Decimal;
};

export async function lockDealerForFinancialUpdate(
  tx: Prisma.TransactionClient,
  dealerCode: string,
): Promise<LockedDealerFinancialSnapshot> {
  const rows = await tx.$queryRaw<DealerLockRow[]>`
    SELECT "dealerCode", "creditLimit", "currentBalance"
    FROM "Dealer"
    WHERE "dealerCode" = ${dealerCode}
    FOR UPDATE
  `;

  const dealer = rows[0];
  if (!dealer) {
    throw new Error(`Dealer not found for financial lock: ${dealerCode}`);
  }

  return {
    dealerCode: dealer.dealerCode,
    creditLimit: dealer.creditLimit,
    currentBalance: dealer.currentBalance,
  };
}
