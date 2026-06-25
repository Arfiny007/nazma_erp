"use server";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { listInvoicesSchema } from "@/lib/validators/invoice.schema";
import type {
  ActionResult,
  InvoiceSummaryDTO,
  PaginatedResult,
} from "@/types/invoice";

import {
  fail,
  fromPrismaError,
  fromZodError,
  invoiceSummaryInclude,
  ok,
  toInvoiceSummaryDTO,
} from "./helpers";

/**
 * Returns a paginated, filterable list of invoices.
 */
export async function listInvoices(
  input: unknown = {},
): Promise<ActionResult<PaginatedResult<InvoiceSummaryDTO>>> {
  try {
    await requirePermission("invoices:view");
  } catch {
    return fail<PaginatedResult<InvoiceSummaryDTO>>(
      "FORBIDDEN",
      "rbac.noAccess",
    );
  }

  const parsed = listInvoicesSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const {
    page,
    pageSize,
    search,
    dealerCode,
    orderId,
    deliveryChallanId,
    status,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
  } = parsed.data;

  const where: Prisma.InvoiceWhereInput = {};

  if (status) {
    where.status = status;
  }
  if (dealerCode) {
    where.dealerCode = dealerCode;
  }
  if (orderId) {
    where.orderId = orderId;
  }
  if (deliveryChallanId) {
    where.deliveryChallanId = deliveryChallanId;
  }
  if (dateFrom || dateTo) {
    where.issueDate = {};
    if (dateFrom) {
      where.issueDate.gte = dateFrom;
    }
    if (dateTo) {
      where.issueDate.lte = dateTo;
    }
  }
  if (search) {
    where.OR = [
      { invoiceNo: { contains: search, mode: "insensitive" } },
      { order: { orderNo: { contains: search, mode: "insensitive" } } },
      { dealer: { companyName: { contains: search, mode: "insensitive" } } },
      { deliveryChallan: { challanNo: { contains: search, mode: "insensitive" } } },
    ];
  }

  try {
    const [total, invoices] = await prisma.$transaction([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: invoiceSummaryInclude,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return ok({
      items: invoices.map(toInvoiceSummaryDTO),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize) || 1,
    });
  } catch (error) {
    return fromPrismaError(error);
  }
}
