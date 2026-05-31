"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/dealer";

import { fail, fromPrismaError, fromZodError, ok } from "./helpers";

const deleteDealerSchema = z.object({
  id: z.uuid({ error: "validation.id.invalid" }),
});

export interface DeleteDealerResult {
  id: string;
  dealerCode: string;
}

/**
 * Permanently deletes a dealer.
 *
 * To preserve financial integrity ("no orphan financial records"), the dealer
 * is only removed when it has no dependent orders, invoices, collections,
 * ledger entries or due reports. When dependencies exist the caller receives a
 * typed DEALER_HAS_DEPENDENCIES error and should deactivate the dealer instead.
 */
export async function deleteDealer(
  input: unknown,
): Promise<ActionResult<DeleteDealerResult>> {
  const parsed = deleteDealerSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const dealer = await tx.dealer.findUnique({
        where: { id },
        select: { id: true, dealerCode: true },
      });
      if (!dealer) {
        throw new DealerNotFoundError();
      }

      const where = { dealerCode: dealer.dealerCode };
      const [orders, invoices, collections, ledgerEntries, dueReports] =
        await Promise.all([
          tx.salesOrder.count({ where }),
          tx.invoice.count({ where }),
          tx.collection.count({ where }),
          tx.ledgerEntry.count({ where }),
          tx.dueReport.count({ where }),
        ]);

      const dependencyCount =
        orders + invoices + collections + ledgerEntries + dueReports;
      if (dependencyCount > 0) {
        throw new DealerHasDependenciesError();
      }

      await tx.dealer.delete({ where: { id } });
      return { id: dealer.id, dealerCode: dealer.dealerCode };
    });

    revalidatePath("/dealers");
    return ok(result);
  } catch (error) {
    if (error instanceof DealerNotFoundError) {
      return fail<DeleteDealerResult>(
        "DEALER_NOT_FOUND",
        "dealer.error.notFound",
      );
    }
    if (error instanceof DealerHasDependenciesError) {
      return fail<DeleteDealerResult>(
        "DEALER_HAS_DEPENDENCIES",
        "dealer.error.hasDependencies",
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

class DealerHasDependenciesError extends Error {
  constructor() {
    super("DEALER_HAS_DEPENDENCIES");
    this.name = "DealerHasDependenciesError";
  }
}
