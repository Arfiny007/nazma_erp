import type { UserRole } from "@prisma/client";

export interface DealerOwnershipRecord {
  id: string;
  dealerId: string;
  territoryId: string;
  territoryCode: string;
  territoryName: string;
  territoryNameBn: string | null;
  districtName: string;
  divisionName: string;
  assignedSrId: string | null;
  assignedSrName: string | null;
  assignedById: string;
  assignedByName: string;
  reason: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface DealerOwnershipCurrent {
  ownership: DealerOwnershipRecord | null;
  dealerId: string;
  dealerCode: string;
  companyName: string;
}

export interface AssignDealerTerritoryInput {
  dealerId: string;
  territoryId: string;
  assignedById: string;
  assignedSrId?: string | null;
  reason?: string | null;
}

export interface TransferDealerInput {
  dealerId: string;
  territoryId: string;
  assignedById: string;
  assignedSrId?: string | null;
  reason?: string | null;
}

export interface BackfillDealerOwnershipReport {
  migrated: number;
  skipped: number;
  failed: number;
  details: BackfillDealerOwnershipDetail[];
}

export interface BackfillDealerOwnershipDetail {
  dealerId: string;
  dealerCode: string;
  status: "migrated" | "skipped" | "failed";
  messageKey: string;
  territoryId?: string;
}

export type OwnershipErrorCode =
  | "DEALER_NOT_FOUND"
  | "TERRITORY_NOT_FOUND"
  | "OWNERSHIP_NOT_FOUND"
  | "ACTIVE_OWNERSHIP_EXISTS"
  | "TERRITORY_NOT_ASSIGNABLE"
  | "OWNERSHIP_CONFLICT"
  | "VALIDATION_ERROR"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

export interface OwnershipActionError {
  code: OwnershipErrorCode;
  messageKey: string;
  fieldErrors?: { field: string; messageKey: string }[];
}

export type OwnershipActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: OwnershipActionError };

export interface TerritoryAssignmentContext {
  userId: string;
  role: UserRole;
  canEditTerritory: boolean;
}
