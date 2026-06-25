"use server";

import { Prisma } from "@prisma/client";

import {
  assertChallanConfirmedForInvoice,
  assertChallanHasItemsForInvoice,
  assertNoExistingInvoice,
  InvoiceWorkflowError,
} from "@/lib/invoices/workflow";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { buildInvoiceFromChallanLines } from "@/lib/utils/invoice-calculator";
import { previewInvoiceFromChallanSchema } from "@/lib/validators/invoice.schema";
import type { ActionResult, InvoicePreviewDTO } from "@/types/invoice";

import {
  fail,
  fromPrismaError,
  fromZodError,
  mapInvoiceWorkflowError,
  ok,
} from "./helpers";

/**
 * Computes a read-only financial preview for issuing an invoice from a challan.
 * All monetary values originate from the server Decimal engine — never the client.
 */
export async function previewInvoiceFromChallan(
  input: unknown,
): Promise<ActionResult<InvoicePreviewDTO>> {
  try {
    await requirePermission("invoices:create");
  } catch {
    return fail<InvoicePreviewDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = previewInvoiceFromChallanSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { deliveryChallanId } = parsed.data;

  try {
    const challan = await prisma.deliveryChallan.findUnique({
      where: { id: deliveryChallanId },
      select: {
        id: true,
        challanNo: true,
        orderId: true,
        dealerCode: true,
        status: true,
        invoice: { select: { id: true } },
        order: { select: { orderNo: true } },
        dealer: { select: { companyName: true, currentBalance: true } },
        items: {
          include: {
            orderItem: {
              select: {
                id: true,
                quantity: true,
                unitPrice: true,
                discount: true,
              },
            },
            product: {
              select: { id: true, sku: true, name: true, unit: true },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!challan) {
      return fail<InvoicePreviewDTO>(
        "CHALLAN_NOT_FOUND",
        "invoice.error.challanNotFound",
      );
    }

    try {
      assertChallanConfirmedForInvoice(challan.status);
      assertNoExistingInvoice(challan.invoice !== null);
      assertChallanHasItemsForInvoice(challan.items.length);
    } catch (error) {
      if (error instanceof InvoiceWorkflowError) {
        return mapInvoiceWorkflowError(error);
      }
      throw error;
    }

    const lines = challan.items.map((item) => ({
      challanItemId: item.id,
      orderItemId: item.orderItem.id,
      productId: item.product.id,
      productCode: item.product.sku,
      productName: item.product.name,
      unit: item.product.unit,
      challanQuantity: item.quantity,
      orderItemQuantity: item.orderItem.quantity,
      orderItemUnitPrice: item.orderItem.unitPrice,
      orderItemDiscount: item.orderItem.discount,
    }));

    const { snapshots, totals } = buildInvoiceFromChallanLines(lines);
    const previousDue = challan.dealer.currentBalance;
    const grandTotal = totals.grandTotal;
    const currentDue = previousDue.plus(grandTotal);

    return ok({
      challanId: challan.id,
      challanNo: challan.challanNo,
      orderId: challan.orderId,
      orderNo: challan.order.orderNo,
      dealerCode: challan.dealerCode,
      dealerName: challan.dealer.companyName,
      subtotal: totals.subtotal.toFixed(2),
      discount: totals.discountAmount.toFixed(2),
      vat: new Prisma.Decimal(0).toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      previousDue: previousDue.toFixed(2),
      currentDue: currentDue.toFixed(2),
      lines: snapshots.map((line) => ({
        productCode: line.productCode,
        productName: line.productName,
        unit: line.unit,
        quantity: line.quantity.toFixed(2),
        unitPrice: line.unitPrice.toFixed(2),
        discount: line.discount.toFixed(2),
        lineTotal: line.lineTotal.toFixed(2),
      })),
    });
  } catch (error) {
    return fromPrismaError(error);
  }
}
