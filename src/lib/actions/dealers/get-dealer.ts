"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { canAccessDealer } from "@/lib/rbac/territory";
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
  let user;
  try {
    user = await requirePermission("dealers:view");
  } catch {
    return fail<DealerDTO>("FORBIDDEN", "rbac.noAccess");
  }

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

    const allowed = await canAccessDealer(user.id, dealer.id);
    if (!allowed) {
      return fail<DealerDTO>("FORBIDDEN", "rbac.territory.noAccess");
    }

    return ok(toDealerDTO(dealer));
  } catch (error) {
    return fromPrismaError(error);
  }
}
