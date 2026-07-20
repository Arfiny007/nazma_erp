import { DocumentTable } from "@/components/documents/sections/document-table";

import type { SrPerformanceDocumentLabels } from "./sr-performance-document-types";

interface OverviewPrintRow {
  sl: string;
  srName: string;
  territories: string;
  previousDue: string;
  sales: string;
  collection: string;
  netBalance: string;
}

interface SrPerformanceOverviewTableProps {
  rows: OverviewPrintRow[];
  totals: {
    previousDue: string;
    sales: string;
    collection: string;
    netBalance: string;
  };
  labels: SrPerformanceDocumentLabels;
}

export function SrPerformanceOverviewTable({
  rows,
  totals,
  labels,
}: SrPerformanceOverviewTableProps) {
  return (
    <section className="document-avoid-break mb-4">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-800">
        {labels.overviewTitle}
      </h3>
      <DocumentTable
        caption={labels.overviewTitle}
        variant="standard"
        allowPageBreak
        rowKey={(row) => `${row.sl}-${row.srName}`}
        rows={rows}
        columns={[
          {
            key: "sl",
            header: labels.sl,
            align: "center",
            render: (row) => row.sl,
          },
          {
            key: "sr",
            header: labels.srName,
            align: "left",
            render: (row) => (
              <span>
                {row.srName}
                {row.territories ? (
                  <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                    {row.territories}
                  </span>
                ) : null}
              </span>
            ),
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
            key: "netBalance",
            header: labels.netBalance,
            align: "right",
            className: "tabular-nums",
            render: (row) => row.netBalance,
          },
        ]}
      />
      <div className="mt-2 grid grid-cols-4 gap-2 border-t border-slate-300 pt-2 text-xs font-semibold tabular-nums">
        <div className="text-right">{totals.previousDue}</div>
        <div className="text-right">{totals.sales}</div>
        <div className="text-right">{totals.collection}</div>
        <div className="text-right">
          {labels.totals}: {totals.netBalance}
        </div>
      </div>
    </section>
  );
}
