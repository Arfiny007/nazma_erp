import { Prisma, UserLifecycleStatus, UserRole } from "@prisma/client";

import type { TerritoryScope } from "@/lib/rbac/territory";
import { mergeDealerTerritoryScope } from "@/lib/rbac/territory";

import { ZERO, normalizeAggregate } from "./sr-performance-calculations";
import type {
  DealerLedgerAggregate,
  ScopedDealerRow,
  ScopedSrRow,
  SrAttributionDiagnostics,
} from "./sr-performance-types";

/**
 * Read-only Prisma / SQL queries for SR Performance — PHASE_12A.1 / ADR-060.
 *
 * Bounded query blocks only. No Prisma calls inside SR/dealer loops.
 * Avoids relation-filtered `groupBy` + `_count.id` (ADR-059).
 */

export type SrPerformanceReadClient = Pick<
  Prisma.TransactionClient,
  "user" | "userTerritoryAssignment" | "dealer" | "territory" | "ledgerEntry"
> & {
  $queryRaw: Prisma.TransactionClient["$queryRaw"];
};

export function emptyAttributionDiagnostics(): SrAttributionDiagnostics {
  return {
    duplicateDealerAttributionCount: 0,
    missingOwnershipCount: 0,
    ambiguousOwnershipCount: 0,
    affectedDealerCodes: [],
  };
}

/**
 * Build attribution integrity diagnostics from dealer ownership rows.
 * Multiple SRs assigned to one territory is NOT an attribution defect.
 */
export function buildAttributionDiagnostics(
  dealers: ReadonlyArray<{
    dealerCode: string;
    activeOwnershipCount: number;
    distinctAssignedSrCount: number;
    assignedSrId: string | null;
  }>,
): SrAttributionDiagnostics {
  let duplicateDealerAttributionCount = 0;
  let missingOwnershipCount = 0;
  let ambiguousOwnershipCount = 0;
  const affected: string[] = [];

  for (const dealer of dealers) {
    let flagged = false;
    if (dealer.activeOwnershipCount === 0 || !dealer.assignedSrId) {
      missingOwnershipCount += 1;
      flagged = true;
    }
    if (dealer.activeOwnershipCount > 1) {
      ambiguousOwnershipCount += 1;
      flagged = true;
    }
    if (dealer.distinctAssignedSrCount > 1) {
      duplicateDealerAttributionCount += 1;
      flagged = true;
    }
    if (flagged) {
      affected.push(dealer.dealerCode);
    }
  }

  return {
    duplicateDealerAttributionCount,
    missingOwnershipCount,
    ambiguousOwnershipCount,
    affectedDealerCodes: [...new Set(affected)].sort(),
  };
}

const ACTIVE_LIFECYCLE: UserLifecycleStatus = UserLifecycleStatus.ACTIVE;

export async function findScopedActiveSalesRepresentatives(
  client: SrPerformanceReadClient,
  scope: TerritoryScope,
  options?: { srSearch?: string; territoryId?: string | null },
): Promise<ScopedSrRow[]> {
  const scopedIds =
    scope.mode === "TERRITORIES" ? scope.territoryIds : ([] as const);

  const territoryFilter =
    scope.mode === "ALL"
      ? options?.territoryId
        ? { territoryId: options.territoryId, isActive: true }
        : { isActive: true }
      : {
          territoryId: {
            in: options?.territoryId
              ? scopedIds.includes(options.territoryId)
                ? [options.territoryId]
                : []
              : [...scopedIds],
          },
          isActive: true,
        };

  const users = await client.user.findMany({
    where: {
      role: UserRole.SR,
      isActive: true,
      lifecycleStatus: ACTIVE_LIFECYCLE,
      ...(options?.srSearch
        ? {
            name: {
              contains: options.srSearch,
              mode: "insensitive",
            },
          }
        : {}),
      territoryAssignments: {
        some: territoryFilter,
      },
    },
    select: {
      id: true,
      name: true,
      territoryAssignments: {
        where: territoryFilter,
        select: {
          territoryId: true,
          territory: { select: { name: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return users.map((user) => {
    const territoryIds = user.territoryAssignments.map((a) => a.territoryId);
    const territoryNames = user.territoryAssignments.map(
      (a) => a.territory.name,
    );
    return {
      srId: user.id,
      srName: user.name,
      territoryIds,
      territoryNames,
    };
  });
}

export async function findOverlappingTerritoryAssignments(
  client: SrPerformanceReadClient,
  scope: TerritoryScope,
  territoryId?: string | null,
): Promise<string[]> {
  const scopedTerritoryIds =
    scope.mode === "TERRITORIES"
      ? optionsTerritoryIds(scope, territoryId)
      : scope.mode === "ALL"
        ? undefined
        : [];

  const assignments = await client.userTerritoryAssignment.findMany({
    where: {
      isActive: true,
      user: {
        role: UserRole.SR,
        isActive: true,
        lifecycleStatus: ACTIVE_LIFECYCLE,
      },
      ...(scopedTerritoryIds
        ? { territoryId: { in: [...scopedTerritoryIds] } }
        : territoryId
          ? { territoryId }
          : {}),
    },
    select: { territoryId: true, userId: true },
  });

  const counts = new Map<string, Set<string>>();
  for (const row of assignments) {
    const set = counts.get(row.territoryId) ?? new Set<string>();
    set.add(row.userId);
    counts.set(row.territoryId, set);
  }

  return [...counts.entries()]
    .filter(([, users]) => users.size > 1)
    .map(([id]) => id)
    .sort();
}

function optionsTerritoryIds(
  scope: Extract<TerritoryScope, { mode: "TERRITORIES" }>,
  territoryId?: string | null,
): readonly string[] {
  if (territoryId) {
    return scope.territoryIds.includes(territoryId) ? [territoryId] : [];
  }
  return scope.territoryIds;
}

export async function findScopedDealersForReport(
  client: SrPerformanceReadClient,
  scope: TerritoryScope,
  options: {
    territoryId?: string | null;
    srId?: string | null;
    partySearch?: string;
    srIds?: readonly string[];
  },
): Promise<ScopedDealerRow[]> {
  const base: Prisma.DealerWhereInput = {
    isActive: true,
  };

  if (options.territoryId) {
    base.territoryId = options.territoryId;
  }

  if (options.srId) {
    base.ownershipHistory = {
      some: {
        isActive: true,
        assignedSrId: options.srId,
      },
    };
  } else if (options.srIds && options.srIds.length > 0) {
    base.ownershipHistory = {
      some: {
        isActive: true,
        assignedSrId: { in: [...options.srIds] },
      },
    };
  }

  if (options.partySearch) {
    const term = options.partySearch;
    base.OR = [
      { companyName: { contains: term, mode: "insensitive" } },
      { dealerCode: { contains: term, mode: "insensitive" } },
    ];
  }

  const where = mergeDealerTerritoryScope(base, scope);

  const dealers = await client.dealer.findMany({
    where,
    select: {
      dealerCode: true,
      companyName: true,
      territoryId: true,
      geoTerritory: { select: { name: true } },
      ownershipHistory: {
        where: { isActive: true },
        orderBy: { effectiveFrom: "desc" },
        select: { assignedSrId: true },
      },
    },
    orderBy: [{ companyName: "asc" }, { dealerCode: "asc" }],
  });

  return dealers.map((dealer) => {
    const activeRows = dealer.ownershipHistory;
    const distinctSrIds = new Set(
      activeRows
        .map((row) => row.assignedSrId)
        .filter((id): id is string => Boolean(id)),
    );
    return {
      dealerCode: dealer.dealerCode,
      partyName: dealer.companyName,
      territoryId: dealer.territoryId,
      territoryName: dealer.geoTerritory?.name ?? null,
      // Deterministic attribution: latest effectiveFrom wins.
      assignedSrId: activeRows[0]?.assignedSrId ?? null,
      activeOwnershipCount: activeRows.length,
      distinctAssignedSrCount: distinctSrIds.size,
    };
  });
}

export async function findTerritoryOptionsForScope(
  client: SrPerformanceReadClient,
  scope: TerritoryScope,
): Promise<Array<{ id: string; name: string }>> {
  if (scope.mode === "NONE") {
    return [];
  }

  return client.territory.findMany({
    where: {
      isActive: true,
      ...(scope.mode === "TERRITORIES"
        ? { id: { in: [...scope.territoryIds] } }
        : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

interface OpeningBalanceRawRow {
  dealerCode: string;
  balance: Prisma.Decimal;
}

interface PeriodMovementRawRow {
  dealerCode: string;
  sales: Prisma.Decimal | null;
  collection: Prisma.Decimal | null;
  ledger_movement: Prisma.Decimal | null;
  unsupported_count: bigint | number | null;
}

/**
 * Batched opening balances using certified statement ORDER BY DESC:
 * transactionDate, postingDate, id — matching findLastLedgerEntryBefore().
 */
export async function aggregateOpeningBalances(
  client: SrPerformanceReadClient,
  dealerCodes: readonly string[],
  fromInclusive: Date,
): Promise<Map<string, Prisma.Decimal>> {
  const result = new Map<string, Prisma.Decimal>();
  if (dealerCodes.length === 0) {
    return result;
  }

  const rows = await client.$queryRaw<OpeningBalanceRawRow[]>`
    SELECT DISTINCT ON (le."dealerCode")
      le."dealerCode" AS "dealerCode",
      le."balance" AS balance
    FROM "LedgerEntry" le
    WHERE le."dealerCode" IN (${Prisma.join([...dealerCodes])})
      AND le."transactionDate" < ${fromInclusive}
    ORDER BY
      le."dealerCode",
      le."transactionDate" DESC,
      le."postingDate" DESC,
      le.id DESC
  `;

  for (const row of rows) {
    result.set(row.dealerCode, normalizeAggregate(row.balance));
  }
  return result;
}

/**
 * Batched period Sales / Collection / ledger movement / unsupported counts.
 * Single GROUP BY on scalar LedgerEntry columns — no relation joins (ADR-059).
 */
export async function aggregatePeriodMovements(
  client: SrPerformanceReadClient,
  dealerCodes: readonly string[],
  fromInclusive: Date,
  toExclusive: Date,
): Promise<Map<string, DealerLedgerAggregate>> {
  const result = new Map<string, DealerLedgerAggregate>();
  if (dealerCodes.length === 0) {
    return result;
  }

  const rows = await client.$queryRaw<PeriodMovementRawRow[]>`
    SELECT
      le."dealerCode" AS "dealerCode",
      SUM(
        CASE
          WHEN le."postingType" = 'Issue'::"LedgerPostingType"
          THEN le."debit"
          ELSE 0
        END
      ) AS sales,
      SUM(
        CASE
          WHEN le."postingType" = 'Collection'::"LedgerPostingType"
          THEN le."credit"
          WHEN le."postingType" = 'Reversal'::"LedgerPostingType"
            AND le."referenceType" = 'Collection'::"FinancialReferenceType"
          THEN -le."debit"
          ELSE 0
        END
      ) AS collection,
      SUM(le."debit" - le."credit") AS ledger_movement,
      COUNT(*) FILTER (
        WHERE NOT (
          le."postingType" = 'Issue'::"LedgerPostingType"
          OR le."postingType" = 'Collection'::"LedgerPostingType"
          OR (
            le."postingType" = 'Reversal'::"LedgerPostingType"
            AND le."referenceType" = 'Collection'::"FinancialReferenceType"
          )
        )
      ) AS unsupported_count
    FROM "LedgerEntry" le
    WHERE le."dealerCode" IN (${Prisma.join([...dealerCodes])})
      AND le."transactionDate" >= ${fromInclusive}
      AND le."transactionDate" < ${toExclusive}
    GROUP BY le."dealerCode"
  `;

  for (const row of rows) {
    result.set(row.dealerCode, {
      dealerCode: row.dealerCode,
      previousDue: ZERO,
      sales: normalizeAggregate(row.sales),
      collection: normalizeAggregate(row.collection),
      ledgerMovement: normalizeAggregate(row.ledger_movement),
      unsupportedPostingCount: Number(row.unsupported_count ?? 0),
    });
  }

  return result;
}

/**
 * Combines opening + period aggregates for a fixed dealer code list.
 * Exactly two financial SQL queries regardless of dealer count.
 */
export async function aggregateDealerLedgerMetrics(
  client: SrPerformanceReadClient,
  dealerCodes: readonly string[],
  fromInclusive: Date,
  toExclusive: Date,
): Promise<Map<string, DealerLedgerAggregate>> {
  const [openings, movements] = await Promise.all([
    aggregateOpeningBalances(client, dealerCodes, fromInclusive),
    aggregatePeriodMovements(client, dealerCodes, fromInclusive, toExclusive),
  ]);

  const combined = new Map<string, DealerLedgerAggregate>();
  for (const code of dealerCodes) {
    const movement = movements.get(code);
    combined.set(code, {
      dealerCode: code,
      previousDue: openings.get(code) ?? ZERO,
      sales: movement?.sales ?? ZERO,
      collection: movement?.collection ?? ZERO,
      ledgerMovement: movement?.ledgerMovement ?? ZERO,
      unsupportedPostingCount: movement?.unsupportedPostingCount ?? 0,
    });
  }
  return combined;
}
