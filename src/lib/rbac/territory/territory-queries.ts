import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { TerritoryAssignmentRecord } from "./territory-types";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function fetchActiveTerritoryIdsForUser(
  userId: string,
  db: DbClient = prisma,
): Promise<string[]> {
  const rows = await db.userTerritoryAssignment.findMany({
    where: { userId, isActive: true },
    select: { territoryId: true },
    orderBy: [{ isPrimary: "desc" }, { assignedAt: "asc" }],
  });

  return rows.map((row: { territoryId: string }) => row.territoryId);
}

export async function fetchDealerTerritoryId(
  dealerId: string,
  db: DbClient = prisma,
): Promise<string | null> {
  const dealer = await db.dealer.findUnique({
    where: { id: dealerId },
    select: { territoryId: true },
  });
  return dealer?.territoryId ?? null;
}

export async function fetchDealerTerritoryIdByCode(
  dealerCode: string,
  db: DbClient = prisma,
): Promise<string | null> {
  const dealer = await db.dealer.findUnique({
    where: { dealerCode },
    select: { territoryId: true },
  });
  return dealer?.territoryId ?? null;
}

export async function fetchOrderDealerTerritoryId(
  orderId: string,
  db: DbClient = prisma,
): Promise<string | null> {
  const order = await db.salesOrder.findUnique({
    where: { id: orderId },
    select: { dealer: { select: { territoryId: true } } },
  });
  return order?.dealer.territoryId ?? null;
}

export async function fetchCollectionDealerTerritoryId(
  collectionId: string,
  db: DbClient = prisma,
): Promise<string | null> {
  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    select: { dealer: { select: { territoryId: true } } },
  });
  return collection?.dealer.territoryId ?? null;
}

export async function listTerritoryAssignmentsForUser(
  userId: string,
  db: DbClient = prisma,
): Promise<TerritoryAssignmentRecord[]> {
  const rows = await db.userTerritoryAssignment.findMany({
    where: { userId },
    include: {
      territory: {
        include: {
          district: {
            include: {
              division: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { isPrimary: "desc" }, { assignedAt: "desc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    territoryId: row.territoryId,
    territoryCode: row.territory.code,
    territoryName: row.territory.name,
    territoryNameBn: row.territory.nameBn,
    districtName: row.territory.district.name,
    divisionName: row.territory.district.division.name,
    isPrimary: row.isPrimary,
    isActive: row.isActive,
    assignedAt: row.assignedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }));
}
