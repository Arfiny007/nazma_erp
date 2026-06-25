"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { deliveryChallanIdentifierSchema } from "@/lib/validators/delivery-challan.schema";
import type { ActionResult, DeliveryChallanDetailDTO } from "@/types/delivery-challan";

import {
  challanDetailInclude,
  fail,
  fetchChallanHistory,
  fromPrismaError,
  fromZodError,
  ok,
  toChallanDetailDTO,
} from "./helpers";

/**
 * Fetches a single delivery challan by `id` or `challanNo`.
 */
export async function getDeliveryChallan(
  input: unknown,
): Promise<ActionResult<DeliveryChallanDetailDTO>> {
  try {
    await requirePermission("orders:view");
  } catch {
    return fail<DeliveryChallanDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = deliveryChallanIdentifierSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id, challanNo } = parsed.data;

  try {
    const challan = id
      ? await prisma.deliveryChallan.findUnique({
          where: { id },
          include: challanDetailInclude,
        })
      : await prisma.deliveryChallan.findUnique({
          where: { challanNo: challanNo! },
          include: challanDetailInclude,
        });

    if (!challan) {
      return fail<DeliveryChallanDetailDTO>(
        "CHALLAN_NOT_FOUND",
        "challan.error.notFound",
      );
    }

    const auditHistory = await fetchChallanHistory(challan.id);
    return ok(toChallanDetailDTO(challan, auditHistory));
  } catch (error) {
    return fromPrismaError(error);
  }
}
