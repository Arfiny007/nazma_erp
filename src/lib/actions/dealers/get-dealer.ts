"use server";

import { prisma } from "@/lib/prisma";
import { dealerIdentifierSchema } from "@/lib/validators/dealer.schema";
import type { ActionResult, DealerDTO } from "@/types/dealer";

import { fail, fromPrismaError, fromZodError, ok, toDealerDTO } from "./helpers";

/**
 * Fetches a single dealer by `id` or `dealerCode`.
 *
 * Exactly one identifier is required; when both are supplied the `id` takes
 * precedence.
 */
export async function getDealer(
  input: unknown,
): Promise<ActionResult<DealerDTO>> {
  const parsed = dealerIdentifierSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id, dealerCode } = parsed.data;

  try {
    const dealer = id
      ? await prisma.dealer.findUnique({ where: { id } })
      : await prisma.dealer.findUnique({
          where: { dealerCode: dealerCode! },
        });

    if (!dealer) {
      return fail<DealerDTO>("DEALER_NOT_FOUND", "dealer.error.notFound");
    }

    return ok(toDealerDTO(dealer));
  } catch (error) {
    return fromPrismaError(error);
  }
}
