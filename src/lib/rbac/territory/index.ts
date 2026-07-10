export {
  buildTerritoryScope,
  buildTerritoryScopeForRole,
  canAccessCollection,
  canAccessDealer,
  canAccessDealerByCode,
  canAccessOrder,
  canAccessStatement,
  getAccessibleTerritories,
  assertTerritoryCollectionAccess,
  assertTerritoryDealerAccess,
  assertTerritoryDealerCodeAccess,
  assertTerritoryOrderAccess,
  mergeCollectionTerritoryScope,
  mergeDealerTerritoryScope,
  mergeOrderTerritoryScope,
  territoryIdMatchesScope,
} from "./territory-scope";

export {
  ASSIGNABLE_TERRITORY_ROLES,
  GLOBAL_TERRITORY_ROLES,
  SCOPED_TERRITORY_ROLES,
  buildScopedTerritoryScope,
  isAssignableTerritoryRole,
  isGlobalTerritoryRole,
  isScopedTerritoryRole,
  resolveTerritoryScopeMode,
} from "./territory-rules";

export {
  TerritoryAccessDeniedError,
  TerritoryScopeUserNotFoundError,
} from "./territory-errors";

export type {
  ActionResult,
  AssignableTerritoryDTO,
  AssignableUserDTO,
  FieldError,
  PaginatedResult,
  TerritoryAssignmentError,
  TerritoryAssignmentErrorCode,
  TerritoryAssignmentRecord,
  TerritoryScope,
} from "./territory-types";

export {
  fetchActiveTerritoryIdsForUser,
  listTerritoryAssignmentsForUser,
} from "./territory-queries";
