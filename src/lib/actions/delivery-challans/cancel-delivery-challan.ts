"use server";

import { DeliveryChallanStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  assertCanCancelChallan,
  DeliveryWorkflowError,
} from "@/lib/delivery/workflow";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { cancelDeliveryChallanSchema } from "@/lib/validators/delivery-challan.schema";
import type { ActionResult, DeliveryChallanDetailDTO } from "@/types/delivery-challan";

import {
  ChallanActionError,
  fail,
  fromPrismaError,
  fromZodError,
  loadChallanDetailDTO,
  mapWorkflowError,
  ok,
  recordChallanAudit,
} from "./helpers";

/**
 * Cancels a Draft delivery challan, releasing its draft quantity reservation.
 *
 * NON-FINANCIAL: no invoice, ledger, balance, due, or collection side effects.
 */
export async function cancelDeliveryChallan(
  input: unknown,
): Promise<ActionResult<DeliveryChallanDetailDTO>> {
  let user;
  try {
    user = await requirePermission("orders:edit");
  } catch {
    return fail<DeliveryChallanDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = cancelDeliveryChallanSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.deliveryChallan.findUnique({
        where: { id },
        select: { id: true, orderId: true, status: true },
      });
      if (!existing) {
        throw new ChallanActionError(
          "CHALLAN_NOT_FOUND",
          "challan.error.notFound",
        );
      }

      assertCanCancelChallan(existing.status);

      await tx.deliveryChallan.update({
        where: { id },
        data: { status: DeliveryChallanStatus.Cancelled },
      });

      await recordChallanAudit(tx, {
        userId: user.id,
        challanId: id,
        action: "DELIVERY_CHALLAN_CANCELLED",
        oldValue: { status: existing.status },
        newValue: { status: DeliveryChallanStatus.Cancelled },
      });
    });

    const detail = await loadChallanDetailDTO(id);
    if (!detail) {
      return fail<DeliveryChallanDetailDTO>(
        "CHALLAN_NOT_FOUND",
        "challan.error.notFound",
      );
    }

    revalidatePath("/orders");
    revalidatePath(`/orders/${detail.orderId}`);
    revalidatePath("/delivery-challans");
    revalidatePath(`/delivery-challans/${detail.id}`);

    return ok(detail);
  } catch (error) {
    if (error instanceof ChallanActionError) {
      return fail<DeliveryChallanDetailDTO>(error.code, error.messageKey);
    }
    if (error instanceof DeliveryWorkflowError) {
      return mapWorkflowError(error);
    }
    return fromPrismaError(error);
  }
}
