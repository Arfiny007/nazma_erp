"use server";

import { DeliveryChallanStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { listInvoiceEligibleChallansSchema } from "@/lib/validators/invoice.schema";
import type { ActionResult, InvoiceEligibleChallanDTO } from "@/types/invoice";

import { challanSummaryInclude } from "../delivery-challans/helpers";
import { fail, fromPrismaError, fromZodError, ok } from "./helpers";

/**
 * Returns confirmed delivery challans that have not yet been invoiced.
 * Used by the Issue Invoice workflow picker.
 */
export async function listInvoiceEligibleChallans(
  input: unknown = {},
): Promise<ActionResult<InvoiceEligibleChallanDTO[]>> {
  try {
    await requirePermission("invoices:create");
  } catch {
    return fail<InvoiceEligibleChallanDTO[]>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = listInvoiceEligibleChallansSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { search, limit } = parsed.data;

  try {
    const challans = await prisma.deliveryChallan.findMany({
      where: {
        status: DeliveryChallanStatus.Confirmed,
        invoice: null,
        ...(search
          ? {
              OR: [
                { challanNo: { contains: search, mode: "insensitive" } },
                { dealerCode: { contains: search, mode: "insensitive" } },
                { order: { orderNo: { contains: search, mode: "insensitive" } } },
                {
                  dealer: { companyName: { contains: search, mode: "insensitive" } },
                },
              ],
            }
          : {}),
      },
      include: challanSummaryInclude,
      orderBy: { dispatchedAt: "desc" },
      take: limit,
    });

    return ok(
      challans.map((challan) => {
        const totalQuantity = challan.items.reduce(
          (sum, item) => sum.plus(item.quantity),
          new Prisma.Decimal(0),
        );
        return {
          id: challan.id,
          challanNo: challan.challanNo,
          orderId: challan.orderId,
          orderNo: challan.order.orderNo,
          dealerCode: challan.dealerCode,
          dealerName: challan.dealer.companyName,
          itemCount: challan.items.length,
          totalQuantity: totalQuantity.toFixed(2),
          dispatchedAt: challan.dispatchedAt?.toISOString() ?? null,
        };
      }),
    );
  } catch (error) {
    return fromPrismaError(error);
  }
}
