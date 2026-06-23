"use server";

import { OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { assertCanApprove, OrderWorkflowError } from "@/lib/orders/workflow";
import { approveOrderSchema } from "@/lib/validators/order.schema";
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
 * Approves a sales order.
 *
 * Manager and Super_Admin may approve (Super_Admin can override a prior
 * rejection). The approval stamps `approvedById` / `approvedAt`, advances the
 * status to `Approved`, and records an audit entry — all atomically. A
 * cancelled order cannot be approved, and an already-approved order is rejected
 * as a no-op error.
 */
export async function approveOrder(
  input: unknown,
): Promise<ActionResult<OrderDetailDTO>> {
  let user;
  try {
    user = await requirePermission("orders:approve");
  } catch {
    return fail<OrderDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = approveOrderSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.salesOrder.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw new OrderActionError("ORDER_NOT_FOUND", "order.error.notFound");
      }

      assertCanApprove(existing.status);

      await tx.salesOrder.update({
        where: { id },
        data: {
          status: OrderStatus.Approved,
          approvedById: user.id,
          approvedAt: new Date(),
        },
      });

      await recordOrderAudit(tx, {
        userId: user.id,
        orderId: id,
        action: "APPROVE",
        fromStatus: existing.status,
        toStatus: OrderStatus.Approved,
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
