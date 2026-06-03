import type { PrismaClient } from "@prisma/client";

interface ProductSeed {
  sku: string;
  modelNumber: string;
  name: string;
  nameBn: string;
  categorySlug: string;
  currentPrice: string;
  unit: string;
  isActive: boolean;
}

const PRODUCTS: ProductSeed[] = [
  // ── Toilet Push Flush Valve ─────────────────────────────────────────────────
  {
    sku: "FV222",
    modelNumber: "FV-222",
    name: "Nazma Push Flush Valve 222",
    nameBn: "নাজমা পুশ ফ্লাশ ভালভ ২২২",
    categorySlug: "toilet-push-flush-valve",
    currentPrice: "480.00",
    unit: "PCS",
    isActive: true,
  },
  {
    sku: "FV223C",
    modelNumber: "FV-223-C",
    name: "Nazma Push Flush Valve 223-C Chrome",
    nameBn: "নাজমা পুশ ফ্লাশ ভালভ ২২৩-সি ক্রোম",
    categorySlug: "toilet-push-flush-valve",
    currentPrice: "550.00",
    unit: "PCS",
    isActive: true,
  },
  {
    sku: "FV224",
    modelNumber: "FV-224",
    name: "Nazma Push Flush Valve 224",
    nameBn: "নাজমা পুশ ফ্লাশ ভালভ ২২৪",
    categorySlug: "toilet-push-flush-valve",
    currentPrice: "520.00",
    unit: "PCS",
    isActive: true,
  },
  {
    sku: "FV225",
    modelNumber: "FV-225",
    name: "Nazma Push Flush Valve 225 Slim",
    nameBn: "নাজমা পুশ ফ্লাশ ভালভ ২২৫ স্লিম",
    categorySlug: "toilet-push-flush-valve",
    currentPrice: "495.00",
    unit: "PCS",
    isActive: true,
  },
  {
    sku: "FV226B",
    modelNumber: "FV-226-B",
    name: "Nazma Push Flush Valve 226-B Brushed",
    nameBn: "নাজমা পুশ ফ্লাশ ভালভ ২২৬-বি ব্রাশড",
    categorySlug: "toilet-push-flush-valve",
    currentPrice: "610.00",
    unit: "PCS",
    isActive: true,
  },

  // ── Ovate Shower Mixer ───────────────────────────────────────────────────────
  {
    sku: "OVP6507",
    modelNumber: "OVP6-507",
    name: "Nazma Ovate Shower Mixer 507",
    nameBn: "নাজমা ওভেট শাওয়ার মিক্সার ৫০৭",
    categorySlug: "ovate-shower-mixer",
    currentPrice: "2200.00",
    unit: "PCS",
    isActive: true,
  },
  {
    sku: "OVP6508",
    modelNumber: "OVP6-508",
    name: "Nazma Ovate Shower Mixer 508",
    nameBn: "নাজমা ওভেট শাওয়ার মিক্সার ৫০৮",
    categorySlug: "ovate-shower-mixer",
    currentPrice: "2450.00",
    unit: "PCS",
    isActive: true,
  },
  {
    sku: "OVP6509H",
    modelNumber: "OVP6-509-H",
    name: "Nazma Ovate Shower Mixer 509-H Hot",
    nameBn: "নাজমা ওভেট শাওয়ার মিক্সার ৫০৯-এইচ",
    categorySlug: "ovate-shower-mixer",
    currentPrice: "2800.00",
    unit: "PCS",
    isActive: true,
  },

  // ── Shower Head ──────────────────────────────────────────────────────────────
  {
    sku: "SWT201",
    modelNumber: "SWT-201",
    name: "Nazma Shower Head 201",
    nameBn: "নাজমা শাওয়ার হেড ২০১",
    categorySlug: "shower-head",
    currentPrice: "850.00",
    unit: "PCS",
    isActive: true,
  },
  {
    sku: "SWT202",
    modelNumber: "SWT-202",
    name: "Nazma Shower Head 202",
    nameBn: "নাজমা শাওয়ার হেড ২০২",
    categorySlug: "shower-head",
    currentPrice: "950.00",
    unit: "PCS",
    isActive: true,
  },
  {
    sku: "SWT203R",
    modelNumber: "SWT-203-R",
    name: "Nazma Shower Head 203-R Rain",
    nameBn: "নাজমা শাওয়ার হেড ২০৩-আর রেইন",
    categorySlug: "shower-head",
    currentPrice: "1250.00",
    unit: "PCS",
    isActive: true,
  },

  // ── Conceal Shower Mixer ─────────────────────────────────────────────────────
  {
    sku: "CSM301",
    modelNumber: "CSM-301",
    name: "Nazma Conceal Shower Mixer 301",
    nameBn: "নাজমা কনসিল শাওয়ার মিক্সার ৩০১",
    categorySlug: "conceal-shower-mixer",
    currentPrice: "3200.00",
    unit: "PCS",
    isActive: true,
  },
  {
    sku: "CSM302P",
    modelNumber: "CSM-302-P",
    name: "Nazma Conceal Shower Mixer 302-P Plus",
    nameBn: "নাজমা কনসিল শাওয়ার মিক্সার ৩০২-পি প্লাস",
    categorySlug: "conceal-shower-mixer",
    currentPrice: "3750.00",
    unit: "PCS",
    isActive: true,
  },

  // ── Sink Cock ────────────────────────────────────────────────────────────────
  {
    sku: "SC101",
    modelNumber: "SC-101",
    name: "Nazma Sink Cock 101",
    nameBn: "নাজমা সিঙ্ক ককক ১০১",
    categorySlug: "sink-cock",
    currentPrice: "650.00",
    unit: "PCS",
    isActive: true,
  },
  {
    sku: "SC102L",
    modelNumber: "SC-102-L",
    name: "Nazma Sink Cock 102-L Long Neck",
    nameBn: "নাজমা সিঙ্ক কক ১০২-এল লং নেক",
    categorySlug: "sink-cock",
    currentPrice: "780.00",
    unit: "PCS",
    isActive: true,
  },

  // ── Bib Cock ─────────────────────────────────────────────────────────────────
  {
    sku: "BC401",
    modelNumber: "BC-401",
    name: "Nazma Bib Cock 401",
    nameBn: "নাজমা বিব কক ৪০১",
    categorySlug: "bib-cock",
    currentPrice: "480.00",
    unit: "PCS",
    isActive: true,
  },
  {
    sku: "BC402",
    modelNumber: "BC-402",
    name: "Nazma Bib Cock 402",
    nameBn: "নাজমা বিব কক ৪০২",
    categorySlug: "bib-cock",
    currentPrice: "520.00",
    unit: "PCS",
    isActive: true,
  },

  // ── Angle Stop Cock ──────────────────────────────────────────────────────────
  {
    sku: "ASC601",
    modelNumber: "ASC-601",
    name: "Nazma Angle Stop Cock 601",
    nameBn: "নাজমা অ্যাঙ্গেল স্টপ কক ৬০১",
    categorySlug: "angle-stop-cock",
    currentPrice: "380.00",
    unit: "PCS",
    isActive: true,
  },
  {
    sku: "ASC602",
    modelNumber: "ASC-602",
    name: "Nazma Angle Stop Cock 602",
    nameBn: "নাজমা অ্যাঙ্গেল স্টপ কক ৬০২",
    categorySlug: "angle-stop-cock",
    currentPrice: "420.00",
    unit: "PCS",
    isActive: true,
  },

  // ── Ceiling Shower ───────────────────────────────────────────────────────────
  {
    sku: "CS701",
    modelNumber: "CS-701",
    name: "Nazma Ceiling Shower 701",
    nameBn: "নাজমা সিলিং শাওয়ার ৭০১",
    categorySlug: "ceiling-shower",
    currentPrice: "3400.00",
    unit: "PCS",
    isActive: true,
  },
];

/**
 * Upserts 20 Nazma Metal products across existing categories.
 *
 * Must be run after `seedProductCategories` so that category rows exist.
 * The upsert is keyed on `sku` (unique constraint), so re-running is fully
 * idempotent — existing rows are updated in place, no duplicates.
 */
export async function seedProducts(prisma: PrismaClient): Promise<void> {
  console.log(`Seeding ${PRODUCTS.length.toString()} products…`);

  // Pre-fetch all category slugs → ids in one query
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true },
  });

  const categoryMap = new Map<string, string>(
    categories.map((c) => [c.slug, c.id]),
  );

  for (const product of PRODUCTS) {
    const categoryId = categoryMap.get(product.categorySlug);

    if (!categoryId) {
      throw new Error(
        `Category slug "${product.categorySlug}" not found. Run seedProductCategories first.`,
      );
    }

    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        modelNumber: product.modelNumber,
        name: product.name,
        nameBn: product.nameBn,
        categoryId,
        currentPrice: product.currentPrice,
        unit: product.unit,
        isActive: product.isActive,
      },
      create: {
        sku: product.sku,
        modelNumber: product.modelNumber,
        name: product.name,
        nameBn: product.nameBn,
        categoryId,
        currentPrice: product.currentPrice,
        unit: product.unit,
        isActive: product.isActive,
      },
    });

    console.log(`  ✓ ${product.modelNumber}  ${product.name}`);
  }

  console.log("Products seeded.");
}
