import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const rows = await prisma.notificationTemplate.findMany({
  select: { key: true, locale: true, channel: true, isActive: true },
});
console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();
