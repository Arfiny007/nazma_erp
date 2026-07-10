import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildTerritoryScope, territoryIdMatchesScope } from "@/lib/rbac/territory";

import { TerritoryNotAssignableError } from "./ownership-errors";
import type { DealerOwnershipRecord } from "./ownership-types";

type OwnershipRow = Prisma.DealerOwnershipHistoryGetPayload<{
  include: {
    territory: {
      include: {
        district: { include: { division: { select: { name: true } } } };
      };
    };
    assignedSr: { select: { name: true } };
    assignedBy: { select: { name: true } };
  };
}>;

export function mapOwnershipRow(row: OwnershipRow): DealerOwnershipRecord {
  return {
    id: row.id,
    dealerId: row.dealerId,
    territoryId: row.territoryId,
    territoryCode: row.territory.code,
    territoryName: row.territory.name,
    territoryNameBn: row.territory.nameBn,
    districtName: row.territory.district.name,
    divisionName: row.territory.district.division.name,
    assignedSrId: row.assignedSrId,
    assignedSrName: row.assignedSr?.name ?? null,
    assignedById: row.assignedById,
    assignedByName: row.assignedBy.name,
    reason: row.reason,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

const ownershipInclude = {
  territory: {
    include: {
      district: { include: { division: { select: { name: true } } } },
    },
  },
  assignedSr: { select: { name: true } },
  assignedBy: { select: { name: true } },
} as const;

export async function fetchOwnershipHistory(
  dealerId: string,
): Promise<DealerOwnershipRecord[]> {
  const rows = await prisma.dealerOwnershipHistory.findMany({
    where: { dealerId },
    include: ownershipInclude,
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });

  return rows.map(mapOwnershipRow);
}

export async function fetchCurrentOwnership(
  dealerId: string,
): Promise<DealerOwnershipRecord | null> {
  const row = await prisma.dealerOwnershipHistory.findFirst({
    where: { dealerId, isActive: true },
    include: ownershipInclude,
    orderBy: { effectiveFrom: "desc" },
  });

  return row ? mapOwnershipRow(row) : null;
}

export async function assertUserCanAssignTerritory(
  userId: string,
  territoryId: string,
): Promise<void> {
  const scope = await buildTerritoryScope(userId);
  if (!territoryIdMatchesScope(scope, territoryId)) {
    throw new TerritoryNotAssignableError();
  }
}

export async function resolveTerritoryGeography(territoryId: string) {
  const territory = await prisma.territory.findUnique({
    where: { id: territoryId },
    include: {
      district: { include: { division: true } },
    },
  });

  return territory;
}
