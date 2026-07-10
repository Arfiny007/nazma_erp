import type { PrismaClient } from "@prisma/client";

import {
  buildDefaultTerritorySeeds,
  type TerritorySeedTemplate,
} from "../../src/lib/geography/territory-seeds";

/**
 * Upserts default territories for every district.
 *
 * Requires districts to be seeded first. Idempotent on `code`.
 */
export async function seedTerritories(
  prisma: PrismaClient,
  districtIdByCode: Map<string, string>,
  templates: TerritorySeedTemplate[] = buildDefaultTerritorySeeds(),
): Promise<void> {
  const { DISTRICTS } = await import("../../src/lib/geography/bangladesh-geography-data");

  console.log(`Seeding ${templates.length.toString()} default territories…`);

  for (const template of templates) {
    const districtId = districtIdByCode.get(template.districtCode);
    if (!districtId) {
      throw new Error(
        `Missing district "${template.districtCode}" for territory seed`,
      );
    }

    const district = DISTRICTS.find((d) => d.code === template.districtCode);
    if (!district) {
      throw new Error(`Unknown district code "${template.districtCode}"`);
    }

    const code = template.code ?? `${template.districtCode}-main`;
    const name = template.name ?? `${district.name} — Main`;
    const nameBn = template.nameBn ?? `${district.nameBn} — মূল`;
    const sortOrder = template.sortOrder ?? 1;

    await prisma.territory.upsert({
      where: { code },
      update: {
        name,
        nameBn,
        districtId,
        sortOrder,
        isActive: true,
      },
      create: {
        code,
        name,
        nameBn,
        districtId,
        sortOrder,
        isActive: true,
      },
    });
  }

  console.log("Territories seeded.");
}
