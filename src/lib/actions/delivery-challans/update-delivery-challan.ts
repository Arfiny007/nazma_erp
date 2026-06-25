"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  assertCanUpdateChallan,
  assertChallanHasItems,
  assertNotOverDelivery,
  DeliveryWorkflowError,
} from "@/lib/delivery/workflow";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { updateDeliveryChallanSchema } from "@/lib/validators/delivery-challan.schema";
import type { ActionResult, DeliveryChallanDetailDTO } from "@/types/delivery-challan";

import {
  ChallanActionError,
  fail,
  fromPrismaError,
  fromZodError,
  loadChallanDetailDTO,
  loadOrderLineSnapshots,
  mapWorkflowError,
  ok,
  recordChallanAudit,
} from "./helpers";

/**
 * Updates a Draft delivery challan (lines + logistics fields).
 *
 * NON-FINANCIAL: no invoice, ledger, balance, due, or collection side effects.
 */
export async function updateDeliveryChallan(
  input: unknown,
): Promise<ActionResult<DeliveryChallanDetailDTO>> {
  let user;
  try {
    user = await requirePermission("orders:edit");
  } catch {
    return fail<DeliveryChallanDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = updateDeliveryChallanSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const data = parsed.data;
  assertChallanHasItems(data.items.length);

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.deliveryChallan.findUnique({
        where: { id: data.id },
        select: {
          id: true,
          orderId: true,
          status: true,
          order: {
            select: {
              status: true,
              items: { select: { id: true, productId: true } },
            },
          },
        },
      });
      if (!existing) {
        throw new ChallanActionError(
          "CHALLAN_NOT_FOUND",
          "challan.error.notFound",
        );
      }

      assertCanUpdateChallan(existing.status);

      const orderItemById = new Map(
        existing.order.items.map((item) => [item.id, item]),
      );

      const snapshots = await loadOrderLineSnapshots(
        tx,
        existing.orderId,
        existing.id,
      );
      assertNotOverDelivery(snapshots, data.items);

      await tx.deliveryChallanItem.deleteMany({
        where: { challanId: existing.id },
      });

      await tx.deliveryChallan.update({
        where: { id: existing.id },
        data: {
          deliveryMode: data.deliveryMode,
          vehicleNo: data.vehicleNo,
          driverName: data.driverName,
          remarks: data.remarks,
          items: {
            create: data.items.map((line) => {
              const orderItem = orderItemById.get(line.orderItemId);
              if (!orderItem) {
                throw new ChallanActionError(
                  "ORDER_ITEM_NOT_FOUND",
                  "challan.error.orderItemNotFound",
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
      });

      await recordChallanAudit(tx, {
        userId: user.id,
        challanId: existing.id,
        action: "DELIVERY_CHALLAN_UPDATED",
        newValue: {
          status: existing.status,
          itemCount: data.items.length,
        },
      });
    });

    const detail = await loadChallanDetailDTO(data.id);
    if (!detail) {
      return fail<DeliveryChallanDetailDTO>(
        "CHALLAN_NOT_FOUND",
        "challan.error.notFound",
      );
    }

    revalidatePath("/orders");
    revalidatePath(`/orders/${detail.orderId}`);
    revalidatePath("/delivery-challans");
    revalidatePath(`/delivery-challans/${detail.id}`);

    return ok(detail);
  } catch (error) {
    if (error instanceof ChallanActionError) {
      return fail<DeliveryChallanDetailDTO>(error.code, error.messageKey);
    }
    if (error instanceof DeliveryWorkflowError) {
      return mapWorkflowError(error);
    }
    return fromPrismaError(error);
  }
}
