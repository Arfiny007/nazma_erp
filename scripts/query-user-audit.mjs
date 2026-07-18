import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const email = process.argv[2];
if (!email) {
  console.error("usage: node scripts/query-user-audit.mjs <email>");
  process.exit(1);
}
const user = await prisma.user.findUnique({
  where: { email },
  select: {
    id: true,
    lifecycleStatus: true,
    territoryAssignments: { where: { isActive: true }, select: { territoryId: true, isPrimary: true } },
  },
});
const audits = user
  ? await prisma.auditLog.findMany({
      where: { entityType: "User", entityId: user.id },
      orderBy: { createdAt: "asc" },
      select: { action: true, createdAt: true },
    })
  : [];
console.log(JSON.stringify({ user, audits }, null, 2));
await prisma.$disconnect();
