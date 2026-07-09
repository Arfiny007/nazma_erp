import type {
  DealerStatementResult,
  DealerStatementSummaryResult,
  StatementRow,
} from "@/lib/ledger/statement";
import { calculateCreditUtilization } from "@/lib/utils/credit-limit";
import type {
  DealerStatementDTO,
  DealerStatementSummaryDTO,
  StatementRowDTO,
} from "@/types/ledger-statement";

/**
 * Decimal -> string DTO conversion for the Ledger Statement server actions —
 * PHASE_07D1. Kept separate from the read engine itself so
 * `src/lib/ledger/statement/` never has to know about the transport shape.
 */

function toRowDTO(row: StatementRow): StatementRowDTO {
  return {
    id: row.id,
    transactionDate: row.transactionDate.toISOString(),
    postingDate: row.postingDate.toISOString(),
    postingType: row.postingType,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    referenceNo: row.referenceNo,
    description: row.description,
    debit: row.debit.toFixed(2),
    credit: row.credit.toFixed(2),
    runningBalance: row.runningBalance.toFixed(2),
    createdById: row.createdById,
    createdByName: row.createdByName,
    isOpeningBalance: row.isOpeningBalance,
  };
}

export function toDealerStatementDTO(
  result: DealerStatementResult,
): DealerStatementDTO {
  return {
    meta: {
      dealerCode: result.meta.dealerCode,
      dealerName: result.meta.dealerName,
      currentBalance: result.meta.currentBalance.toFixed(2),
      creditLimit: result.meta.creditLimit.toFixed(2),
      hasOpeningBalance: result.meta.hasOpeningBalance,
      openingBalanceAmount: result.meta.openingBalanceAmount?.toFixed(2) ?? null,
      openingBalanceEffectiveDate:
        result.meta.openingBalanceEffectiveDate?.toISOString() ?? null,
      openingBalanceStatus: result.meta.openingBalanceStatus,
      dateRange: {
        fromDate: result.meta.dateRange.fromDate?.toISOString() ?? null,
        toDate: result.meta.dateRange.toDate?.toISOString() ?? null,
      },
      ledgerIntegrity: { ...result.meta.ledgerIntegrity },
      generatedAt: result.meta.generatedAt.toISOString(),
    },
    openingBalanceForRange: result.openingBalanceForRange.toFixed(2),
    rows: result.rows.map(toRowDTO),
    totals: {
      totalDebit: result.totals.totalDebit.toFixed(2),
      totalCredit: result.totals.totalCredit.toFixed(2),
      netMovement: result.totals.netMovement.toFixed(2),
      entryCount: result.totals.entryCount,
    },
    pagination: { ...result.pagination },
  };
}

export function toDealerStatementSummaryDTO(
  result: DealerStatementSummaryResult,
): DealerStatementSummaryDTO {
  return {
    dealerCode: result.dealerCode,
    dealerName: result.dealerName,
    currentBalance: result.currentBalance.toFixed(2),
    creditLimit: result.creditLimit.toFixed(2),
    credit: calculateCreditUtilization(result.creditLimit, result.currentBalance),
    totalDebit: result.totalDebit.toFixed(2),
    totalCredit: result.totalCredit.toFixed(2),
    entryCount: result.entryCount,
    firstEntryDate: result.firstEntryDate?.toISOString() ?? null,
    lastEntryDate: result.lastEntryDate?.toISOString() ?? null,
    hasOpeningBalance: result.hasOpeningBalance,
    dateRange: {
      fromDate: result.dateRange.fromDate?.toISOString() ?? null,
      toDate: result.dateRange.toDate?.toISOString() ?? null,
    },
  };
}
