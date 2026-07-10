"use server";

import { Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  assignDealerTerritory,
  assertUserCanAssignTerritory,
  resolveTerritoryGeography,
  TerritoryNotAssignableError,
  transferDealer,
} from "@/lib/dealers/ownership";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { generateNextDealerCode } from "@/lib/utils/dealer-code";
import { createDealerSchema } from "@/lib/validators/dealer.schema";
import type { ActionResult, DealerDTO } from "@/types/dealer";

import { fail, fromPrismaError, fromZodError, ok, toDealerDTO } from "./helpers";

const MAX_CODE_GENERATION_ATTEMPTS = 5;

export async function createDealer(
  input: unknown,
): Promise<ActionResult<DealerDTO>> {
  let user;
  try {
    user = await requirePermission("dealers:create");
  } catch {
    return fail<DealerDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = createDealerSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const data = parsed.data;

  try {
    await assertUserCanAssignTerritory(user.id, data.territoryId);
  } catch {
    return fail<DealerDTO>("TERRITORY_NOT_ASSIGNABLE", "rbac.territory.noAccess", [
      { field: "territoryId", messageKey: "rbac.territory.noAccess" },
    ]);
  }

  const territory = await resolveTerritoryGeography(data.territoryId);
  if (
    !territory?.isActive ||
    territory.districtId !== data.districtId ||
    territory.district.divisionId !== data.divisionId
  ) {
    return fail<DealerDTO>("VALIDATION_ERROR", "validation.failed", [
      { field: "territoryId", messageKey: "validation.territory.invalid" },
    ]);
  }

  const assignedSrId = user.role === UserRole.SR ? user.id : null;

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const dealer = await prisma.$transaction(async (tx) => {
        const existingMobile = await tx.dealer.findFirst({
          where: { mobile: data.mobile },
          select: { id: true },
        });
        if (existingMobile) {
          throw new DuplicateMobileError();
        }

        const dealerCode = await generateNextDealerCode(tx);

        const created = await tx.dealer.create({
          data: {
            dealerCode,
            companyName: data.companyName,
            proprietorName: data.proprietorName,
            mobile: data.mobile,
            email: data.email,
            address: data.address,
            divisionId: data.divisionId,
            districtId: data.districtId,
            territoryId: data.territoryId,
            district: territory.district.name,
            territory: territory.name,
            creditLimit: data.creditLimit,
            isActive: data.isActive,
          },
        });

        await assignDealerTerritory(
          {
            dealerId: created.id,
            territoryId: data.territoryId,
            assignedById: user.id,
            assignedSrId,
            reason: "Initial territory assignment",
          },
          tx,
        );

        return created;
      });

      revalidatePath("/dealers");
      return ok(toDealerDTO(dealer));
    } catch (error) {
      if (error instanceof DuplicateMobileError) {
        return fail<DealerDTO>(
          "DUPLICATE_MOBILE",
          "dealer.error.duplicateMobile",
          [{ field: "mobile", messageKey: "dealer.error.duplicateMobile" }],
        );
      }
      if (error instanceof TerritoryNotAssignableError) {
        return fail<DealerDTO>("TERRITORY_NOT_ASSIGNABLE", "rbac.territory.noAccess");
      }
      if (isDealerCodeCollision(error)) {
        continue;
      }
      return fromPrismaError(error);
    }
  }

  return fail<DealerDTO>(
    "DUPLICATE_DEALER_CODE",
    "dealer.error.codeGenerationFailed",
  );
}

class DuplicateMobileError extends Error {
  constructor() {
    super("DUPLICATE_MOBILE");
    this.name = "DuplicateMobileError";
  }
}

function isDealerCodeCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((value) => String(value).includes("dealerCode"));
  }
  return typeof target === "string" && target.includes("dealerCode");
}
