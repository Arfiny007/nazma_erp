import { Prisma, type PrismaClient } from "@prisma/client";

import {
  createOpeningBalanceDraftForDealer,
  postOpeningBalanceDraft,
  validateOpeningBalanceDraft,
} from "@/lib/finance/initialization/opening-balance-service";

import { DEMO_COUNTS } from "./constants";
import { daysAgo, randomInt } from "./helpers";
import type { DemoDealerRef } from "./types";

/**
 * Posts opening balances for the first N demo dealers via the certified
 * Draft → Validated → Posted pipeline only.
 */
export async function seedDemoOpeningBalances(
  prisma: PrismaClient,
  actorUserId: string,
  dealers: DemoDealerRef[],
): Promise<number> {
  const existing = await prisma.openingBalance.count({
    where: {
      dealer: { mobile: { startsWith: "0199DEMO" } },
      status: { in: ["Posted", "Locked"] },
    },
  });

  if (existing >= DEMO_COUNTS.openingBalances) {
    return existing;
  }

  const targets = dealers.slice(0, DEMO_COUNTS.openingBalances);
  let posted = existing;

  for (const dealer of targets) {
    if (posted >= DEMO_COUNTS.openingBalances) {
      break;
    }

    const already = await prisma.openingBalance.findUnique({
      where: { dealerCode: dealer.dealerCode },
      select: { id: true, status: true },
    });

    if (already?.status === "Posted" || already?.status === "Locked") {
      posted += 1;
      continue;
    }

    if (already) {
      await prisma.openingBalance.delete({ where: { id: already.id } });
    }

    const liveDealer = await prisma.dealer.findUnique({
      where: { dealerCode: dealer.dealerCode },
      select: { currentBalance: true },
    });

    if (!liveDealer?.currentBalance.isZero()) {
      continue;
    }

    const amount = new Prisma.Decimal(randomInt(15_000, 120_000));
    const effectiveDate = daysAgo(randomInt(90, 365));

    const draft = await createOpeningBalanceDraftForDealer({
      dealerCode: dealer.dealerCode,
      amount,
      effectiveDate,
      remarks: "Demo historical opening due",
      actorId: actorUserId,
    });

    const validation = await validateOpeningBalanceDraft(draft.id, actorUserId);
    if (!validation.valid || !validation.record) {
      throw new Error(
        `Opening balance validation failed for ${dealer.dealerCode}`,
      );
    }

    await postOpeningBalanceDraft(draft.id, actorUserId);
    posted += 1;
  }

  console.log(`  ✓ ${String(posted)} opening balances`);
  return posted;
}
