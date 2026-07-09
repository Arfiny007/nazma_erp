"use client";

import { DocumentTable } from "@/components/documents/sections/document-table";
import {
  STATEMENT_PRINT_ROW_ACCENT_CLASS,
} from "@/components/documents/statement/statement-mapper";
import type { StatementDocumentLabels, StatementDocumentRow } from "@/components/documents/statement/statement-types";

interface StatementTableProps {
  rows: StatementDocumentRow[];
  labels: StatementDocumentLabels;
}

/** Printable ledger entry table — running balance rendered verbatim from DTO. */
export function StatementTable({ rows, labels }: StatementTableProps) {
  return (
    <DocumentTable
      variant="statement"
      allowPageBreak
      caption={labels.tableCaption}
      rows={rows}
      rowKey={(row) => row.id}
      getRowClassName={(row) => STATEMENT_PRINT_ROW_ACCENT_CLASS[row.accent]}
      columns={[
        {
          key: "date",
          header: labels.columnDate,
          className: "col-st-date",
          render: (row) => row.date,
        },
        {
          key: "postingType",
          header: labels.columnPostingType,
          className: "col-st-type",
          render: (row) => row.postingTypeLabel,
        },
        {
          key: "referenceNo",
          header: labels.columnReferenceNo,
          className: "col-st-ref",
          render: (row) => row.referenceNo,
        },
        {
          key: "description",
          header: labels.columnDescription,
          className: "col-st-desc",
          render: (row) => row.description,
        },
        {
          key: "debit",
          header: labels.columnDebit,
          align: "right",
          className: "col-st-debit",
          render: (row) => row.debit,
        },
        {
          key: "credit",
          header: labels.columnCredit,
          align: "right",
          className: "col-st-credit",
          render: (row) => row.credit,
        },
        {
          key: "runningBalance",
          header: labels.columnRunningBalance,
          align: "right",
          className: "col-st-balance",
          render: (row) => row.runningBalance,
        },
      ]}
    />
  );
}
