import { Prisma, type PrismaClient } from "@prisma/client";

import { assignDealerTerritory } from "@/lib/dealers/ownership";
import { generateNextDealerCode } from "@/lib/utils/dealer-code";

import { DEMO_COUNTS, DEMO_MOBILE_PREFIX } from "./constants";
import { padIndex, pickOne, randomInt } from "./helpers";
import { listDemoSrUsers } from "./seed-users";
import type { DemoDealerRef, DemoTerritoryRef, DemoUserRef } from "./types";

const COMPANY_PREFIXES = [
  "Nazma",
  "Royal",
  "Prime",
  "Metro",
  "City",
  "Golden",
  "Star",
  "United",
  "Eastern",
  "Capital",
] as const;

const COMPANY_SUFFIXES = [
  "Hardware",
  "Sanitary",
  "Plumbing",
  "Trading",
  "Enterprise",
  "Mart",
  "Depot",
  "Centre",
  "Gallery",
  "House",
] as const;

export async function seedDemoDealers(
  prisma: PrismaClient,
  actorUserId: string,
  users: DemoUserRef[],
  territories: DemoTerritoryRef[],
): Promise<DemoDealerRef[]> {
  const existing = await prisma.dealer.count({
    where: { mobile: { startsWith: DEMO_MOBILE_PREFIX } },
  });

  if (existing >= DEMO_COUNTS.dealers) {
    const rows = await prisma.dealer.findMany({
      where: { mobile: { startsWith: DEMO_MOBILE_PREFIX } },
      select: {
        id: true,
        dealerCode: true,
        territoryId: true,
        ownershipHistory: {
          where: { isActive: true },
          select: { assignedSrId: true },
          take: 1,
        },
      },
      orderBy: { dealerCode: "asc" },
    });

    return rows.map((row) => ({
      id: row.id,
      dealerCode: row.dealerCode,
      territoryId: row.territoryId ?? territories[0]!.id,
      assignedSrId: row.ownershipHistory[0]?.assignedSrId ?? null,
    }));
  }

  const srUsers = listDemoSrUsers(users);
  const dealers: DemoDealerRef[] = [];

  for (let index = 0; index < DEMO_COUNTS.dealers; index += 1) {
    const territory = territories[index % territories.length]!;
    const sr = srUsers[index % srUsers.length]!;
    const companyName = `${pickOne(COMPANY_PREFIXES)} ${pickOne(COMPANY_SUFFIXES)} ${padIndex(index + 1)}`;
    const mobile = `${DEMO_MOBILE_PREFIX}${padIndex(index + 1)}`;
    const creditLimit = new Prisma.Decimal(randomInt(1_500_000, 3_000_000));

    const dealer = await prisma.$transaction(async (tx) => {
      const dealerCode = await generateNextDealerCode(tx);

      const created = await tx.dealer.create({
        data: {
          dealerCode,
          companyName,
          proprietorName: `Proprietor ${padIndex(index + 1)}`,
          mobile,
          email: `dealer${padIndex(index + 1)}@demo.nazma.test`,
          address: `${territory.name}, Bangladesh`,
          divisionId: territory.divisionId,
          districtId: territory.districtId,
          territoryId: territory.id,
          district: territory.name.split(" — ")[0] ?? territory.name,
          territory: territory.name,
          creditLimit,
          isActive: true,
        },
      });

      await assignDealerTerritory(
        {
          dealerId: created.id,
          territoryId: territory.id,
          assignedById: actorUserId,
          assignedSrId: sr.id,
          reason: "Demo seed initial assignment",
        },
        tx,
      );

      return created;
    });

    dealers.push({
      id: dealer.id,
      dealerCode: dealer.dealerCode,
      territoryId: territory.id,
      assignedSrId: sr.id,
    });
  }

  console.log(`  ✓ ${String(dealers.length)} dealers`);
  return dealers;
}
