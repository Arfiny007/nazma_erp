import type { StatementRowAccent } from "@/components/ledger/statement-row-styles";

/** Display-ready row for the printable Dealer Statement table. */
export interface StatementDocumentRow {
  id: string;
  date: string;
  postingTypeLabel: string;
  referenceNo: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
  accent: StatementRowAccent;
}

/** Printable Dealer Statement payload — mapped from {@link DealerStatementDTO}. */
export interface StatementDocumentDTO {
  dealerName: string;
  dealerCode: string;
  statementPeriod: string;
  printDate: string;
  currentBalance: string;
  ledgerIntegrityLabel: string;
  ledgerIntegrityConsistent: boolean;
  openingBalance: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  transactionCount: string;
  rows: StatementDocumentRow[];
}

export interface StatementDocumentLabels {
  title: string;
  dealerName: string;
  dealerCode: string;
  statementPeriod: string;
  openEnded: string;
  printDate: string;
  currentBalance: string;
  ledgerIntegrity: string;
  columnDate: string;
  columnPostingType: string;
  columnReferenceNo: string;
  columnDescription: string;
  columnDebit: string;
  columnCredit: string;
  columnRunningBalance: string;
  openingBalance: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  transactionCount: string;
  tableCaption: string;
  integrityConsistentNote: string;
  integrityWarningNote: string;
  authorizedBy: string;
  footerThanks: string;
  previewTitle: string;
  printStatement: string;
  emptyStatementNote: string;
}
