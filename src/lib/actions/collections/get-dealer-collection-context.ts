"use server";

import { CollectionStatus, InvoiceStatus, Prisma } from "@prisma/client";

import { computeInvoiceOutstanding } from "@/lib/collections/workflow";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { calculateCreditUtilization } from "@/lib/utils/credit-limit";
import { z } from "zod";
import type {
  ActionResult,
  DealerCollectionContextDTO,
  DealerFinancialSummaryDTO,
  OutstandingInvoiceDTO,
} from "@/types/collection";

import { fail, fromZodError, ok } from "./helpers";

const dealerCodeSchema = z.object({
  dealerCode: z.string().trim().min(1, { error: "validation.dealerCode.required" }),
});

const ALLOCATABLE_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.Issued,
  InvoiceStatus.Partial,
  InvoiceStatus.Overdue,
];

/**
 * Read-only dealer financial snapshot and open invoices for the collection workspace.
 */
export async function getDealerCollectionContext(
  input: unknown,
): Promise<ActionResult<DealerCollectionContextDTO>> {
  try {
    await requirePermission("collections:view");
  } catch {
    return fail<DealerCollectionContextDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = dealerCodeSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { dealerCode } = parsed.data;

  const dealer = await prisma.dealer.findUnique({
    where: { dealerCode },
    select: {
      dealerCode: true,
      companyName: true,
      creditLimit: true,
      currentBalance: true,
      monthlyTarget: true,
      yearlyTarget: true,
      totalSales: true,
      lastCollectionDate: true,
      lastInvoiceDate: true,
    },
  });

  if (!dealer) {
    return fail<DealerCollectionContextDTO>(
      "DEALER_NOT_FOUND",
      "collection.error.dealerNotFound",
    );
  }

  const [invoices, unallocatedAggregate] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        dealerCode,
        status: { in: ALLOCATABLE_INVOICE_STATUSES },
      },
      select: {
        id: true,
        invoiceNo: true,
        issueDate: true,
        dueDate: true,
        grandTotal: true,
        currentDue: true,
        collectionReceived: true,
        status: true,
      },
      orderBy: [{ issueDate: "asc" }, { invoiceNo: "asc" }],
    }),
    prisma.collection.aggregate({
      where: {
        dealerCode,
        status: {
          in: [
            CollectionStatus.Confirmed,
            CollectionStatus.PartiallyAllocated,
            CollectionStatus.Allocated,
          ],
        },
        unallocatedAmount: { gt: 0 },
      },
      _sum: { unallocatedAmount: true },
    }),
  ]);

  const credit = calculateCreditUtilization(
    dealer.creditLimit,
    dealer.currentBalance,
  );

  const dealerSummary: DealerFinancialSummaryDTO = {
    dealerCode: dealer.dealerCode,
    dealerName: dealer.companyName,
    currentBalance: credit.currentBalance,
    creditLimit: credit.creditLimit,
    availableCredit: credit.availableCredit,
    monthlyTarget: dealer.monthlyTarget.toFixed(2),
    yearlyTarget: dealer.yearlyTarget.toFixed(2),
    totalSales: dealer.totalSales.toFixed(2),
    lastCollectionDate: dealer.lastCollectionDate?.toISOString() ?? null,
    lastInvoiceDate: dealer.lastInvoiceDate?.toISOString() ?? null,
    unallocatedCollectionTotal: (
      unallocatedAggregate._sum.unallocatedAmount ?? new Prisma.Decimal(0)
    ).toFixed(2),
  };

  const outstandingInvoices: OutstandingInvoiceDTO[] = invoices
    .map((invoice) => {
      const allocatable = computeInvoiceOutstanding(
        invoice.grandTotal,
        invoice.collectionReceived,
      );
      return {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        grandTotal: invoice.grandTotal.toFixed(2),
        collectionReceived: invoice.collectionReceived.toFixed(2),
        allocatableOutstanding: allocatable.toFixed(2),
        statementOutstanding: invoice.currentDue
          .sub(invoice.collectionReceived)
          .toFixed(2),
        status: invoice.status,
      };
    })
    .filter((row) => Number.parseFloat(row.allocatableOutstanding) > 0);

  return ok({ dealer: dealerSummary, outstandingInvoices });
}
