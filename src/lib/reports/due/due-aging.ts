import { InvoiceStatus, Prisma } from "@prisma/client";

import { computeInvoiceOutstanding } from "@/lib/collections/workflow";

import type { AgingBucket, DueAging } from "./due-report-types";

/**
 * Invoice aging helpers — PHASE_08D.
 *
 * Aging buckets classify outstanding invoice balances by days past due date.
 * This does NOT recompute dealer balances — it only classifies invoice
 * outstanding for aging attribution.
 *
 * Buckets:
 *   current   — not yet overdue (due date >= asOf)
 *   days30    — 1–30 days overdue
 *   days60    — 31–60 days overdue
 *   days90    — 61–90 days overdue
 *   days90Plus — 90+ days overdue
 */

const ZERO = new Prisma.Decimal(0);
const MS_PER_DAY = 86_400_000;

const ALLOCATABLE_STATUSES: ReadonlySet<InvoiceStatus> = new Set([
  InvoiceStatus.Issued,
  InvoiceStatus.Partial,
  InvoiceStatus.Overdue,
]);

export interface AgingInvoiceInput {
  dueDate: Date;
  grandTotal: Prisma.Decimal;
  collectionReceived: Prisma.Decimal;
  status: InvoiceStatus;
}

export function isAllocatableInvoiceStatus(status: InvoiceStatus): boolean {
  return ALLOCATABLE_STATUSES.has(status);
}

export function computeDaysOverdue(dueDate: Date, asOfDate: Date): number {
  const dueMidnight = startOfDay(dueDate).getTime();
  const asOfMidnight = startOfDay(asOfDate).getTime();
  const diff = asOfMidnight - dueMidnight;
  if (diff <= 0) {
    return 0;
  }
  return Math.floor(diff / MS_PER_DAY);
}

export function classifyAgingBucket(
  daysOverdue: number,
): AgingBucket {
  if (daysOverdue <= 0) {
    return "current";
  }
  if (daysOverdue <= 30) {
    return "days30";
  }
  if (daysOverdue <= 60) {
    return "days60";
  }
  if (daysOverdue <= 90) {
    return "days90";
  }
  return "days90Plus";
}

export function createEmptyDueAging(): DueAging {
  return {
    current: ZERO,
    days30: ZERO,
    days60: ZERO,
    days90: ZERO,
    days90Plus: ZERO,
  };
}

export function addToAgingBucket(
  aging: DueAging,
  bucket: AgingBucket,
  amount: Prisma.Decimal,
): DueAging {
  return {
    ...aging,
    [bucket]: aging[bucket].plus(amount),
  };
}

export function accumulateInvoiceAging(
  invoices: readonly AgingInvoiceInput[],
  asOfDate: Date,
): DueAging {
  let aging = createEmptyDueAging();

  for (const invoice of invoices) {
    if (!isAllocatableInvoiceStatus(invoice.status)) {
      continue;
    }

    const outstanding = computeInvoiceOutstanding(
      invoice.grandTotal,
      invoice.collectionReceived,
    );
    if (outstanding.lessThanOrEqualTo(ZERO)) {
      continue;
    }

    const daysOverdue = computeDaysOverdue(invoice.dueDate, asOfDate);
    const bucket = classifyAgingBucket(daysOverdue);
    aging = addToAgingBucket(aging, bucket, outstanding);
  }

  return aging;
}

export function sumDueAging(a: DueAging, b: DueAging): DueAging {
  return {
    current: a.current.plus(b.current),
    days30: a.days30.plus(b.days30),
    days60: a.days60.plus(b.days60),
    days90: a.days90.plus(b.days90),
    days90Plus: a.days90Plus.plus(b.days90Plus),
  };
}

export function totalAgingAmount(aging: DueAging): Prisma.Decimal {
  return aging.current
    .plus(aging.days30)
    .plus(aging.days60)
    .plus(aging.days90)
    .plus(aging.days90Plus);
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
