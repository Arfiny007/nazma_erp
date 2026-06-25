import { InvoiceStatus, Prisma } from "@prisma/client";

import { lockDealerForFinancialUpdate } from "@/lib/finance/dealer-lock";
import { FINANCIAL_REFERENCE_INVOICE } from "@/lib/finance/types";
import { postReceivableIncrease } from "@/lib/finance/posting-service";
import {
  assertChallanConfirmedForInvoice,
  assertChallanHasItemsForInvoice,
  InvoiceWorkflowError,
} from "@/lib/invoices/workflow";
import { buildInvoiceFromChallanLines } from "@/lib/utils/invoice-calculator";
import { generateNextInvoiceNo } from "@/lib/utils/invoice-number";
import { wouldExceedCreditLimit } from "@/lib/utils/credit-limit";
import { INVOICE_DEFAULT_DUE_DAYS } from "@/types/invoice";

import {
  addDays,
  InvoiceActionError,
  recordInvoiceAudit,
  ZERO_MONEY,
} from "@/lib/actions/invoices/helpers";

export interface IssueInvoiceTransactionInput {
  deliveryChallanId: string;
  userId: string;
}

/**
 * Core invoice issue transaction — dealer lock, idempotent challan check,
 * credit validation, invoice persistence, and financial posting.
 *
 * Caller must wrap in `prisma.$transaction`. All steps share one transaction
 * boundary; rollback on any failure.
 */
export async function executeIssueInvoiceTransaction(
  tx: Prisma.TransactionClient,
  input: IssueInvoiceTransactionInput,
): Promise<string> {
  const { deliveryChallanId, userId } = input;

  const challan = await tx.deliveryChallan.findUnique({
    where: { id: deliveryChallanId },
    select: {
      id: true,
      challanNo: true,
      orderId: true,
      dealerCode: true,
      status: true,
      deliveryMode: true,
      vehicleNo: true,
      driverName: true,
      invoice: { select: { id: true } },
      order: { select: { id: true, orderNo: true } },
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
    throw new InvoiceActionError(
      "CHALLAN_NOT_FOUND",
      "invoice.error.challanNotFound",
    );
  }

  if (challan.invoice !== null) {
    return challan.invoice.id;
  }

  assertChallanConfirmedForInvoice(challan.status);
  assertChallanHasItemsForInvoice(challan.items.length);

  const lockedDealer = await lockDealerForFinancialUpdate(tx, challan.dealerCode);

  const existingAfterLock = await tx.invoice.findUnique({
    where: { deliveryChallanId: challan.id },
    select: { id: true },
  });
  if (existingAfterLock) {
    return existingAfterLock.id;
  }

  const previousDue = lockedDealer.currentBalance;

  const { snapshots, totals } = buildInvoiceFromChallanLines(
    challan.items.map((item) => ({
      challanItemId: item.id,
      orderItemId: item.orderItemId,
      productId: item.productId,
      productCode: item.product.sku,
      productName: item.product.name,
      unit: item.product.unit,
      challanQuantity: item.quantity,
      orderItemQuantity: item.orderItem.quantity,
      orderItemUnitPrice: item.orderItem.unitPrice,
      orderItemDiscount: item.orderItem.discount,
    })),
  );

  if (
    wouldExceedCreditLimit(
      lockedDealer.creditLimit,
      previousDue,
      totals.grandTotal,
    )
  ) {
    throw new InvoiceActionError(
      "CREDIT_LIMIT_EXCEEDED",
      "invoice.error.creditLimitExceeded",
    );
  }

  const currentDue = previousDue.plus(totals.grandTotal);
  const issueDate = new Date();
  const dueDate = addDays(issueDate, INVOICE_DEFAULT_DUE_DAYS);
  const invoiceNo = await generateNextInvoiceNo(tx);

  const invoice = await tx.invoice.create({
    data: {
      invoiceNo,
      dealerCode: challan.dealerCode,
      orderId: challan.orderId,
      deliveryChallanId: challan.id,
      status: InvoiceStatus.Issued,
      subtotal: totals.subtotal,
      discount: totals.discountAmount,
      vat: totals.vat,
      previousDue,
      collectionReceived: ZERO_MONEY,
      grandTotal: totals.grandTotal,
      currentDue,
      deliveryMode: challan.deliveryMode,
      vehicleNo: challan.vehicleNo,
      driverName: challan.driverName,
      issueDate,
      dueDate,
      items: {
        create: snapshots.map((line) => ({
          challanItemId: line.challanItemId,
          orderItemId: line.orderItemId,
          productId: line.productId,
          productCode: line.productCode,
          productName: line.productName,
          unit: line.unit,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount,
          lineTotal: line.lineTotal,
        })),
      },
    },
    select: { id: true },
  });

  await postReceivableIncrease({
    tx,
    dealerCode: challan.dealerCode,
    amount: totals.grandTotal,
    previousBalance: previousDue,
    userId,
    referenceType: FINANCIAL_REFERENCE_INVOICE,
    referenceId: invoice.id,
    referenceNo: invoiceNo,
    metadata: {
      deliveryChallanId: challan.id,
      orderId: challan.orderId,
      grandTotal: totals.grandTotal.toFixed(2),
    },
  });

  await recordInvoiceAudit(tx, {
    userId,
    invoiceId: invoice.id,
    action: "INVOICE_CREATED",
    newValue: {
      invoiceId: invoice.id,
      invoiceNo,
      deliveryChallanId: challan.id,
      challanNo: challan.challanNo,
      salesOrderId: challan.order.id,
      orderNo: challan.order.orderNo,
      dealerCode: challan.dealerCode,
      createdById: userId,
      grandTotal: totals.grandTotal.toFixed(2),
      previousDue: previousDue.toFixed(2),
      currentDue: currentDue.toFixed(2),
      status: InvoiceStatus.Issued,
      timestamp: issueDate.toISOString(),
    },
  });

  return invoice.id;
}

export { InvoiceActionError, InvoiceWorkflowError };
