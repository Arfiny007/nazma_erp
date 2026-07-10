/** Serializable geography projections safe to return from server actions. */

export interface DivisionDTO {
  id: string;
  code: string;
  name: string;
  nameBn: string;
  sortOrder: number;
  isActive: boolean;
}

export interface DistrictDTO {
  id: string;
  code: string;
  name: string;
  nameBn: string;
  divisionId: string;
  divisionCode: string;
  divisionName: string;
  sortOrder: number;
  isActive: boolean;
}

export interface TerritoryDTO {
  id: string;
  code: string;
  name: string;
  nameBn: string | null;
  districtId: string;
  districtCode: string;
  districtName: string;
  divisionId: string;
  divisionCode: string;
  divisionName: string;
  sortOrder: number;
  isActive: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export type GeographyErrorCode =
  | "VALIDATION_ERROR"
  | "DIVISION_NOT_FOUND"
  | "DISTRICT_NOT_FOUND"
  | "INTERNAL_ERROR";

export interface FieldError {
  field: string;
  messageKey: string;
}

export interface GeographyError {
  code: GeographyErrorCode;
  messageKey: string;
  fieldErrors?: FieldError[];
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: GeographyError };
