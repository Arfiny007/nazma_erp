import type { UserRole } from "@prisma/client";

/** Resolved territory visibility for a user. */
export type TerritoryScope =
  | { mode: "ALL" }
  | { mode: "TERRITORIES"; territoryIds: readonly string[] }
  | { mode: "NONE" };

export interface TerritoryAssignmentRecord {
  id: string;
  userId: string;
  territoryId: string;
  territoryCode: string;
  territoryName: string;
  territoryNameBn: string | null;
  districtName: string;
  divisionName: string;
  isPrimary: boolean;
  isActive: boolean;
  assignedAt: string;
  revokedAt: string | null;
}

export interface AssignableUserDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface AssignableTerritoryDTO {
  id: string;
  code: string;
  name: string;
  nameBn: string | null;
  districtName: string;
  divisionName: string;
  isActive: boolean;
}

export type TerritoryAssignmentErrorCode =
  | "VALIDATION_ERROR"
  | "FORBIDDEN"
  | "USER_NOT_FOUND"
  | "TERRITORY_NOT_FOUND"
  | "ASSIGNMENT_NOT_FOUND"
  | "ROLE_NOT_ASSIGNABLE"
  | "INTERNAL_ERROR";

export interface FieldError {
  field: string;
  messageKey: string;
}

export interface TerritoryAssignmentError {
  code: TerritoryAssignmentErrorCode;
  messageKey: string;
  fieldErrors?: FieldError[];
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: TerritoryAssignmentError };

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
