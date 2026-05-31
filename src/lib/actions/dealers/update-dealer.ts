"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { updateDealerSchema } from "@/lib/validators/dealer.schema";
import type { ActionResult, DealerDTO } from "@/types/dealer";

import { fail, fromPrismaError, fromZodError, ok, toDealerDTO } from "./helpers";

/**
 * Updates an existing dealer's editable fields.
 *
 * `dealerCode` and `currentBalance` are immutable through this action: the code
 * is system-generated and the balance is derived from financial transactions.
 * Only fields present in the input are modified.
 */
export async function updateDealer(
  input: unknown,
): Promise<ActionResult<DealerDTO>> {
  const parsed = updateDealerSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id, ...changes } = parsed.data;

  try {
    const dealer = await prisma.$transaction(async (tx) => {
      const existing = await tx.dealer.findUnique({
        where: { id },
        select: { id: true, mobile: true },
      });
      if (!existing) {
        throw new DealerNotFoundError();
      }

      if (changes.mobile !== undefined && changes.mobile !== existing.mobile) {
        // Best-effort uniqueness check; subject to TOCTOU race under READ
        // COMMITTED isolation until `mobile @unique` is added to the schema.
        const mobileOwner = await tx.dealer.findFirst({
          where: { mobile: changes.mobile, id: { not: id } },
          select: { id: true },
        });
        if (mobileOwner) {
          throw new DuplicateMobileError();
        }
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
      if (changes.district !== undefined) {
        updateData.district = changes.district;
      }
      if (changes.territory !== undefined) {
        updateData.territory = changes.territory;
      }
      if (changes.creditLimit !== undefined) {
        updateData.creditLimit = changes.creditLimit;
      }
      if (changes.isActive !== undefined) {
        updateData.isActive = changes.isActive;
      }

      return tx.dealer.update({ where: { id }, data: updateData });
    });

    revalidatePath("/dealers");
    revalidatePath(`/dealers/${dealer.id}`);
    return ok(toDealerDTO(dealer));
  } catch (error) {
    if (error instanceof DealerNotFoundError) {
      return fail<DealerDTO>("DEALER_NOT_FOUND", "dealer.error.notFound");
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
