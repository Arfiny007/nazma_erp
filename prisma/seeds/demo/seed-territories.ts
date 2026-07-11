import type { PrismaClient } from "@prisma/client";

import { TARGET_DISTRICT_CODES } from "./constants";
import { listDemoSrUsers } from "./seed-users";
import type { DemoTerritoryRef, DemoUserRef } from "./types";

/**
 * Loads territories for the five demo districts and assigns SR users.
 */
export async function seedDemoTerritories(
  prisma: PrismaClient,
  users: DemoUserRef[],
): Promise<DemoTerritoryRef[]> {
  const territories: DemoTerritoryRef[] = [];

  for (const districtCode of TARGET_DISTRICT_CODES) {
    const territory = await prisma.territory.findFirst({
      where: {
        code: `${districtCode}-main`,
        isActive: true,
      },
      include: {
        district: { select: { id: true, code: true, divisionId: true } },
      },
    });

    if (!territory) {
      throw new Error(
        `Territory for district "${districtCode}" not found — run \`npm run seed\` first`,
      );
    }

    territories.push({
      id: territory.id,
      code: territory.code,
      name: territory.name,
      districtCode: territory.district.code,
      divisionId: territory.district.divisionId,
      districtId: territory.district.id,
    });

    console.log(`  ✓ ${territory.name}`);
  }

  const srUsers = listDemoSrUsers(users);
  for (let index = 0; index < srUsers.length; index += 1) {
    const sr = srUsers[index]!;
    const territory = territories[index % territories.length]!;

    await prisma.userTerritoryAssignment.upsert({
      where: {
        userId_territoryId: { userId: sr.id, territoryId: territory.id },
      },
      update: {
        isActive: true,
        isPrimary: true,
        revokedAt: null,
      },
      create: {
        userId: sr.id,
        territoryId: territory.id,
        isPrimary: true,
        isActive: true,
      },
    });
  }

  console.log(`  ${String(territories.length)} territories, ${String(srUsers.length)} SR assignments`);

  return territories;
}
