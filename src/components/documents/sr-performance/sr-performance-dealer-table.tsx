import { DocumentTable } from "@/components/documents/sections/document-table";

import type { SrPerformanceDocumentLabels } from "./sr-performance-document-types";

interface DealerPrintRow {
  sl: string;
  partyName: string;
  previousDue: string;
  sales: string;
  collection: string;
  balanceDue: string;
}

interface SrPerformanceDealerTableProps {
  rows: DealerPrintRow[];
  totals: {
    previousDue: string;
    sales: string;
    collection: string;
    balanceDue: string;
  };
  labels: SrPerformanceDocumentLabels;
}

export function SrPerformanceDealerTable({
  rows,
  totals,
  labels,
}: SrPerformanceDealerTableProps) {
  return (
    <section className="document-avoid-break mb-4">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-800">
        {labels.individualTitle}
      </h3>
      <DocumentTable
        caption={labels.individualTitle}
        variant="standard"
        allowPageBreak
        rowKey={(row) => `${row.sl}-${row.partyName}`}
        rows={rows}
        columns={[
          {
            key: "sl",
            header: labels.sl,
            align: "center",
            render: (row) => row.sl,
          },
          {
            key: "party",
            header: labels.partyName,
            align: "left",
            render: (row) => row.partyName,
          },
          {
            key: "previousDue",
            header: labels.previousDue,
            align: "right",
            className: "tabular-nums",
            render: (row) => row.previousDue,
          },
          {
            key: "sales",
            header: labels.sales,
            align: "right",
            className: "tabular-nums",
            render: (row) => row.sales,
          },
          {
            key: "collection",
            header: labels.collection,
            align: "right",
            className: "tabular-nums",
            render: (row) => row.collection,
          },
          {
            key: "balanceDue",
            header: labels.balanceDue,
            align: "right",
            className: "tabular-nums",
            render: (row) => row.balanceDue,
          },
        ]}
      />
      <div className="mt-2 grid grid-cols-4 gap-2 border-t border-slate-300 pt-2 text-xs font-semibold tabular-nums">
        <div className="text-right">{totals.previousDue}</div>
        <div className="text-right">{totals.sales}</div>
        <div className="text-right">{totals.collection}</div>
        <div className="text-right">
          {labels.totals}: {totals.balanceDue}
        </div>
      </div>
    </section>
  );
}
