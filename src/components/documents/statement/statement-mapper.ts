import {
  getStatementRowAccent,
  type StatementRowAccent,
} from "@/components/ledger/statement-row-styles";
import type { DealerStatementDTO, StatementRowDTO } from "@/types/ledger-statement";

import type { StatementDocumentDTO, StatementDocumentRow } from "./statement-types";

export interface StatementDocumentFormatters {
  formatMoney: (value: string) => string;
  formatDate: (iso: string) => string;
  formatPeriodDate: (value: string | null) => string;
  postingTypeLabel: (postingType: StatementRowDTO["postingType"]) => string;
  integrityLabel: (consistent: boolean) => string;
}

/** Print-safe row accent classes — presentation only. */
export const STATEMENT_PRINT_ROW_ACCENT_CLASS: Record<StatementRowAccent, string> = {
  opening: "doc-statement-row-opening",
  collection: "doc-statement-row-collection",
  reversal: "doc-statement-row-reversal",
  default: "",
};

function isZeroAmount(value: string): boolean {
  return value === "0" || value === "0.00";
}

function formatAmount(value: string, formatMoney: (value: string) => string): string {
  return isZeroAmount(value) ? "—" : formatMoney(value);
}

function mapRow(
  row: StatementRowDTO,
  formatters: StatementDocumentFormatters,
): StatementDocumentRow {
  return {
    id: row.id,
    date: formatters.formatDate(row.transactionDate),
    postingTypeLabel: formatters.postingTypeLabel(row.postingType),
    referenceNo: row.referenceNo,
    description: row.description,
    debit: formatAmount(row.debit, formatters.formatMoney),
    credit: formatAmount(row.credit, formatters.formatMoney),
    runningBalance: formatters.formatMoney(row.runningBalance),
    accent: getStatementRowAccent(row.postingType, row.isOpeningBalance),
  };
}

function formatStatementPeriod(
  dto: DealerStatementDTO,
  formatPeriodDate: (value: string | null) => string,
  allTimeLabel: string,
): string {
  const { fromDate, toDate } = dto.meta.dateRange;
  if (!fromDate && !toDate) {
    return allTimeLabel;
  }
  return `${formatPeriodDate(fromDate)} — ${formatPeriodDate(toDate)}`;
}

/**
 * Maps a {@link DealerStatementDTO} into a printable document payload.
 * Formatting and labels only — never recalculates balances or totals.
 */
export function mapDealerStatementToDocument(
  dto: DealerStatementDTO,
  formatters: StatementDocumentFormatters,
  allTimeLabel: string,
): StatementDocumentDTO {
  const isConsistent = dto.meta.ledgerIntegrity.isConsistent;

  return {
    dealerName: dto.meta.dealerName,
    dealerCode: dto.meta.dealerCode,
    statementPeriod: formatStatementPeriod(dto, formatters.formatPeriodDate, allTimeLabel),
    printDate: formatters.formatDate(dto.meta.generatedAt),
    currentBalance: formatters.formatMoney(dto.meta.currentBalance),
    ledgerIntegrityLabel: formatters.integrityLabel(isConsistent),
    ledgerIntegrityConsistent: isConsistent,
    openingBalance: formatters.formatMoney(dto.openingBalanceForRange),
    totalDebit: formatters.formatMoney(dto.totals.totalDebit),
    totalCredit: formatters.formatMoney(dto.totals.totalCredit),
    closingBalance: formatters.formatMoney(dto.meta.currentBalance),
    transactionCount: String(dto.totals.entryCount),
    rows: dto.rows.map((row) => mapRow(row, formatters)),
  };
}

/** Merges paginated statement fetches into one printable DTO. */
export function mergeDealerStatementPages(
  base: DealerStatementDTO,
  additionalRows: DealerStatementDTO["rows"],
): DealerStatementDTO {
  if (additionalRows.length === 0) {
    return base;
  }

  return {
    ...base,
    rows: [...base.rows, ...additionalRows],
    pagination: {
      ...base.pagination,
      page: 1,
      pageSize: base.pagination.total,
      pageCount: 1,
    },
  };
}
