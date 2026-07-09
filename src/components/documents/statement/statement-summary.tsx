"use client";

import {
  DocumentFinancialSummary,
  type DocumentFinancialLine,
} from "@/components/documents/sections/document-financial-summary";
import type { StatementDocumentDTO, StatementDocumentLabels } from "@/components/documents/statement/statement-types";

interface StatementSummaryProps {
  document: StatementDocumentDTO;
  labels: StatementDocumentLabels;
}

/** Statement totals block — all values sourced from the mapped DTO. */
export function StatementSummary({ document, labels }: StatementSummaryProps) {
  const lines: DocumentFinancialLine[] = [
    {
      label: labels.openingBalance,
      value: document.openingBalance,
    },
    {
      label: labels.totalDebit,
      value: document.totalDebit,
    },
    {
      label: labels.totalCredit,
      value: document.totalCredit,
    },
    {
      label: labels.closingBalance,
      value: document.closingBalance,
      highlight: true,
      divider: true,
    },
    {
      label: labels.transactionCount,
      value: document.transactionCount,
    },
  ];

  return <DocumentFinancialSummary lines={lines} />;
}
