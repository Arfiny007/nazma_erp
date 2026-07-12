/**
 * Enterprise Territory Map — public surface (PHASE_09C).
 *
 * Presentation-only geo visualization consuming analytics DTOs.
 *
 * @see ADR-045
 */

export {
  getSrTerritoryMap,
  getManagerTerritoryMap,
  getAccountsTerritoryMap,
  getAdminTerritoryMap,
  resolveTerritoryMapForRole,
  type MapReadClient,
} from "./map-service";

export {
  buildTerritoryMapNode,
  extractDivisionOptions,
  extractDistrictOptions,
} from "./map-mappers";

export {
  assertMapRole,
  assertMapScope,
  buildMapContext,
  parseMapFilters,
  classifyTerritoryRisk,
  resolvePeriodRange,
  isValidTerritoryMapNode,
  sortNodesByMetric,
  territoryMapFiltersSchema,
} from "./map-validation";

export {
  MapError,
  EmptyMapScopeError,
  UnsupportedMapRoleError,
  InvalidMapFiltersError,
} from "./map-errors";

export type {
  MapMetric,
  MapPeriod,
  MapRole,
  MapContext,
  TerritoryMapFilters,
  TerritoryMapNode,
  TerritoryMapPayload,
  TerritoryMapDivisionOption,
  TerritoryMapDistrictOption,
  TerritoryRiskLevel,
} from "./map-types";

export { DEFAULT_MAP_FILTERS } from "./map-types";
