import type { PrismaClient } from "@prisma/client";

/**
 * Seed data for Nazma Metal product categories.
 *
 * Slugs are derived from the English name: lowercase, spaces replaced by
 * hyphens. The upsert is keyed on `slug` (unique) so re-running the seed is
 * fully idempotent — existing rows are updated in place, new rows are created.
 */

interface CategorySeed {
  name: string;
  slug: string;
}

const CATEGORIES: CategorySeed[] = [
  { name: "Toilet Push Flush Valve", slug: "toilet-push-flush-valve" },
  { name: "Conceal Shower Mixer",    slug: "conceal-shower-mixer" },
  { name: "Harmonic Shower Mixer",   slug: "harmonic-shower-mixer" },
  { name: "Cubic Shower Mixer",      slug: "cubic-shower-mixer" },
  { name: "Ovate Shower Mixer",      slug: "ovate-shower-mixer" },
  { name: "Ceiling Shower",          slug: "ceiling-shower" },
  { name: "Conceal Stop Cock",       slug: "conceal-stop-cock" },
  { name: "Sink Cock",               slug: "sink-cock" },
  { name: "Bib Cock",                slug: "bib-cock" },
  { name: "Angle Stop Cock",         slug: "angle-stop-cock" },
  { name: "Shower Head",             slug: "shower-head" },
  { name: "Accessories",             slug: "accessories" },
];

/**
 * Upserts all Nazma Metal product categories.
 *
 * Safe to call multiple times — each upsert matches on the unique `slug` and
 * updates `name` and `isActive` without touching auto-generated fields.
 */
export async function seedProductCategories(
  prisma: PrismaClient,
): Promise<void> {
  console.log(`Seeding ${CATEGORIES.length.toString()} product categories…`);

  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        isActive: true,
      },
      create: {
        name: category.name,
        slug: category.slug,
        isActive: true,
      },
    });

    console.log(`  ✓ ${category.name}`);
  }

  console.log("Product categories seeded.");
}
