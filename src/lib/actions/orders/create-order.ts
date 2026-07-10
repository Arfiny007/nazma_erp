"use server";

import { OrderStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { canAccessDealerByCode } from "@/lib/rbac/territory";
import {
  calculateOrderTotals,
  findInvalidLineIndex,
} from "@/lib/utils/order-calculator";
import { generateNextOrderNo } from "@/lib/utils/order-number";
import { createOrderSchema } from "@/lib/validators/order.schema";
import type { ActionResult, OrderDetailDTO } from "@/types/order";

import {
  buildLineInputs,
  fail,
  fromPrismaError,
  fromZodError,
  loadOrderDetailDTO,
  MAX_ORDER_NO_ATTEMPTS,
  OrderActionError,
  ok,
  recordOrderAudit,
  resolveProjectId,
} from "./helpers";

/**
 * Creates a new sales order.
 *
 * The entire creation runs inside a single Prisma transaction: dealer / project
 * / product validation, optional inline project creation, Decimal-safe total
 * calculation, order-number generation, order + line-item persistence, and the
 * audit-log entry are all atomic. The unique constraint on `orderNo` is the
 * final guard against concurrent inserts, so the operation retries a bounded
 * number of times on a collision.
 *
 * VAT is already included in the product price, so the calculated `vat` is
 * always `0.00`.
 */
export async function createOrder(
  input: unknown,
): Promise<ActionResult<OrderDetailDTO>> {
  let user;
  try {
    user = await requirePermission("orders:create");
  } catch {
    return fail<OrderDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const data = parsed.data;

  for (let attempt = 0; attempt < MAX_ORDER_NO_ATTEMPTS; attempt += 1) {
    try {
      const orderId = await prisma.$transaction(async (tx) => {
        const dealer = await tx.dealer.findUnique({
          where: { dealerCode: data.dealerCode },
          select: { id: true, dealerCode: true, isActive: true },
        });
        if (!dealer) {
          throw new OrderActionError(
            "DEALER_NOT_FOUND",
            "order.error.dealerNotFound",
            [{ field: "dealerCode", messageKey: "order.error.dealerNotFound" }],
          );
        }
        if (!dealer.isActive) {
          throw new OrderActionError(
            "INACTIVE_DEALER",
            "order.error.inactiveDealer",
            [{ field: "dealerCode", messageKey: "order.error.inactiveDealer" }],
          );
        }

        const territoryAllowed = await canAccessDealerByCode(user.id, dealer.dealerCode);
        if (!territoryAllowed) {
          throw new OrderActionError(
            "FORBIDDEN",
            "rbac.territory.noAccess",
            [{ field: "dealerCode", messageKey: "rbac.territory.noAccess" }],
          );
        }

        const projectId = await resolveProjectId(tx, dealer.id, data);

        const lineInputs = await buildLineInputs(tx, data.items);

        const totals = calculateOrderTotals(lineInputs);
        const invalidIndex = findInvalidLineIndex(totals);
        if (invalidIndex >= 0) {
          throw new OrderActionError("VALIDATION_ERROR", "validation.failed", [
            {
              field: `items.${invalidIndex}.discount`,
              messageKey: "validation.discount.exceedsLine",
            },
          ]);
        }

        const orderNo = await generateNextOrderNo(tx);

        const order = await tx.salesOrder.create({
          data: {
            orderNo,
            dealerCode: dealer.dealerCode,
            projectId,
            status: data.status,
            subtotal: totals.subtotal,
            discount: totals.discountAmount,
            vat: totals.vat,
            grandTotal: totals.grandTotal,
            createdById: user.id,
            items: {
              create: data.items.map((item, idx) => ({
                productId: item.productId,
                quantity: totals.lines[idx].quantity,
                unitPrice: totals.lines[idx].unitPrice,
                discount: totals.lines[idx].discount,
                total: totals.lines[idx].total,
              })),
            },
          },
          select: { id: true },
        });

        await recordOrderAudit(tx, {
          userId: user.id,
          orderId: order.id,
          action:
            data.status === OrderStatus.Pending_Approval ? "SUBMIT" : "CREATE",
          toStatus: data.status,
        });

        return order.id;
      });

      revalidatePath("/orders");
      const detail = await loadOrderDetailDTO(orderId);
      if (!detail) {
        return fail<OrderDetailDTO>("ORDER_NOT_FOUND", "order.error.notFound");
      }
      return ok(detail);
    } catch (error) {
      if (error instanceof OrderActionError) {
        return fail<OrderDetailDTO>(
          error.code,
          error.messageKey,
          error.fieldErrors,
        );
      }
      if (isOrderNoCollision(error)) {
        continue;
      }
      return fromPrismaError(error);
    }
  }

  return fail<OrderDetailDTO>(
    "DUPLICATE_ORDER_NO",
    "order.error.orderNoGenerationFailed",
  );
}

function isOrderNoCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((value) => String(value).includes("orderNo"));
  }
  return typeof target === "string" && target.includes("orderNo");
}
