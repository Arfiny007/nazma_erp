import type { LedgerPostingType } from "@prisma/client";

import type { StatementLedgerEntryRow } from "./statement-query";
import type { StatementRow } from "./statement-types";

/**
 * Pure projection of `LedgerEntry` rows into statement rows — PHASE_07D1.
 *
 * No arithmetic on money happens here beyond passing `Prisma.Decimal`
 * values through untouched. `runningBalance` is copied verbatim from
 * `LedgerEntry.balance`.
 *
 * @see ADR-029
 */

const POSTING_TYPE_LABELS: Record<LedgerPostingType, string> = {
  Issue: "Invoice Issued",
  Collection: "Collection Received",
  Reversal: "Collection Reversed",
  OpeningBalance: "Opening Balance",
  CreditNote: "Credit Note",
  DebitNote: "Debit Note",
  ManualAdjustment: "Manual Adjustment",
  JournalEntry: "Journal Entry",
  Adjustment: "Adjustment",
};

/** Human-readable statement description derived from posting type + reference number. */
export function buildStatementDescription(
  postingType: LedgerPostingType,
  referenceNo: string,
): string {
  const label = POSTING_TYPE_LABELS[postingType] ?? postingType;
  return `${label} — ${referenceNo}`;
}

export function mapLedgerEntryToStatementRow(
  row: StatementLedgerEntryRow,
): StatementRow {
  return {
    id: row.id,
    transactionDate: row.transactionDate,
    postingDate: row.postingDate,
    postingType: row.postingType,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    referenceNo: row.referenceNo,
    description: buildStatementDescription(row.postingType, row.referenceNo),
    debit: row.debit,
    credit: row.credit,
    runningBalance: row.balance,
    createdById: row.createdById,
    createdByName: row.createdByName,
    isOpeningBalance: row.postingType === "OpeningBalance",
  };
}
