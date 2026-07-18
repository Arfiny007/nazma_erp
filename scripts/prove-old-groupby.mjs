import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const rows = await prisma.userTerritoryAssignment.groupBy({
    by: ["territoryId"],
    where: { user: { role: "SR" } },
    _count: { id: true },
  });
  console.log("OLD groupBy OK", rows.length);
} catch (error) {
  const err = error;
  console.log(
    "OLD groupBy FAIL",
    err.code,
    err.meta?.code,
    String(err.message).slice(0, 200),
  );
} finally {
  await prisma.$disconnect();
}
