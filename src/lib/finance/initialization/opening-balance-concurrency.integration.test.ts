import { FinancialReferenceType, LedgerPostingType, Prisma, PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createOpeningBalanceDraftForDealer,
  postOpeningBalanceDraft,
  validateOpeningBalanceDraft,
} from "@/lib/finance/initialization/opening-balance-service";
import { OpeningBalanceError } from "@/lib/finance/initialization/opening-balance-errors";
import { buildLedgerPostingKey } from "@/lib/ledger";

/**
 * PHASE_07C integration tests — proves the Financial Initialization Engine's
 * concurrency guarantees against a REAL PostgreSQL instance (row locks,
 * unique constraints), not an in-memory stub. Mirrors the pattern in
 * `issue-invoice-concurrency.test.ts`.
 *
 * Skips automatically (via `it.skipIf`) when no reachable database is
 * configured, so `vitest run` stays green in environments without Docker.
 */
function resolveIntegrationDatabaseUrl(): string | undefined {
  const explicit = process.env.INTEGRATION_DATABASE_URL;
  if (explicit) return explicit;

  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  if (base.includes("@postgres:")) {
    return base.replace("@postgres:", "@127.0.0.1:");
  }
  return base;
}

const integrationDatabaseUrl = resolveIntegrationDatabaseUrl();

const testDealerCodes: string[] = [];

async function createTestDealer(
  prisma: PrismaClient,
  options: { suffix: string; creditLimit?: string },
): Promise<string> {
  const dealerCode = `OBC-${options.suffix}`;
  testDealerCodes.push(dealerCode);
  await prisma.dealer.create({
    data: {
      dealerCode,
      companyName: `Opening Balance Concurrency Dealer ${options.suffix}`,
      mobile: "01700000000",
      address: "Test Address",
      district: "Dhaka",
      territory: "Test",
      creditLimit: new Prisma.Decimal(options.creditLimit ?? "50000.00"),
      currentBalance: new Prisma.Decimal("0.00"),
      isActive: true,
    },
  });
  return dealerCode;
}

async function cleanupTestDealers(prisma: PrismaClient): Promise<void> {
  if (testDealerCodes.length === 0) return;

  await prisma.ledgerEntry.deleteMany({
    where: { dealerCode: { in: testDealerCodes } },
  });
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: testDealerCodes } },
  });
  await prisma.openingBalance.deleteMany({
    where: { dealerCode: { in: testDealerCodes } },
  });
  await prisma.dealer.deleteMany({
    where: { dealerCode: { in: testDealerCodes } },
  });

  testDealerCodes.length = 0;
}

describe("opening balance concurrency (integration)", () => {
  let prisma: PrismaClient;
  let integrationReady = false;
  let adminId = "";

  beforeAll(async () => {
    if (!integrationDatabaseUrl) return;

    prisma = new PrismaClient({
      datasources: { db: { url: integrationDatabaseUrl } },
    });

    try {
      await prisma.$queryRaw`SELECT 1`;
      const admin = await prisma.user.findUnique({
        where: { email: "admin@nazma.local" },
        select: { id: true },
      });
      if (!admin) {
        throw new Error("Super Admin seed required — run npm run seed");
      }
      adminId = admin.id;
      integrationReady = true;
    } catch {
      integrationReady = false;
      if (prisma) await prisma.$disconnect();
    }
  });

  afterEach(async () => {
    if (integrationReady) {
      await cleanupTestDealers(prisma);
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it(
    "rejects concurrent duplicate draft creation for the same dealer — exactly one Draft survives",
    async (ctx) => {
      if (!integrationReady) {
        ctx.skip();
        return;
      }

      const dealerCode = await createTestDealer(prisma, {
        suffix: `${Date.now()}-dup-draft`,
      });

      const results = await Promise.allSettled([
        createOpeningBalanceDraftForDealer({
          dealerCode,
          amount: new Prisma.Decimal("1000.00"),
          effectiveDate: new Date("2026-01-01"),
          remarks: "Attempt A",
          actorId: adminId,
        }),
        createOpeningBalanceDraftForDealer({
          dealerCode,
          amount: new Prisma.Decimal("2000.00"),
          effectiveDate: new Date("2026-01-01"),
          remarks: "Attempt B",
          actorId: adminId,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejection = rejected[0];
      if (rejection.status === "rejected") {
        expect(rejection.reason).toBeInstanceOf(OpeningBalanceError);
        expect((rejection.reason as OpeningBalanceError).code).toBe(
          "ALREADY_INITIALIZED",
        );
      }

      const rowCount = await prisma.openingBalance.count({
        where: { dealerCode },
      });
      expect(rowCount).toBe(1);
    },
  );

  it(
    "serializes concurrent posting of the same record — exactly one LedgerEntry, idempotent outcome",
    async (ctx) => {
      if (!integrationReady) {
        ctx.skip();
        return;
      }

      const dealerCode = await createTestDealer(prisma, {
        suffix: `${Date.now()}-dup-post`,
      });

      const draft = await createOpeningBalanceDraftForDealer({
        dealerCode,
        amount: new Prisma.Decimal("4321.50"),
        effectiveDate: new Date("2026-01-01"),
        remarks: null,
        actorId: adminId,
      });
      await validateOpeningBalanceDraft(draft.id, adminId);

      const [first, second] = await Promise.all([
        postOpeningBalanceDraft(draft.id, adminId),
        postOpeningBalanceDraft(draft.id, adminId),
      ]);

      // Exactly one of the two calls performed the real posting; the other
      // observed the row already Locked (either at entry or after the first
      // call's transaction committed) and replayed idempotently.
      expect(first.record.status).toBe("Locked");
      expect(second.record.status).toBe("Locked");
      expect(first.record.ledgerEntryId).toBe(second.record.ledgerEntryId);

      const ledgerEntries = await prisma.ledgerEntry.findMany({
        where: { dealerCode },
      });
      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0].postingType).toBe(LedgerPostingType.OpeningBalance);
      expect(ledgerEntries[0].referenceType).toBe(
        FinancialReferenceType.OpeningBalance,
      );
      expect(ledgerEntries[0].balance.toFixed(2)).toBe("4321.50");

      const postingKey = buildLedgerPostingKey({
        referenceType: FinancialReferenceType.OpeningBalance,
        referenceId: `OB-${dealerCode}`,
        postingType: LedgerPostingType.OpeningBalance,
      });
      const postingKeyCount = await prisma.ledgerEntry.count({
        where: { postingKey },
      });
      expect(postingKeyCount).toBe(1);

      const dealer = await prisma.dealer.findUnique({
        where: { dealerCode },
        select: { currentBalance: true },
      });
      expect(dealer?.currentBalance.toFixed(2)).toBe("4321.50");
    },
  );
});
