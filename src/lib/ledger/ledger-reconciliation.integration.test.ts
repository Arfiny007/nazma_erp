import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reconcileAllDealers } from "@/lib/ledger/ledger-reconciliation";

function resolveIntegrationDatabaseUrl(): string | undefined {
  const explicit = process.env.INTEGRATION_DATABASE_URL;
  if (explicit) {
    return explicit;
  }

  const base = process.env.DATABASE_URL;
  if (!base) {
    return undefined;
  }

  if (base.includes("@postgres:")) {
    return base.replace("@postgres:", "@127.0.0.1:");
  }

  return base;
}

const integrationDatabaseUrl = resolveIntegrationDatabaseUrl();

/**
 * Repository-wide reconciliation against live PostgreSQL.
 *
 * Certifies: for every dealer with ledger rows,
 *   SUM(debit) − SUM(credit) = last entry balance = Dealer.currentBalance.
 *
 * Dealers with non-zero cache and zero ledger rows are flagged as unreconciled
 * (pre-PHASE_07B / pre-backfill data) — expected until PHASE_07E.
 */
describe("repository ledger reconciliation (integration)", () => {
  let prisma: PrismaClient;
  let integrationReady = false;

  beforeAll(async () => {
    if (!integrationDatabaseUrl) {
      return;
    }

    prisma = new PrismaClient({
      datasources: { db: { url: integrationDatabaseUrl } },
    });

    try {
      await prisma.$queryRaw`SELECT 1`;
      integrationReady = true;
    } catch {
      integrationReady = false;
      await prisma.$disconnect();
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it.skipIf(!integrationReady)(
    "reconcileAllDealers reports integrity for every dealer",
    async () => {
      const report = await reconcileAllDealers(prisma);

      expect(report.dealerCount).toBeGreaterThanOrEqual(0);

      // When unreconciled dealers exist, they are pre-backfill legacy rows —
      // not a posting-engine defect for post-PHASE_07B events.
      if (report.unreconciledDealers.length > 0) {
        const legacy = await prisma.dealer.findMany({
          where: { dealerCode: { in: report.unreconciledDealers } },
          select: {
            dealerCode: true,
            currentBalance: true,
            _count: { select: { ledgerEntries: true } },
          },
        });

        for (const row of legacy) {
          const hasLedger = row._count.ledgerEntries > 0;
          const hasCache = !row.currentBalance.equals(new Prisma.Decimal(0));
          if (hasLedger) {
            throw new Error(
              `Dealer ${row.dealerCode} has ledger rows but failed integrity — posting defect`,
            );
          }
          expect(hasCache).toBe(true);
        }
      }
    },
  );
});
