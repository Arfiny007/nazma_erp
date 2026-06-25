"use server";

import { z } from "zod";

import {
  computeAllocatableQuantity,
  computeRemainingQuantity,
} from "@/lib/delivery/workflow";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import type {
  ActionResult,
  OrderChallanContextDTO,
  OrderChallanLineContextDTO,
} from "@/types/delivery-challan";

import {
  buildFulfillmentProgress,
  countChallansForOrder,
  fail,
  fromPrismaError,
  fromZodError,
  loadOrderLineSnapshots,
  ok,
} from "./helpers";

const getOrderChallanContextSchema = z.object({
  orderId: z.uuid({ error: "validation.id.invalid" }),
  excludeChallanId: z.uuid({ error: "validation.id.invalid" }).optional(),
});

/**
 * Loads order header + per-line quantity context for challan create / edit
 * forms. All allocatable quantities are computed server-side.
 */
export async function getOrderChallanContext(
  input: unknown,
): Promise<ActionResult<OrderChallanContextDTO>> {
  try {
    await requirePermission("orders:view");
  } catch {
    return fail<OrderChallanContextDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = getOrderChallanContextSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { orderId, excludeChallanId } = parsed.data;

  try {
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNo: true,
        status: true,
        dealerCode: true,
        dealer: { select: { companyName: true } },
        items: {
          select: {
            id: true,
            product: {
              select: { modelNumber: true, unit: true },
            },
          },
        },
      },
    });

    if (!order) {
      return fail<OrderChallanContextDTO>(
        "ORDER_NOT_FOUND",
        "challan.error.orderNotFound",
      );
    }

    const snapshots = await loadOrderLineSnapshots(
      prisma,
      orderId,
      excludeChallanId,
    );
    const challanCounts = await countChallansForOrder(prisma, orderId);
    const fulfillment = buildFulfillmentProgress(
      orderId,
      snapshots,
      challanCounts,
    );

    const productMeta = new Map(
      order.items.map((item) => [
        item.id,
        { modelNumber: item.product.modelNumber, unit: item.product.unit },
      ]),
    );

    const lines: OrderChallanLineContextDTO[] = snapshots.map((snapshot) => {
      const ordered = snapshot.orderedQuantity;
      const confirmed = snapshot.confirmedDeliveredQuantity;
      const draft = snapshot.draftDeliveredQuantity;
      const remaining = computeRemainingQuantity(ordered, confirmed);
      const allocatable = computeAllocatableQuantity(ordered, confirmed, draft);
      const orderedNum = Number.parseFloat(ordered);
      const deliveredNum = Number.parseFloat(confirmed);
      const deliveryPercent =
        orderedNum > 0
          ? ((deliveredNum / orderedNum) * 100).toFixed(2)
          : "0.00";
      const meta = productMeta.get(snapshot.orderItemId);

      return {
        orderItemId: snapshot.orderItemId,
        productId: snapshot.productId,
        productName: snapshot.productName,
        productSku: snapshot.productSku,
        productModelNumber: meta?.modelNumber ?? "",
        unit: meta?.unit ?? "",
        orderedQuantity: ordered,
        deliveredQuantity: confirmed,
        draftQuantity: draft,
        remainingQuantity: remaining.toFixed(2),
        allocatableQuantity: allocatable.toFixed(2),
        deliveryPercent,
      };
    });

    return ok({
      orderId: order.id,
      orderNo: order.orderNo,
      dealerCode: order.dealerCode,
      dealerName: order.dealer.companyName,
      status: order.status,
      lines,
      fulfillment,
    });
  } catch (error) {
    return fromPrismaError(error);
  }
}
