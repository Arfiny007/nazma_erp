import { Prisma } from "@prisma/client";

import { validateDealerLedgerChain } from "@/lib/ledger/ledger-reconciliation";
import { prisma } from "@/lib/prisma";

import { mapLedgerEntryToStatementRow } from "./statement-mapper";
import {
  aggregateLedgerTotalsForDealer,
  countLedgerEntriesForDealer,
  findDealerForStatement,
  findLastLedgerEntryBefore,
  findLedgerDateBoundsForDealer,
  findLedgerEntriesPageForDealer,
  findOpeningBalanceForDealer,
  type StatementReadClient,
} from "./statement-query";
import type {
  DealerStatementResult,
  DealerStatementSummaryResult,
  GetDealerStatementParams,
  GetDealerStatementSummaryParams,
} from "./statement-types";
import {
  assertDealerExists,
  assertValidDateRange,
  assertValidPagination,
} from "./statement-validation";

/**
 * Dealer Statement read engine — PHASE_07D1.
 *
 * This is the SINGLE source that every future statement consumer (Dealer
 * Statement UI, Customer Ledger, Ledger Preview, Printable Statement, PDF,
 * Excel, Email Statements) must call through. Nothing here — now or ever —
 * mutates `LedgerEntry`, `Dealer`, `Invoice`, `Collection`, or
 * `OpeningBalance`, and nothing here calls `posting-service.ts`.
 *
 * `LedgerEntry` is the sole authoritative source for financial truth
 * (ADR-024, ADR-025). Every row's `runningBalance` is copied verbatim from
 * `LedgerEntry.balance` — it is NEVER recomputed by this service.
 *
 * @see ADR-029
 */

const ZERO = new Prisma.Decimal(0);

function toLedgerIntegrity(
  validation: Awaited<ReturnType<typeof validateDealerLedgerChain>>,
) {
  const isConsistent =
    validation.isChainValid &&
    validation.isReplayValid &&
    validation.isCacheValid;
  return {
    isChainValid: validation.isChainValid,
    isReplayValid: validation.isReplayValid,
    isCacheValid: validation.isCacheValid,
    isConsistent,
  };
}

/**
 * Returns a paginated Dealer Statement: opening balance context, a page of
 * transactions ordered by `(transactionDate, postingDate, id)` ascending,
 * running balance per row (verbatim from `LedgerEntry.balance`), totals
 * across the full filtered range, and dealer/opening-balance metadata.
 *
 * Gracefully returns an empty statement (zero rows, zero totals) for a
 * dealer with no ledger activity — it never throws for "no transactions".
 *
 * @param client Defaults to the shared `prisma` client. Accepts a
 *   transaction client so callers (e.g. future reconciliation jobs) can
 *   read inside an existing transaction without a second connection.
 */
export async function getDealerStatement(
  params: GetDealerStatementParams,
  client: StatementReadClient = prisma,
): Promise<DealerStatementResult> {
  assertValidDateRange(params.fromDate, params.toDate);
  assertValidPagination(params.page, params.pageSize);

  const dealer = assertDealerExists(
    await findDealerForStatement(client, params.dealerCode),
    params.dealerCode,
  );

  const skip = (params.page - 1) * params.pageSize;

  const [
    openingBalanceRecord,
    total,
    entries,
    ledgerTotals,
    carryForwardBalance,
    ledgerIntegrityValidation,
  ] = await Promise.all([
    findOpeningBalanceForDealer(client, params.dealerCode),
    countLedgerEntriesForDealer(client, params),
    findLedgerEntriesPageForDealer(client, {
      dealerCode: params.dealerCode,
      fromDate: params.fromDate,
      toDate: params.toDate,
      skip,
      take: params.pageSize,
    }),
    aggregateLedgerTotalsForDealer(client, params),
    params.fromDate
      ? findLastLedgerEntryBefore(client, {
          dealerCode: params.dealerCode,
          beforeDate: params.fromDate,
        })
      : Promise.resolve(null),
    validateDealerLedgerChain(client, params.dealerCode),
  ]);

  const rows = entries.map(mapLedgerEntryToStatementRow);
  const pageCount = total === 0 ? 0 : Math.ceil(total / params.pageSize);

  return {
    meta: {
      dealerCode: dealer.dealerCode,
      dealerName: dealer.companyName,
      currentBalance: dealer.currentBalance,
      creditLimit: dealer.creditLimit,
      hasOpeningBalance: openingBalanceRecord?.status === "Locked",
      openingBalanceAmount: openingBalanceRecord?.amount ?? null,
      openingBalanceEffectiveDate: openingBalanceRecord?.effectiveDate ?? null,
      openingBalanceStatus: openingBalanceRecord?.status ?? null,
      dateRange: {
        fromDate: params.fromDate ?? null,
        toDate: params.toDate ?? null,
      },
      ledgerIntegrity: toLedgerIntegrity(ledgerIntegrityValidation),
      generatedAt: new Date(),
    },
    openingBalanceForRange: carryForwardBalance ?? ZERO,
    rows,
    totals: {
      totalDebit: ledgerTotals.totalDebit,
      totalCredit: ledgerTotals.totalCredit,
      netMovement: ledgerTotals.totalDebit.minus(ledgerTotals.totalCredit),
      entryCount: ledgerTotals.entryCount,
    },
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      pageCount,
    },
  };
}

/**
 * Returns a lightweight, non-paginated statement summary for a dealer —
 * current balance, credit limit, filtered-range totals, and opening-balance
 * presence. Intended for compact widgets (e.g. a dealer header card) that
 * don't need the full row list.
 */
export async function getDealerStatementSummary(
  params: GetDealerStatementSummaryParams,
  client: StatementReadClient = prisma,
): Promise<DealerStatementSummaryResult> {
  assertValidDateRange(params.fromDate, params.toDate);

  const dealer = assertDealerExists(
    await findDealerForStatement(client, params.dealerCode),
    params.dealerCode,
  );

  const [openingBalanceRecord, totals, bounds] = await Promise.all([
    findOpeningBalanceForDealer(client, params.dealerCode),
    aggregateLedgerTotalsForDealer(client, params),
    findLedgerDateBoundsForDealer(client, params),
  ]);

  return {
    dealerCode: dealer.dealerCode,
    dealerName: dealer.companyName,
    currentBalance: dealer.currentBalance,
    creditLimit: dealer.creditLimit,
    totalDebit: totals.totalDebit,
    totalCredit: totals.totalCredit,
    entryCount: totals.entryCount,
    firstEntryDate: bounds.firstEntryDate,
    lastEntryDate: bounds.lastEntryDate,
    hasOpeningBalance: openingBalanceRecord?.status === "Locked",
    dateRange: {
      fromDate: params.fromDate ?? null,
      toDate: params.toDate ?? null,
    },
  };
}