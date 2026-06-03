import { PrismaClient } from "@prisma/client";

import { seedProductCategories } from "./seeds/product-categories";
import { seedProducts } from "./seeds/products";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await seedProductCategories(prisma);
  await seedProducts(prisma);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
