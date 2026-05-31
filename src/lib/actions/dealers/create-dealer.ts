"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { generateNextDealerCode } from "@/lib/utils/dealer-code";
import { createDealerSchema } from "@/lib/validators/dealer.schema";
import type { ActionResult, DealerDTO } from "@/types/dealer";

import { fail, fromPrismaError, fromZodError, ok, toDealerDTO } from "./helpers";

/** Number of attempts to retry on a dealer-code unique collision under load. */
const MAX_CODE_GENERATION_ATTEMPTS = 5;

/**
 * Creates a new dealer.
 *
 * The dealer code is generated sequentially inside the same transaction that
 * persists the record; the unique constraint on `dealerCode` is the final guard
 * against concurrent inserts, so the operation retries a bounded number of
 * times on a collision.
 *
 * Mobile uniqueness is enforced at the application level because `mobile` has
 * no `@unique` index in the schema.  This means two concurrent requests that
 * pass the `findFirst` check within the same READ COMMITTED snapshot can both
 * insert the same mobile number.  Adding `mobile @unique` to `schema.prisma`
 * would eliminate the race; the `fromPrismaError` P2002 handler already
 * surfaces this as DUPLICATE_MOBILE when a DB-level conflict occurs.
 */
export async function createDealer(
  input: unknown,
): Promise<ActionResult<DealerDTO>> {
  const parsed = createDealerSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const data = parsed.data;

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

        return tx.dealer.create({
          data: {
            dealerCode,
            companyName: data.companyName,
            proprietorName: data.proprietorName,
            mobile: data.mobile,
            email: data.email,
            address: data.address,
            district: data.district,
            territory: data.territory,
            creditLimit: data.creditLimit,
            isActive: data.isActive,
          },
        });
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

      // Retry on dealerCode collision regardless of which attempt we are on.
      // When attempts are exhausted the for-loop exits naturally and the
      // `fail("...codeGenerationFailed")` below is reached with a consistent
      // error key.  Non-collision errors exit immediately via fromPrismaError.
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

/** Sentinel used to surface application-level mobile uniqueness violations. */
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
