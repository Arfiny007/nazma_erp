import { Prisma, type PrismaClient } from "@prisma/client";

import { DEMO_COUNTS } from "./constants";
import { padIndex } from "./helpers";
import type { DemoProductRef } from "./types";

const DEMO_CATEGORY_SLUGS = [
  "toilet-push-flush-valve",
  "conceal-shower-mixer",
  "harmonic-shower-mixer",
  "cubic-shower-mixer",
  "sink-cock",
  "bib-cock",
  "shower-head",
  "accessories",
] as const;

const DEMO_UNITS = ["PCS", "SET", "PAIR"] as const;

export async function seedDemoProducts(
  prisma: PrismaClient,
): Promise<DemoProductRef[]> {
  const existingDemo = await prisma.product.findMany({
    where: { sku: { startsWith: "DEMO-" } },
    select: { id: true, sku: true, currentPrice: true, unit: true },
    orderBy: { sku: "asc" },
  });

  if (existingDemo.length >= DEMO_COUNTS.products) {
    return existingDemo;
  }

  const categories = await prisma.category.findMany({
    where: { slug: { in: [...DEMO_CATEGORY_SLUGS] } },
    select: { id: true, slug: true },
  });

  if (categories.length === 0) {
    throw new Error("Product categories missing — run `npm run seed` first");
  }

  const categoryBySlug = new Map(categories.map((row) => [row.slug, row.id]));
  const products: DemoProductRef[] = [...existingDemo];
  const startIndex = existingDemo.length + 1;

  for (let index = startIndex; index <= DEMO_COUNTS.products; index += 1) {
    const slug = DEMO_CATEGORY_SLUGS[(index - 1) % DEMO_CATEGORY_SLUGS.length]!;
    const categoryId = categoryBySlug.get(slug);
    if (!categoryId) {
      continue;
    }

    const sku = `DEMO-${padIndex(index, 3)}`;
    const price = new Prisma.Decimal(250 + (index % 20) * 75);

    const row = await prisma.product.upsert({
      where: { sku },
      update: {
        name: `Demo Product ${padIndex(index, 3)}`,
        currentPrice: price,
        isActive: true,
      },
      create: {
        sku,
        modelNumber: `DEMO-M-${padIndex(index, 3)}`,
        name: `Demo Product ${padIndex(index, 3)}`,
        categoryId,
        unit: DEMO_UNITS[index % DEMO_UNITS.length]!,
        currentPrice: price,
        isActive: true,
      },
      select: { id: true, sku: true, currentPrice: true, unit: true },
    });

    products.push(row);
  }

  const baseProducts = await prisma.product.findMany({
    where: { sku: { not: { startsWith: "DEMO-" } }, isActive: true },
    select: { id: true, sku: true, currentPrice: true, unit: true },
    take: 30,
  });

  const combined = [...baseProducts, ...products];
  console.log(`  ✓ ${String(combined.length)} products available (${String(products.length)} demo SKUs)`);

  return combined;
}
