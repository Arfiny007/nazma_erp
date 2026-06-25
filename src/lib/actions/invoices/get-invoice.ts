"use server";

import { requirePermission } from "@/lib/rbac/guards";
import { invoiceIdentifierSchema } from "@/lib/validators/invoice.schema";
import type { ActionResult, InvoiceDetailDTO } from "@/types/invoice";

import {
  fail,
  fromPrismaError,
  fromZodError,
  loadInvoiceDetailDTO,
  ok,
} from "./helpers";

/**
 * Returns a single invoice with immutable line-item snapshots.
 */
export async function getInvoice(
  input: unknown,
): Promise<ActionResult<InvoiceDetailDTO>> {
  try {
    await requirePermission("invoices:view");
  } catch {
    return fail<InvoiceDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = invoiceIdentifierSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const detail = await loadInvoiceDetailDTO(parsed.data.id);
    if (!detail) {
      return fail<InvoiceDetailDTO>("INVOICE_NOT_FOUND", "invoice.error.notFound");
    }
    return ok(detail);
  } catch (error) {
    return fromPrismaError(error);
  }
}
