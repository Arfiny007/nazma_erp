export type { DealerOwnershipRecord } from "./ownership-types";

export {
  assignDealerTerritory,
  backfillDealerOwnership,
  getCurrentDealerOwner,
  getDealerOwnershipHistory,
  transferDealer,
} from "./ownership-service";

export {
  assertUserCanAssignTerritory,
  fetchCurrentOwnership,
  fetchOwnershipHistory,
  resolveTerritoryGeography,
} from "./ownership-query";

export {
  ActiveOwnershipConflictError,
  DealerNotFoundError,
  OwnershipConflictError,
  OwnershipNotFoundError,
  TerritoryNotAssignableError,
  TerritoryNotFoundError,
} from "./ownership-errors";

export {
  assignDealerTerritorySchema,
  dealerGeographySchema,
  dealerOwnershipHistorySchema,
  transferDealerSchema,
} from "./ownership-validation";

export type {
  AssignDealerTerritoryInput,
  BackfillDealerOwnershipReport,
  DealerOwnershipCurrent,
  TransferDealerInput,
} from "./ownership-types";
