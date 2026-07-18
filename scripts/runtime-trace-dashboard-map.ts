/**
 * Runtime trace — dashboard map path (getTerritoryMap / batchSrCounts).
 * RUNTIME_TRACE=1 npx tsx scripts/runtime-trace-dashboard-map.ts
 */
process.env.RUNTIME_TRACE = "1";

async function main(): Promise<void> {
  const { prisma } = await import("../src/lib/prisma");
  const { runTraced, traceLog } = await import("../src/lib/debug/runtime-trace");
  const { getAdminTerritoryMap } = await import("../src/lib/dashboard/maps/map-service");

  await runTraced("ACTION getTerritoryMap (simulated)", async () => {
    traceLog("ACTION getTerritoryMap");
    const admin = await prisma.user.findFirst({
      where: { email: "admin@nazma.local", isActive: true },
      select: { id: true },
    });

    if (!admin) {
      console.log("No admin user — seed required");
      return;
    }

    await getAdminTerritoryMap(admin.id);
    console.log("DONE dashboard map trace");
  });

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
