"use server";

import { OrderStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import {
  assertCanChangeStatusOnUpdate,
  assertEditable,
  OrderWorkflowError,
} from "@/lib/orders/workflow";
import {
  calculateOrderTotals,
  findInvalidLineIndex,
} from "@/lib/utils/order-calculator";
import { updateOrderSchema } from "@/lib/validators/order.schema";
import type { ActionResult, OrderDetailDTO } from "@/types/order";

import {
  buildLineInputs,
  fail,
  fromPrismaError,
  fromZodError,
  loadOrderDetailDTO,
  OrderActionError,
  ok,
  recordOrderAudit,
  resolveProjectId,
} from "./helpers";

/**
 * Updates an existing sales order.
 *
 * Approved orders remain editable (Manager / Super_Admin); only a cancelled
 * order is locked. When line items are supplied the order is fully re-priced
 * (Decimal-safe) and its totals recalculated. The dealer/project/items mutation
 * and the audit-log entry are atomic within a single transaction. Status may
 * only move along the Draft ↔ Pending_Approval edges here; Approve/Reject/
 * Cancel are dedicated actions.
 */
export async function updateOrder(
  input: unknown,
): Promise<ActionResult<OrderDetailDTO>> {
  let user;
  try {
    user = await requirePermission("orders:edit");
  } catch {
    return fail<OrderDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = updateOrderSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id, ...changes } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.salesOrder.findUnique({
        where: { id },
        select: { id: true, dealerCode: true, status: true },
      });
      if (!existing) {
        throw new OrderActionError("ORDER_NOT_FOUND", "order.error.notFound");
      }

      assertEditable(existing.status);

      const updateData: Prisma.SalesOrderUncheckedUpdateInput = {};

      const touchesDealerOrProject =
        changes.dealerCode !== undefined ||
        changes.projectId !== undefined ||
        changes.project !== undefined;

      let dealerId: string | null = null;
      if (touchesDealerOrProject) {
        const effectiveDealerCode = changes.dealerCode ?? existing.dealerCode;
        const dealer = await tx.dealer.findUnique({
          where: { dealerCode: effectiveDealerCode },
          select: { id: true, isActive: true },
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
        dealerId = dealer.id;

        if (changes.dealerCode !== undefined) {
          updateData.dealerCode = changes.dealerCode;
        }
      }

      if (changes.project) {
        updateData.projectId = await resolveProjectId(tx, dealerId!, {
          project: changes.project,
        });
      } else if (changes.projectId !== undefined) {
        updateData.projectId =
          changes.projectId === null
            ? null
            : await resolveProjectId(tx, dealerId!, {
                projectId: changes.projectId,
              });
      }

      if (changes.items) {
        const lineInputs = await buildLineInputs(tx, changes.items);
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

        updateData.subtotal = totals.subtotal;
        updateData.discount = totals.discountAmount;
        updateData.vat = totals.vat;
        updateData.grandTotal = totals.grandTotal;
        updateData.items = {
          deleteMany: {},
          create: changes.items.map((item, idx) => ({
            productId: item.productId,
            quantity: totals.lines[idx].quantity,
            unitPrice: totals.lines[idx].unitPrice,
            discount: totals.lines[idx].discount,
            total: totals.lines[idx].total,
          })),
        };
      }

      let nextStatus = existing.status;
      if (changes.status !== undefined && changes.status !== existing.status) {
        assertCanChangeStatusOnUpdate(existing.status, changes.status);
        updateData.status = changes.status;
        nextStatus = changes.status;
      }

      await tx.salesOrder.update({ where: { id }, data: updateData });

      await recordOrderAudit(tx, {
        userId: user.id,
        orderId: id,
        action:
          nextStatus === OrderStatus.Pending_Approval &&
          existing.status !== OrderStatus.Pending_Approval
            ? "SUBMIT"
            : "UPDATE",
        fromStatus: existing.status,
        toStatus: nextStatus,
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
      return fail<OrderDetailDTO>(
        error.code,
        error.messageKey,
        error.fieldErrors,
      );
    }
    if (error instanceof OrderWorkflowError) {
      return fail<OrderDetailDTO>(error.code, error.messageKey);
    }
    return fromPrismaError(error);
  }
}
