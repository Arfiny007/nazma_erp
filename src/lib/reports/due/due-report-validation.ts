import { Prisma } from "@prisma/client";

import { DueReportError } from "./due-report-errors";
import type { DueReportFilters } from "./due-report-types";

const ZERO = new Prisma.Decimal(0);

export function assertValidPagination(page: number, pageSize: number): void {
  if (!Number.isInteger(page) || page < 1) {
    throw new DueReportError("INVALID_PAGINATION", "Page must be >= 1");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new DueReportError("INVALID_PAGINATION", "Page size must be 1–500");
  }
}

export function assertValidDateRange(fromDate?: Date, toDate?: Date): void {
  if (fromDate && toDate && fromDate > toDate) {
    throw new DueReportError("INVALID_DATE_RANGE", "fromDate must be <= toDate");
  }
}

export function assertValidBalanceRange(
  balanceMin?: Prisma.Decimal,
  balanceMax?: Prisma.Decimal,
): void {
  if (balanceMin && balanceMax && balanceMin.greaterThan(balanceMax)) {
    throw new DueReportError("INVALID_BALANCE_RANGE", "balanceMin must be <= balanceMax");
  }
}

export function assertValidDueReportFilters(filters: DueReportFilters): void {
  assertValidPagination(filters.page, filters.pageSize);
  assertValidDateRange(filters.fromDate, filters.toDate);
  assertValidBalanceRange(filters.balanceMin, filters.balanceMax);
}

export function isPositiveDue(balance: Prisma.Decimal): boolean {
  return balance.greaterThan(ZERO);
}

export function isAdvance(balance: Prisma.Decimal): boolean {
  return balance.lessThan(ZERO);
}

export function dueAmount(balance: Prisma.Decimal): Prisma.Decimal {
  return balance.greaterThan(ZERO) ? balance : ZERO;
}

export function advanceAmount(balance: Prisma.Decimal): Prisma.Decimal {
  return balance.lessThan(ZERO) ? balance.abs() : ZERO;
}
