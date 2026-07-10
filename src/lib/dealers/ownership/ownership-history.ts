/**
 * Re-exports ownership timeline helpers for reporting integrations (PHASE_08+).
 */
export {
  fetchCurrentOwnership,
  fetchOwnershipHistory,
} from "./ownership-query";

export { getCurrentDealerOwner, getDealerOwnershipHistory } from "./ownership-service";

export type { DealerOwnershipRecord } from "./ownership-types";
