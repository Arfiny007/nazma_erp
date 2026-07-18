/**
 * Runtime trace — territory assignment page ONLY (no dashboard/map).
 * RUNTIME_TRACE=1 npx tsx scripts/runtime-trace-territory-only.ts
 */
process.env.RUNTIME_TRACE = "1";

async function main(): Promise<void> {
  const { prisma } = await import("../src/lib/prisma");
  const { traceLog } = await import("../src/lib/debug/runtime-trace");

  traceLog("PAGE /settings/territory-assignments simulated load");

  const [userCount, users] = await prisma.$transaction([
    prisma.user.count({
      where: { isActive: true, role: { in: ["SR", "Manager"] } },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["SR", "Manager"] } },
      select: { id: true, name: true, email: true, role: true, isActive: true },
      take: 5,
    }),
  ]);

  const [territoryCount, territories] = await prisma.$transaction([
    prisma.territory.count({ where: { isActive: true } }),
    prisma.territory.findMany({
      where: { isActive: true },
      include: { district: { include: { division: { select: { name: true } } } } },
      take: 5,
    }),
  ]);

  if (users[0]) {
    await prisma.userTerritoryAssignment.findMany({
      where: { userId: users[0].id },
      include: {
        territory: {
          include: { district: { include: { division: { select: { name: true } } } } },
        },
      },
    });
  }

  console.log("DONE territory-only", { userCount, territoryCount, users: users.length, territories: territories.length });
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
