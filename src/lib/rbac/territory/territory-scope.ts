import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { TerritoryAccessDeniedError } from "./territory-errors";
import {
  mergeCollectionTerritoryScope,
  mergeDealerTerritoryScope,
  mergeOrderTerritoryScope,
} from "./territory-filters";
import {
  fetchActiveTerritoryIdsForUser,
  fetchCollectionDealerTerritoryId,
  fetchDealerTerritoryId,
  fetchDealerTerritoryIdByCode,
  fetchOrderDealerTerritoryId,
} from "./territory-queries";
import {
  buildScopedTerritoryScope,
  isGlobalTerritoryRole,
  resolveTerritoryScopeMode,
  territoryIdMatchesScope,
} from "./territory-rules";
import type { TerritoryScope } from "./territory-types";

export {
  mergeCollectionTerritoryScope,
  mergeDealerTerritoryScope,
  mergeOrderTerritoryScope,
  territoryIdMatchesScope,
};

/**
 * Resolves the territory visibility scope for a user.
 *
 * Super_Admin and Accounts → ALL.
 * Manager and SR → assigned active territories.
 * Others → NONE.
 */
export async function buildTerritoryScope(userId: string): Promise<TerritoryScope> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });

  if (!user?.isActive) {
    return { mode: "NONE" };
  }

  const mode = resolveTerritoryScopeMode(user.role);
  if (mode === "ALL") {
    return { mode: "ALL" };
  }
  if (mode === "NONE") {
    return { mode: "NONE" };
  }

  const territoryIds = await fetchActiveTerritoryIdsForUser(userId);
  return buildScopedTerritoryScope(territoryIds);
}

/** Returns active territory IDs visible to the user. */
export async function getAccessibleTerritories(
  userId: string,
): Promise<readonly string[]> {
  const scope = await buildTerritoryScope(userId);
  if (scope.mode === "ALL") {
    const rows = await prisma.territory.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
  if (scope.mode === "TERRITORIES") {
    return scope.territoryIds;
  }
  return [];
}

export async function canAccessDealer(
  userId: string,
  dealerId: string,
): Promise<boolean> {
  const scope = await buildTerritoryScope(userId);
  if (scope.mode === "ALL") {
    return true;
  }
  const territoryId = await fetchDealerTerritoryId(dealerId);
  return territoryIdMatchesScope(scope, territoryId);
}

export async function canAccessDealerByCode(
  userId: string,
  dealerCode: string,
): Promise<boolean> {
  const scope = await buildTerritoryScope(userId);
  if (scope.mode === "ALL") {
    return true;
  }
  const territoryId = await fetchDealerTerritoryIdByCode(dealerCode);
  return territoryIdMatchesScope(scope, territoryId);
}

export async function canAccessOrder(
  userId: string,
  orderId: string,
): Promise<boolean> {
  const scope = await buildTerritoryScope(userId);
  if (scope.mode === "ALL") {
    return true;
  }
  const territoryId = await fetchOrderDealerTerritoryId(orderId);
  return territoryIdMatchesScope(scope, territoryId);
}

export async function canAccessCollection(
  userId: string,
  collectionId: string,
): Promise<boolean> {
  const scope = await buildTerritoryScope(userId);
  if (scope.mode === "ALL") {
    return true;
  }
  const territoryId = await fetchCollectionDealerTerritoryId(collectionId);
  return territoryIdMatchesScope(scope, territoryId);
}

export async function canAccessStatement(
  userId: string,
  dealerIdOrCode: { dealerId: string } | { dealerCode: string },
): Promise<boolean> {
  if ("dealerId" in dealerIdOrCode) {
    return canAccessDealer(userId, dealerIdOrCode.dealerId);
  }
  return canAccessDealerByCode(userId, dealerIdOrCode.dealerCode);
}

/**
 * Asserts dealer access — throws {@link TerritoryAccessDeniedError} when denied.
 */
export async function assertTerritoryDealerAccess(
  userId: string,
  dealerId: string,
): Promise<void> {
  const allowed = await canAccessDealer(userId, dealerId);
  if (!allowed) {
    throw new TerritoryAccessDeniedError();
  }
}

export async function assertTerritoryDealerCodeAccess(
  userId: string,
  dealerCode: string,
): Promise<void> {
  const allowed = await canAccessDealerByCode(userId, dealerCode);
  if (!allowed) {
    throw new TerritoryAccessDeniedError();
  }
}

export async function assertTerritoryOrderAccess(
  userId: string,
  orderId: string,
): Promise<void> {
  const allowed = await canAccessOrder(userId, orderId);
  if (!allowed) {
    throw new TerritoryAccessDeniedError();
  }
}

export async function assertTerritoryCollectionAccess(
  userId: string,
  collectionId: string,
): Promise<void> {
  const allowed = await canAccessCollection(userId, collectionId);
  if (!allowed) {
    throw new TerritoryAccessDeniedError();
  }
}

/** Convenience: build scope from an authenticated session user. */
export async function buildTerritoryScopeForRole(
  userId: string,
  role: UserRole,
): Promise<TerritoryScope> {
  if (isGlobalTerritoryRole(role)) {
    return { mode: "ALL" };
  }
  const mode = resolveTerritoryScopeMode(role);
  if (mode !== "TERRITORIES") {
    return { mode: "NONE" };
  }
  const territoryIds = await fetchActiveTerritoryIdsForUser(userId);
  return buildScopedTerritoryScope(territoryIds);
}
