"use server";

import { DeliveryChallanStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  assertCanCreateChallan,
  assertChallanHasItems,
  assertNotOverDelivery,
  DeliveryWorkflowError,
} from "@/lib/delivery/workflow";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { generateNextChallanNo } from "@/lib/utils/challan-number";
import { createDeliveryChallanSchema } from "@/lib/validators/delivery-challan.schema";
import type { ActionResult, DeliveryChallanDetailDTO } from "@/types/delivery-challan";

import {
  ChallanActionError,
  fail,
  fromPrismaError,
  fromZodError,
  loadChallanDetailDTO,
  loadOrderLineSnapshots,
  mapWorkflowError,
  MAX_CHALLAN_NO_ATTEMPTS,
  ok,
  recordChallanAudit,
} from "./helpers";

/**
 * Creates a Draft delivery challan against an approved sales order.
 *
 * NON-FINANCIAL: no invoice, ledger, balance, due, or collection side effects.
 */
export async function createDeliveryChallan(
  input: unknown,
): Promise<ActionResult<DeliveryChallanDetailDTO>> {
  let user;
  try {
    user = await requirePermission("orders:create");
  } catch {
    return fail<DeliveryChallanDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = createDeliveryChallanSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const data = parsed.data;
  assertChallanHasItems(data.items.length);

  for (let attempt = 0; attempt < MAX_CHALLAN_NO_ATTEMPTS; attempt += 1) {
    try {
      const challanId = await prisma.$transaction(async (tx) => {
        const order = await tx.salesOrder.findUnique({
          where: { id: data.orderId },
          select: {
            id: true,
            dealerCode: true,
            status: true,
            items: { select: { id: true, productId: true } },
          },
        });
        if (!order) {
          throw new ChallanActionError(
            "ORDER_NOT_FOUND",
            "challan.error.orderNotFound",
          );
        }

        assertCanCreateChallan(order.status);

        const orderItemById = new Map(
          order.items.map((item) => [item.id, item]),
        );

        const snapshots = await loadOrderLineSnapshots(tx, order.id);
        assertNotOverDelivery(snapshots, data.items);

        const challanNo = await generateNextChallanNo(tx);

        const challan = await tx.deliveryChallan.create({
          data: {
            challanNo,
            orderId: order.id,
            dealerCode: order.dealerCode,
            status: DeliveryChallanStatus.Draft,
            deliveryMode: data.deliveryMode,
            vehicleNo: data.vehicleNo,
            driverName: data.driverName,
            createdById: user.id,
            items: {
              create: data.items.map((line) => {
                const orderItem = orderItemById.get(line.orderItemId);
                if (!orderItem) {
                  throw new ChallanActionError(
                    "ORDER_ITEM_NOT_FOUND",
                    "challan.error.orderItemNotFound",
                    [
                      {
                        field: "items.orderItemId",
                        messageKey: "challan.error.orderItemNotFound",
                      },
                    ],
                  );
                }
                return {
                  orderItemId: line.orderItemId,
                  productId: orderItem.productId,
                  quantity: new Prisma.Decimal(line.quantity),
                };
              }),
            },
          },
          select: { id: true },
        });

        await recordChallanAudit(tx, {
          userId: user.id,
          challanId: challan.id,
          action: "DELIVERY_CHALLAN_CREATED",
          newValue: {
            challanNo,
            orderId: order.id,
            status: DeliveryChallanStatus.Draft,
            itemCount: data.items.length,
          },
        });

        return challan.id;
      });

      revalidatePath("/orders");
      revalidatePath(`/orders/${data.orderId}`);

      const detail = await loadChallanDetailDTO(challanId);
      if (!detail) {
        return fail<DeliveryChallanDetailDTO>(
          "CHALLAN_NOT_FOUND",
          "challan.error.notFound",
        );
      }
      return ok(detail);
    } catch (error) {
      if (error instanceof ChallanActionError) {
        return fail<DeliveryChallanDetailDTO>(
          error.code,
          error.messageKey,
          error.fieldErrors,
        );
      }
      if (error instanceof DeliveryWorkflowError) {
        return mapWorkflowError(error);
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < MAX_CHALLAN_NO_ATTEMPTS - 1
      ) {
        continue;
      }
      return fromPrismaError(error);
    }
  }

  return fail<DeliveryChallanDetailDTO>(
    "DUPLICATE_CHALLAN_NO",
    "challan.error.duplicateChallanNo",
  );
}
