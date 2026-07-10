import { PrismaClient } from "@prisma/client";

import { seedAdminUser } from "./seeds/admin-user";
import { seedBangladeshGeography } from "./seeds/bangladesh-geography";
import { seedProductCategories } from "./seeds/product-categories";
import { seedProducts } from "./seeds/products";
import { seedTerritories } from "./seeds/territories";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("Seeding database…");

  console.log("\n[Users]");
  await seedAdminUser(prisma);

  console.log("\n[Product Categories]");
  await seedProductCategories(prisma);

  console.log("\n[Products]");
  await seedProducts(prisma);

  console.log("\n[Geography]");
  const districtIdByCode = await seedBangladeshGeography(prisma);

  console.log("\n[Territories]");
  await seedTerritories(prisma, districtIdByCode);

  console.log("\nDone.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
