"use server";

import { CollectionStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { generateNextCollectionNo } from "@/lib/utils/collection-number";
import { createCollectionSchema } from "@/lib/validators/collection.schema";
import type { ActionResult, CollectionDetailDTO } from "@/types/collection";

import {
  CollectionActionError,
  fail,
  fromPrismaError,
  fromZodError,
  loadCollectionDetailDTO,
  MAX_COLLECTION_NO_ATTEMPTS,
  ok,
  recordCollectionAudit,
} from "./helpers";

/**
 * Creates a Draft collection (cash receipt record).
 *
 * No dealer balance mutation until confirmation.
 */
export async function createCollection(
  input: unknown,
): Promise<ActionResult<CollectionDetailDTO>> {
  let user;
  try {
    user = await requirePermission("collections:create");
  } catch {
    return fail<CollectionDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = createCollectionSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const data = parsed.data;
  const receivedAmount = new Prisma.Decimal(data.receivedAmount);

  for (let attempt = 0; attempt < MAX_COLLECTION_NO_ATTEMPTS; attempt += 1) {
    try {
      const collectionId = await prisma.$transaction(async (tx) => {
        const dealer = await tx.dealer.findUnique({
          where: { dealerCode: data.dealerCode },
          select: { dealerCode: true, isActive: true },
        });

        if (!dealer) {
          throw new CollectionActionError(
            "DEALER_NOT_FOUND",
            "collection.error.dealerNotFound",
          );
        }

        const collectionNo = await generateNextCollectionNo(tx);
        const createdAt = new Date();

        const collection = await tx.collection.create({
          data: {
            collectionNo,
            dealerCode: data.dealerCode,
            collectionDate: data.collectionDate,
            paymentMethod: data.paymentMethod,
            referenceNumber: data.referenceNumber,
            bankName: data.bankName,
            remarks: data.remarks,
            receivedAmount,
            allocatedAmount: new Prisma.Decimal(0),
            unallocatedAmount: receivedAmount,
            status: CollectionStatus.Draft,
            isAdvancePayment: data.isAdvancePayment,
            createdById: user.id,
          },
          select: { id: true, collectionNo: true },
        });

        await recordCollectionAudit(tx, {
          userId: user.id,
          collectionId: collection.id,
          action: "COLLECTION_CREATED",
          newValue: {
            collectionNo: collection.collectionNo,
            dealerCode: data.dealerCode,
            receivedAmount: receivedAmount.toFixed(2),
            allocatedAmount: "0.00",
            unallocatedAmount: receivedAmount.toFixed(2),
            actor: user.id,
            timestamp: createdAt.toISOString(),
          },
        });

        return collection.id;
      });

      const detail = await loadCollectionDetailDTO(collectionId);
      if (!detail) {
        return fail<CollectionDetailDTO>(
          "COLLECTION_NOT_FOUND",
          "collection.error.notFound",
        );
      }

      return ok(detail);
    } catch (error) {
      if (error instanceof CollectionActionError) {
        return fail<CollectionDetailDTO>(error.code, error.messageKey);
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < MAX_COLLECTION_NO_ATTEMPTS - 1
      ) {
        continue;
      }
      return fromPrismaError(error);
    }
  }

  return fail<CollectionDetailDTO>(
    "DUPLICATE_COLLECTION_NO",
    "collection.error.duplicateCollectionNo",
  );
}
