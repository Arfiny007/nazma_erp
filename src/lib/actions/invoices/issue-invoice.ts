"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { executeIssueInvoiceTransaction } from "@/lib/invoices/issue-invoice-transaction";
import { InvoiceWorkflowError } from "@/lib/invoices/workflow";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { issueInvoiceSchema } from "@/lib/validators/invoice.schema";
import type { ActionResult, InvoiceDetailDTO } from "@/types/invoice";

import {
  fail,
  fromPrismaError,
  fromZodError,
  InvoiceActionError,
  loadInvoiceDetailDTO,
  mapInvoiceWorkflowError,
  MAX_INVOICE_NO_ATTEMPTS,
  ok,
} from "./helpers";

function isDeliveryChallanUniqueViolation(error: Prisma.PrismaClientKnownRequestError): boolean {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((field) => String(field).includes("deliveryChallanId"));
  }
  if (typeof target === "string") {
    return target.includes("deliveryChallanId");
  }
  return false;
}

async function resolveExistingInvoiceIdForChallan(
  deliveryChallanId: string,
): Promise<string | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { deliveryChallanId },
    select: { id: true },
  });
  return invoice?.id ?? null;
}

/**
 * Issues a financial invoice from a Confirmed delivery challan.
 *
 * One challan → exactly one invoice. Quantities come from challan lines only.
 * Dealer balance is updated exclusively through the Financial Posting Service.
 *
 * Idempotent: duplicate submission for the same challan returns the existing invoice.
 */
export async function issueInvoice(
  input: unknown,
): Promise<ActionResult<InvoiceDetailDTO>> {
  let user;
  try {
    user = await requirePermission("invoices:create");
  } catch {
    return fail<InvoiceDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = issueInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { deliveryChallanId } = parsed.data;

  try {
    let createdInvoiceId: string | null = null;

    for (let attempt = 0; attempt < MAX_INVOICE_NO_ATTEMPTS; attempt += 1) {
      try {
        createdInvoiceId = await prisma.$transaction((tx) =>
          executeIssueInvoiceTransaction(tx, {
            deliveryChallanId,
            userId: user.id,
          }),
        );
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          if (isDeliveryChallanUniqueViolation(error)) {
            const existingId = await resolveExistingInvoiceIdForChallan(deliveryChallanId);
            if (existingId) {
              createdInvoiceId = existingId;
              break;
            }
          }
          if (attempt < MAX_INVOICE_NO_ATTEMPTS - 1) {
            continue;
          }
        }
        throw error;
      }
    }

    if (!createdInvoiceId) {
      return fail<InvoiceDetailDTO>(
        "DUPLICATE_INVOICE_NO",
        "invoice.error.duplicateInvoiceNo",
      );
    }

    const detail = await loadInvoiceDetailDTO(createdInvoiceId);
    if (!detail) {
      return fail<InvoiceDetailDTO>("INVOICE_NOT_FOUND", "invoice.error.notFound");
    }

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${detail.id}`);
    revalidatePath("/delivery-challans");
    revalidatePath(`/delivery-challans/${deliveryChallanId}`);
    revalidatePath("/orders");
    revalidatePath(`/orders/${detail.orderId}`);
    revalidatePath("/dealers");

    return ok(detail);
  } catch (error) {
    if (error instanceof InvoiceActionError) {
      return fail<InvoiceDetailDTO>(error.code, error.messageKey);
    }
    if (error instanceof InvoiceWorkflowError) {
      return mapInvoiceWorkflowError(error);
    }
    return fromPrismaError(error);
  }
}
