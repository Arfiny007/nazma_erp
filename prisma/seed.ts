import { PrismaClient } from "@prisma/client";

import { seedProductCategories } from "./seeds/product-categories";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await seedProductCategories(prisma);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
