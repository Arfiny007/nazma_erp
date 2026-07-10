import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  ActiveOwnershipConflictError,
  DealerNotFoundError,
  OwnershipConflictError,
  TerritoryNotFoundError,
} from "./ownership-errors";
import {
  fetchCurrentOwnership,
  fetchOwnershipHistory,
  mapOwnershipRow,
  resolveTerritoryGeography,
} from "./ownership-query";
import type {
  AssignDealerTerritoryInput,
  BackfillDealerOwnershipDetail,
  BackfillDealerOwnershipReport,
  DealerOwnershipRecord,
  TransferDealerInput,
} from "./ownership-types";

type DbClient = PrismaClient | Prisma.TransactionClient;

const ownershipInclude = {
  territory: {
    include: {
      district: { include: { division: { select: { name: true } } } },
    },
  },
  assignedSr: { select: { name: true } },
  assignedBy: { select: { name: true } },
} as const;

async function syncDealerGeographyFromTerritory(
  tx: DbClient,
  dealerId: string,
  territoryId: string,
): Promise<void> {
  const territory = await resolveTerritoryGeography(territoryId);
  if (!territory) {
    throw new TerritoryNotFoundError();
  }

  await tx.dealer.update({
    where: { id: dealerId },
    data: {
      divisionId: territory.district.divisionId,
      districtId: territory.districtId,
      territoryId: territory.id,
      district: territory.district.name,
      territory: territory.name,
    },
  });
}

async function closeActiveOwnership(
  tx: DbClient,
  dealerId: string,
  effectiveTo: Date,
): Promise<void> {
  await tx.dealerOwnershipHistory.updateMany({
    where: { dealerId, isActive: true },
    data: { isActive: false, effectiveTo },
  });
}

/**
 * Creates the first ownership record for a dealer and syncs geography FKs.
 * Fails if an active ownership already exists.
 */
export async function assignDealerTerritory(
  input: AssignDealerTerritoryInput,
  db: DbClient = prisma,
): Promise<DealerOwnershipRecord> {
  const run = async (tx: DbClient): Promise<DealerOwnershipRecord> => {
    const dealer = await tx.dealer.findUnique({
      where: { id: input.dealerId },
      select: { id: true },
    });
    if (!dealer) {
      throw new DealerNotFoundError();
    }

    const existing = await tx.dealerOwnershipHistory.findFirst({
      where: { dealerId: input.dealerId, isActive: true },
      select: { id: true },
    });
    if (existing) {
      throw new ActiveOwnershipConflictError();
    }

    const territory = await resolveTerritoryGeography(input.territoryId);
    if (!territory?.isActive) {
      throw new TerritoryNotFoundError();
    }

    const now = new Date();

    const row = await tx.dealerOwnershipHistory.create({
      data: {
        dealerId: input.dealerId,
        territoryId: input.territoryId,
        assignedSrId: input.assignedSrId ?? null,
        assignedById: input.assignedById,
        reason: input.reason ?? null,
        effectiveFrom: now,
        isActive: true,
      },
      include: ownershipInclude,
    });

    await syncDealerGeographyFromTerritory(tx, input.dealerId, input.territoryId);

    return mapOwnershipRow(row);
  };

  if ("$transaction" in db) {
    return db.$transaction((tx) => run(tx));
  }
  return run(db);
}

/**
 * Closes the active ownership and opens a new record — auditable transfer.
 */
export async function transferDealer(
  input: TransferDealerInput,
  db: DbClient = prisma,
): Promise<DealerOwnershipRecord> {
  const run = async (tx: DbClient): Promise<DealerOwnershipRecord> => {
    const dealer = await tx.dealer.findUnique({
      where: { id: input.dealerId },
      select: { id: true, territoryId: true },
    });
    if (!dealer) {
      throw new DealerNotFoundError();
    }

    const territory = await resolveTerritoryGeography(input.territoryId);
    if (!territory?.isActive) {
      throw new TerritoryNotFoundError();
    }

    if (dealer.territoryId === input.territoryId) {
      const current = await tx.dealerOwnershipHistory.findFirst({
        where: { dealerId: input.dealerId, isActive: true },
        include: ownershipInclude,
      });
      if (current) {
        if (input.assignedSrId !== undefined) {
          const updated = await tx.dealerOwnershipHistory.update({
            where: { id: current.id },
            data: { assignedSrId: input.assignedSrId },
            include: ownershipInclude,
          });
          return mapOwnershipRow(updated);
        }
        return mapOwnershipRow(current);
      }
      throw new OwnershipConflictError();
    }

    const now = new Date();
    await closeActiveOwnership(tx, input.dealerId, now);

    const row = await tx.dealerOwnershipHistory.create({
      data: {
        dealerId: input.dealerId,
        territoryId: input.territoryId,
        assignedSrId: input.assignedSrId ?? null,
        assignedById: input.assignedById,
        reason: input.reason ?? null,
        effectiveFrom: now,
        isActive: true,
      },
      include: ownershipInclude,
    });

    await syncDealerGeographyFromTerritory(tx, input.dealerId, input.territoryId);

    return mapOwnershipRow(row);
  };

  if ("$transaction" in db) {
    return db.$transaction((tx) => run(tx));
  }
  return run(db);
}

export async function getDealerOwnershipHistory(
  dealerId: string,
): Promise<DealerOwnershipRecord[]> {
  return fetchOwnershipHistory(dealerId);
}

export async function getCurrentDealerOwner(
  dealerId: string,
): Promise<DealerOwnershipRecord | null> {
  return fetchCurrentOwnership(dealerId);
}

function normalizeMatchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Migrates legacy dealers with free-text district/territory to structured FKs
 * and creates the first ownership record. Never overwrites existing territoryId.
 */
export async function backfillDealerOwnership(
  assignedById: string,
): Promise<BackfillDealerOwnershipReport> {
  const dealers = await prisma.dealer.findMany({
    where: {
      OR: [
        { territoryId: null },
        {
          ownershipHistory: { none: { isActive: true } },
        },
      ],
    },
    select: {
      id: true,
      dealerCode: true,
      district: true,
      territory: true,
      territoryId: true,
    },
  });

  const districts = await prisma.district.findMany({
    select: { id: true, name: true, code: true, divisionId: true },
  });
  const territories = await prisma.territory.findMany({
    select: { id: true, name: true, code: true, districtId: true },
  });

  const report: BackfillDealerOwnershipReport = {
    migrated: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  for (const dealer of dealers) {
    if (dealer.territoryId) {
      try {
        await assignDealerTerritory({
          dealerId: dealer.id,
          territoryId: dealer.territoryId,
          assignedById,
          reason: "Backfill — existing territoryId",
        });
        report.migrated += 1;
        report.details.push({
          dealerId: dealer.id,
          dealerCode: dealer.dealerCode,
          status: "migrated",
          messageKey: "dealer.ownership.backfill.existingTerritoryId",
          territoryId: dealer.territoryId,
        });
      } catch {
        report.failed += 1;
        report.details.push({
          dealerId: dealer.id,
          dealerCode: dealer.dealerCode,
          status: "failed",
          messageKey: "dealer.ownership.backfill.assignFailed",
        });
      }
      continue;
    }

    const districtNorm = normalizeMatchText(dealer.district);
    const territoryNorm = normalizeMatchText(dealer.territory);

    const matchedDistrict = districts.find(
      (d) =>
        normalizeMatchText(d.name) === districtNorm ||
        normalizeMatchText(d.code) === districtNorm,
    );

    if (!matchedDistrict) {
      report.skipped += 1;
      report.details.push({
        dealerId: dealer.id,
        dealerCode: dealer.dealerCode,
        status: "skipped",
        messageKey: "dealer.ownership.backfill.districtNotMatched",
      });
      continue;
    }

    const matchedTerritory =
      territories.find(
        (t) =>
          t.districtId === matchedDistrict.id &&
          (normalizeMatchText(t.name) === territoryNorm ||
            normalizeMatchText(t.code) === territoryNorm ||
            normalizeMatchText(t.name).includes(territoryNorm) ||
            territoryNorm.includes(normalizeMatchText(t.name))),
      ) ??
      territories.find(
        (t) => t.code === `${matchedDistrict.code}-main`,
      );

    if (!matchedTerritory) {
      report.skipped += 1;
      report.details.push({
        dealerId: dealer.id,
        dealerCode: dealer.dealerCode,
        status: "skipped",
        messageKey: "dealer.ownership.backfill.territoryNotMatched",
      });
      continue;
    }

    try {
      await assignDealerTerritory({
        dealerId: dealer.id,
        territoryId: matchedTerritory.id,
        assignedById,
        reason: "Backfill — legacy district/territory text match",
      });
      report.migrated += 1;
      report.details.push({
        dealerId: dealer.id,
        dealerCode: dealer.dealerCode,
        status: "migrated",
        messageKey: "dealer.ownership.backfill.migrated",
        territoryId: matchedTerritory.id,
      });
    } catch {
      report.failed += 1;
      report.details.push({
        dealerId: dealer.id,
        dealerCode: dealer.dealerCode,
        status: "failed",
        messageKey: "dealer.ownership.backfill.assignFailed",
      });
    }
  }

  return report;
}
