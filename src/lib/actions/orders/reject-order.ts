"use server";

import { OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { assertCanReject, OrderWorkflowError } from "@/lib/orders/workflow";
import { rejectOrderSchema } from "@/lib/validators/order.schema";
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
 * Rejects a sales order.
 *
 * Rejection is an approval-authority decision (Manager / Super_Admin). An
 * already-approved order cannot be rejected (business rule); cancelled and
 * already-rejected orders are likewise blocked. The optional reason is captured
 * in the audit trail. Status advances to `Rejected` atomically with the audit
 * entry.
 */
export async function rejectOrder(
  input: unknown,
): Promise<ActionResult<OrderDetailDTO>> {
  let user;
  try {
    user = await requirePermission("orders:approve");
  } catch {
    return fail<OrderDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = rejectOrderSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id, reason } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.salesOrder.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw new OrderActionError("ORDER_NOT_FOUND", "order.error.notFound");
      }

      assertCanReject(existing.status);

      await tx.salesOrder.update({
        where: { id },
        data: { status: OrderStatus.Rejected },
      });

      await recordOrderAudit(tx, {
        userId: user.id,
        orderId: id,
        action: "REJECT",
        fromStatus: existing.status,
        toStatus: OrderStatus.Rejected,
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
