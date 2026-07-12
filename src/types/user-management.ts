import type { UserLifecycleStatus, UserRole } from "@prisma/client";

export type UserManagementErrorCode =
  | "VALIDATION_ERROR"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "EMAIL_EXISTS"
  | "INVALID_TRANSITION"
  | "ROLE_ESCALATION"
  | "TERRITORY_SCOPE"
  | "MANAGER_SCOPE"
  | "SELF_ACTION"
  | "INTERNAL_ERROR";

export interface FieldError {
  field: string;
  messageKey: string;
}

export interface UserManagementError {
  code: UserManagementErrorCode;
  messageKey: string;
  fieldErrors?: FieldError[];
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: UserManagementError };

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface UserTerritorySummary {
  territoryId: string;
  territoryCode: string;
  territoryName: string;
  isPrimary: boolean;
}

export interface UserSummaryDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  lifecycleStatus: UserLifecycleStatus;
  isActive: boolean;
  mustChangePassword: boolean;
  managerId: string | null;
  managerName: string | null;
  territoryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserDetailDTO extends UserSummaryDTO {
  phone: string | null;
  employeeCode: string | null;
  notes: string | null;
  provisionedById: string | null;
  provisionedByName: string | null;
  territories: UserTerritorySummary[];
}

export interface CreateUserResultDTO {
  user: UserDetailDTO;
  /** Plain temporary password — shown once to the administrator. */
  temporaryPassword: string;
  /** Plain activation token — shown once when user is PENDING_ACTIVATION. */
  activationToken: string | null;
  /** Ready-to-share activation URL when token is issued. */
  activationUrl: string | null;
}

export const USER_SORT_FIELDS = ["name", "email", "role", "lifecycleStatus", "createdAt"] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";
