"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { computeDeliveryPercentClient } from "@/lib/delivery/quantity-client";
import type { ActionResult, ChallanDetailLineDTO } from "@/types/delivery-challan";

import {
  fail,
  fromPrismaError,
  fromZodError,
  loadOrderLineSnapshots,
  ok,
} from "./helpers";

const schema = z.object({
  challanId: z.uuid({ error: "validation.id.invalid" }),
});

/**
 * Builds enriched per-line fulfillment rows for the challan detail product
 * table (ordered / delivered previously / current / remaining).
 */
export async function getChallanDetailLines(
  input: unknown,
): Promise<ActionResult<ChallanDetailLineDTO[]>> {
  try {
    await requirePermission("orders:view");
  } catch {
    return fail<ChallanDetailLineDTO[]>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { challanId } = parsed.data;

  try {
    const challan = await prisma.deliveryChallan.findUnique({
      where: { id: challanId },
      select: {
        orderId: true,
        items: {
          select: {
            orderItemId: true,
            productId: true,
            quantity: true,
            product: {
              select: {
                name: true,
                sku: true,
                modelNumber: true,
                unit: true,
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!challan) {
      return fail<ChallanDetailLineDTO[]>(
        "CHALLAN_NOT_FOUND",
        "challan.error.notFound",
      );
    }

    const snapshots = await loadOrderLineSnapshots(prisma, challan.orderId);
    const snapshotByItemId = new Map(
      snapshots.map((snapshot) => [snapshot.orderItemId, snapshot]),
    );

    const challanQtyByItem = new Map(
      challan.items.map((item) => [
        item.orderItemId,
        item.quantity.toFixed(2),
      ]),
    );

    const allOrderItemIds = new Set([
      ...snapshots.map((s) => s.orderItemId),
      ...challan.items.map((i) => i.orderItemId),
    ]);

    const lines: ChallanDetailLineDTO[] = [];

    for (const orderItemId of allOrderItemIds) {
      const snapshot = snapshotByItemId.get(orderItemId);
      const challanItem = challan.items.find(
        (item) => item.orderItemId === orderItemId,
      );

      if (!snapshot && !challanItem) {
        continue;
      }

      const ordered = snapshot?.orderedQuantity ?? "0.00";
      const deliveredPreviously = snapshot?.confirmedDeliveredQuantity ?? "0.00";
      const currentDelivery = challanQtyByItem.get(orderItemId) ?? "0.00";
      const remaining = snapshot
        ? (
            Number.parseFloat(ordered) -
            Number.parseFloat(deliveredPreviously)
          ).toFixed(2)
        : "0.00";

      const product = challanItem?.product;
      const fulfillmentLine = snapshots.find(
        (s) => s.orderItemId === orderItemId,
      );

      lines.push({
        orderItemId,
        productId: challanItem?.productId ?? fulfillmentLine?.productId ?? "",
        productName:
          product?.name ?? fulfillmentLine?.productName ?? "",
        productSku: product?.sku ?? fulfillmentLine?.productSku ?? "",
        productModelNumber: product?.modelNumber ?? "",
        unit: product?.unit ?? "",
        orderedQuantity: ordered,
        deliveredPreviously,
        currentDelivery,
        remainingQuantity: Math.max(0, Number.parseFloat(remaining)).toFixed(2),
        deliveryPercent: computeDeliveryPercentClient(
          deliveredPreviously,
          ordered,
        ),
      });
    }

    return ok(lines);
  } catch (error) {
    return fromPrismaError(error);
  }
}
