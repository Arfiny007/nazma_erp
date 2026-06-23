"use server";

import { OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { assertCanCancel, OrderWorkflowError } from "@/lib/orders/workflow";
import { cancelOrderSchema } from "@/lib/validators/order.schema";
import type { ActionResult, OrderDetailDTO } from "@/types/order";

import {
  fail,
  fromPrismaError,
  fromZodError,
  loadOrderDetailDTO,
  OrderActionError,
  ok,
  recordOrderAudit,
} from "./helpers";

/**
 * Cancels a sales order.
 *
 * Cancellation is a modification-authority action (Manager / Super_Admin). An
 * order that has already generated one or more invoices cannot be cancelled
 * (business rule: "cannot cancel invoiced order"); an already-cancelled order
 * is blocked. The optional reason is captured in the audit trail. Status
 * advances to `Cancelled` atomically with the audit entry.
 */
export async function cancelOrder(
  input: unknown,
): Promise<ActionResult<OrderDetailDTO>> {
  let user;
  try {
    user = await requirePermission("orders:edit");
  } catch {
    return fail<OrderDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id, reason } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.salesOrder.findUnique({
        where: { id },
        select: { id: true, status: true, _count: { select: { invoices: true } } },
      });
      if (!existing) {
        throw new OrderActionError("ORDER_NOT_FOUND", "order.error.notFound");
      }

      assertCanCancel(existing.status, existing._count.invoices);

      await tx.salesOrder.update({
        where: { id },
        data: { status: OrderStatus.Cancelled },
      });

      await recordOrderAudit(tx, {
        userId: user.id,
        orderId: id,
        action: "CANCEL",
        fromStatus: existing.status,
        toStatus: OrderStatus.Cancelled,
        remarks: reason,
      });
    });

    revalidatePath("/orders");
    revalidatePath(`/orders/${id}`);

    const detail = await loadOrderDetailDTO(id);
    if (!detail) {
      return fail<OrderDetailDTO>("ORDER_NOT_FOUND", "order.error.notFound");
    }
    return ok(detail);
  } catch (error) {
    if (error instanceof OrderActionError) {
      return fail<OrderDetailDTO>(error.code, error.messageKey);
    }
    if (error instanceof OrderWorkflowError) {
      return fail<OrderDetailDTO>(error.code, error.messageKey);
    }
    return fromPrismaError(error);
  }
}
