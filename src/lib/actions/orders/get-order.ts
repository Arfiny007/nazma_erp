"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { canAccessOrder } from "@/lib/rbac/territory";
import { orderIdentifierSchema } from "@/lib/validators/order.schema";
import type { ActionResult, OrderDetailDTO } from "@/types/order";

import {
  fail,
  fetchApprovalHistory,
  fromPrismaError,
  fromZodError,
  loadOrderFulfillmentProgress,
  ok,
  orderDetailInclude,
  toOrderDetailDTO,
} from "./helpers";

/**
 * Fetches a single sales order by `id` or `orderNo`, including its line items
 * and audit-derived approval history.
 *
 * Exactly one identifier is required; when both are supplied the `id` takes
 * precedence.
 */
export async function getOrder(
  input: unknown,
): Promise<ActionResult<OrderDetailDTO>> {
  let user;
  try {
    user = await requirePermission("orders:view");
  } catch {
    return fail<OrderDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = orderIdentifierSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id, orderNo } = parsed.data;

  try {
    const order = id
      ? await prisma.salesOrder.findUnique({
          where: { id },
          include: orderDetailInclude,
        })
      : await prisma.salesOrder.findUnique({
          where: { orderNo: orderNo! },
          include: orderDetailInclude,
        });

    if (!order) {
      return fail<OrderDetailDTO>("ORDER_NOT_FOUND", "order.error.notFound");
    }

    const allowed = await canAccessOrder(user.id, order.id);
    if (!allowed) {
      return fail<OrderDetailDTO>("FORBIDDEN", "rbac.territory.noAccess");
    }

    const history = await fetchApprovalHistory(order.id);
    const fulfillment = await loadOrderFulfillmentProgress(order.id);
    return ok(toOrderDetailDTO(order, history, fulfillment));
  } catch (error) {
    return fromPrismaError(error);
  }
}
