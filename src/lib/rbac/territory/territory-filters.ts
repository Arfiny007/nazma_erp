import type { Prisma } from "@prisma/client";

import type { TerritoryScope } from "./territory-types";

function scopedTerritoryFilter(
  scope: TerritoryScope,
): Prisma.StringNullableFilter | undefined {
  if (scope.mode === "ALL") {
    return undefined;
  }
  if (scope.mode === "NONE") {
    return { in: [] };
  }
  return { in: [...scope.territoryIds] };
}

/** Merges territory scope into an existing Dealer where clause. */
export function mergeDealerTerritoryScope(
  base: Prisma.DealerWhereInput,
  scope: TerritoryScope,
): Prisma.DealerWhereInput {
  const territoryFilter = scopedTerritoryFilter(scope);
  if (!territoryFilter) {
    return base;
  }

  return {
    AND: [base, { territoryId: territoryFilter }],
  };
}

/** Merges territory scope into an existing SalesOrder where clause. */
export function mergeOrderTerritoryScope(
  base: Prisma.SalesOrderWhereInput,
  scope: TerritoryScope,
): Prisma.SalesOrderWhereInput {
  const territoryFilter = scopedTerritoryFilter(scope);
  if (!territoryFilter) {
    return base;
  }

  return {
    AND: [base, { dealer: { territoryId: territoryFilter } }],
  };
}

/** Merges territory scope into an existing Collection where clause. */
export function mergeCollectionTerritoryScope(
  base: Prisma.CollectionWhereInput,
  scope: TerritoryScope,
): Prisma.CollectionWhereInput {
  const territoryFilter = scopedTerritoryFilter(scope);
  if (!territoryFilter) {
    return base;
  }

  return {
    AND: [base, { dealer: { territoryId: territoryFilter } }],
  };
}
