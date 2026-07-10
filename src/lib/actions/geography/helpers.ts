import { Prisma } from "@prisma/client";
import type { Division, District, Territory } from "@prisma/client";
import type { ZodError } from "zod";

import type {
  ActionResult,
  DistrictDTO,
  DivisionDTO,
  FieldError,
  GeographyError,
  GeographyErrorCode,
  TerritoryDTO,
} from "@/types/geography";

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: GeographyErrorCode,
  messageKey: string,
  fieldErrors?: FieldError[],
): ActionResult<T> {
  const error: GeographyError = { code, messageKey };
  if (fieldErrors && fieldErrors.length > 0) {
    error.fieldErrors = fieldErrors;
  }
  return { success: false, error };
}

export function fromZodError<T>(error: ZodError): ActionResult<T> {
  const fieldErrors: FieldError[] = error.issues.map((issue) => ({
    field: issue.path.map((segment) => String(segment)).join(".") || "_root",
    messageKey: issue.message,
  }));

  return fail<T>("VALIDATION_ERROR", "validation.failed", fieldErrors);
}

export function fromPrismaError<T>(error: unknown): ActionResult<T> {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2025":
        return fail<T>("DISTRICT_NOT_FOUND", "geography.error.notFound");
      default:
        break;
    }
  }

  return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
}

export function toDivisionDTO(division: Division): DivisionDTO {
  return {
    id: division.id,
    code: division.code,
    name: division.name,
    nameBn: division.nameBn,
    sortOrder: division.sortOrder,
    isActive: division.isActive,
  };
}

type DistrictWithDivision = District & {
  division: Pick<Division, "id" | "code" | "name">;
};

export function toDistrictDTO(district: DistrictWithDivision): DistrictDTO {
  return {
    id: district.id,
    code: district.code,
    name: district.name,
    nameBn: district.nameBn,
    divisionId: district.divisionId,
    divisionCode: district.division.code,
    divisionName: district.division.name,
    sortOrder: district.sortOrder,
    isActive: district.isActive,
  };
}

type TerritoryWithHierarchy = Territory & {
  district: DistrictWithDivision;
};

export function toTerritoryDTO(territory: TerritoryWithHierarchy): TerritoryDTO {
  return {
    id: territory.id,
    code: territory.code,
    name: territory.name,
    nameBn: territory.nameBn,
    districtId: territory.districtId,
    districtCode: territory.district.code,
    districtName: territory.district.name,
    divisionId: territory.district.divisionId,
    divisionCode: territory.district.division.code,
    divisionName: territory.district.division.name,
    sortOrder: territory.sortOrder,
    isActive: territory.isActive,
  };
}
