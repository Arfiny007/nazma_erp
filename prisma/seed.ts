import { PrismaClient } from "@prisma/client";

import { seedAdminUser } from "./seeds/admin-user";
import { seedProductCategories } from "./seeds/product-categories";
import { seedProducts } from "./seeds/products";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("Seeding database…");

  console.log("\n[Users]");
  await seedAdminUser(prisma);

  console.log("\n[Product Categories]");
  await seedProductCategories(prisma);

  console.log("\n[Products]");
  await seedProducts(prisma);

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
