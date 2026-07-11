import type { PrismaClient } from "@prisma/client";

import { DISTRICTS, DIVISIONS } from "./data/bangladesh-geography-data";

/**
 * Upserts all 8 Bangladesh divisions and 64 districts.
 *
 * Idempotent — keyed on unique `code` fields. Safe to re-run after deploys.
 */
export async function seedBangladeshGeography(
  prisma: PrismaClient,
): Promise<Map<string, string>> {
  console.log(`Seeding ${DIVISIONS.length.toString()} divisions…`);

  const divisionIdByCode = new Map<string, string>();

  for (const division of DIVISIONS) {
    const row = await prisma.division.upsert({
      where: { code: division.code },
      update: {
        name: division.name,
        nameBn: division.nameBn,
        sortOrder: division.sortOrder,
        isActive: true,
      },
      create: {
        code: division.code,
        name: division.name,
        nameBn: division.nameBn,
        sortOrder: division.sortOrder,
        isActive: true,
      },
    });

    divisionIdByCode.set(division.code, row.id);
    console.log(`  ✓ ${division.name}`);
  }

  console.log(`Seeding ${DISTRICTS.length.toString()} districts…`);

  const districtIdByCode = new Map<string, string>();

  for (const district of DISTRICTS) {
    const divisionId = divisionIdByCode.get(district.divisionCode);
    if (!divisionId) {
      throw new Error(
        `Missing division "${district.divisionCode}" for district "${district.code}"`,
      );
    }

    const row = await prisma.district.upsert({
      where: { code: district.code },
      update: {
        name: district.name,
        nameBn: district.nameBn,
        divisionId,
        sortOrder: district.sortOrder,
        isActive: true,
      },
      create: {
        code: district.code,
        name: district.name,
        nameBn: district.nameBn,
        divisionId,
        sortOrder: district.sortOrder,
        isActive: true,
      },
    });

    districtIdByCode.set(district.code, row.id);
  }

  console.log("Bangladesh geography seeded.");
  return districtIdByCode;
}
