"use server";

import { Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  assertUserCanAssignTerritory,
  resolveTerritoryGeography,
  transferDealer,
} from "@/lib/dealers/ownership";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { canAccessDealer } from "@/lib/rbac/territory";
import { updateDealerSchema } from "@/lib/validators/dealer.schema";
import type { ActionResult, DealerDTO } from "@/types/dealer";

import { fail, fromPrismaError, fromZodError, ok, toDealerDTO } from "./helpers";

export async function updateDealer(
  input: unknown,
): Promise<ActionResult<DealerDTO>> {
  let user;
  try {
    user = await requirePermission("dealers:edit");
  } catch {
    return fail<DealerDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = updateDealerSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id, ...changes } = parsed.data;

  try {
    if (changes.territoryId) {
      await assertUserCanAssignTerritory(user.id, changes.territoryId);
    }

    const dealer = await prisma.$transaction(async (tx) => {
      const existing = await tx.dealer.findUnique({
        where: { id },
        select: { id: true, mobile: true, territoryId: true },
      });
      if (!existing) {
        throw new DealerNotFoundError();
      }

      const allowed = await canAccessDealer(user.id, existing.id);
      if (!allowed) {
        throw new TerritoryAccessDeniedError();
      }

      if (changes.mobile !== undefined && changes.mobile !== existing.mobile) {
        const mobileOwner = await tx.dealer.findFirst({
          where: { mobile: changes.mobile, id: { not: id } },
          select: { id: true },
        });
        if (mobileOwner) {
          throw new DuplicateMobileError();
        }
      }

      if (changes.territoryId && changes.territoryId !== existing.territoryId) {
        const territory = await resolveTerritoryGeography(changes.territoryId);
        if (
          !territory?.isActive ||
          (changes.districtId && territory.districtId !== changes.districtId) ||
          (changes.divisionId &&
            territory.district.divisionId !== changes.divisionId)
        ) {
          throw new InvalidTerritoryError();
        }

        await transferDealer(
          {
            dealerId: id,
            territoryId: changes.territoryId,
            assignedById: user.id,
            assignedSrId: user.role === UserRole.SR ? user.id : null,
            reason: "Territory updated via dealer edit",
          },
          tx,
        );
      }

      const updateData: Prisma.DealerUpdateInput = {};
      if (changes.companyName !== undefined) {
        updateData.companyName = changes.companyName;
      }
      if (changes.proprietorName !== undefined) {
        updateData.proprietorName = changes.proprietorName;
      }
      if (changes.mobile !== undefined) {
        updateData.mobile = changes.mobile;
      }
      if (changes.email !== undefined) {
        updateData.email = changes.email;
      }
      if (changes.address !== undefined) {
        updateData.address = changes.address;
      }
      if (changes.creditLimit !== undefined) {
        updateData.creditLimit = changes.creditLimit;
      }
      if (changes.isActive !== undefined) {
        updateData.isActive = changes.isActive;
      }

      if (Object.keys(updateData).length === 0) {
        return tx.dealer.findUniqueOrThrow({ where: { id } });
      }

      return tx.dealer.update({ where: { id }, data: updateData });
    });

    revalidatePath("/dealers");
    revalidatePath(`/dealers/${dealer.id}/ownership`);
    return ok(toDealerDTO(dealer));
  } catch (error) {
    if (error instanceof DealerNotFoundError) {
      return fail<DealerDTO>("DEALER_NOT_FOUND", "dealer.error.notFound");
    }
    if (error instanceof TerritoryAccessDeniedError) {
      return fail<DealerDTO>("FORBIDDEN", "rbac.territory.noAccess");
    }
    if (error instanceof InvalidTerritoryError) {
      return fail<DealerDTO>("TERRITORY_NOT_ASSIGNABLE", "validation.territory.invalid", [
        { field: "territoryId", messageKey: "validation.territory.invalid" },
      ]);
    }
    if (error instanceof DuplicateMobileError) {
      return fail<DealerDTO>(
        "DUPLICATE_MOBILE",
        "dealer.error.duplicateMobile",
        [{ field: "mobile", messageKey: "dealer.error.duplicateMobile" }],
      );
    }
    return fromPrismaError(error);
  }
}

class DealerNotFoundError extends Error {
  constructor() {
    super("DEALER_NOT_FOUND");
    this.name = "DealerNotFoundError";
  }
}

class DuplicateMobileError extends Error {
  constructor() {
    super("DUPLICATE_MOBILE");
    this.name = "DuplicateMobileError";
  }
}

class TerritoryAccessDeniedError extends Error {
  constructor() {
    super("TERRITORY_ACCESS_DENIED");
    this.name = "TerritoryAccessDeniedError";
  }
}

class InvalidTerritoryError extends Error {
  constructor() {
    super("INVALID_TERRITORY");
    this.name = "InvalidTerritoryError";
  }
}
