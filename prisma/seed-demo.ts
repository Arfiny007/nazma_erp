import { PrismaClient } from "@prisma/client";

import { resetDemoData } from "./seeds/demo/reset-demo-data";
import { seedDemo } from "./seeds/demo/seed-demo";

const prisma = new PrismaClient();
const shouldReset = process.argv.includes("--reset");

async function main(): Promise<void> {
  if (shouldReset) {
    console.log("Resetting demo data…\n");
    await resetDemoData(prisma);
  }

  await seedDemo(prisma);
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
