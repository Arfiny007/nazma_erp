import { DocumentTable } from "@/components/documents/sections/document-table";

import type { TerritoryProductSalesDocumentLabels } from "./product-sales-document-types";

interface TerritoryProductSalesPrintRow {
  sl: string;
  territory: string;
  productCode: string;
  productName: string;
  category: string;
  soldQuantity: string;
  invoiceCount: string;
  dealerCount: string;
  territoryRank: string;
  overallRank: string;
}

interface TerritoryProductSalesTableProps {
  rows: TerritoryProductSalesPrintRow[];
  labels: TerritoryProductSalesDocumentLabels;
  emptyLabel: string;
}

/**
 * Dense A4 print table — headers repeat across page breaks via thead.
 */
export function TerritoryProductSalesTable({
  rows,
  labels,
  emptyLabel,
}: TerritoryProductSalesTableProps) {
  if (rows.length === 0) {
    return (
      <p className="mb-3 text-[9pt] text-slate-600" data-empty-state="">
        {emptyLabel}
      </p>
    );
  }

  return (
    <DocumentTable
      caption={labels.documentTitle}
      variant="standard"
      allowPageBreak
      rowKey={(row) => `${row.sl}-${row.territory}-${row.productCode}`}
      rows={rows}
      columns={[
        {
          key: "sl",
          header: labels.sl,
          align: "center",
          className: "w-[4%] tabular-nums",
          render: (row) => row.sl,
        },
        {
          key: "territory",
          header: labels.territory,
          align: "left",
          className: "w-[12%]",
          render: (row) => row.territory,
        },
        {
          key: "productCode",
          header: labels.productCode,
          align: "left",
          className: "w-[10%] font-mono text-[7.5pt]",
          render: (row) => row.productCode,
        },
        {
          key: "productName",
          header: labels.productName,
          align: "left",
          className: "w-[18%]",
          render: (row) => row.productName,
        },
        {
          key: "category",
          header: labels.category,
          align: "left",
          className: "w-[10%]",
          render: (row) => row.category,
        },
        {
          key: "soldQuantity",
          header: labels.soldQuantity,
          align: "right",
          className: "w-[10%] tabular-nums font-mono",
          render: (row) => row.soldQuantity,
        },
        {
          key: "invoiceCount",
          header: labels.invoiceCount,
          align: "right",
          className: "w-[7%] tabular-nums",
          render: (row) => row.invoiceCount,
        },
        {
          key: "dealerCount",
          header: labels.dealerCount,
          align: "right",
          className: "w-[7%] tabular-nums",
          render: (row) => row.dealerCount,
        },
        {
          key: "territoryRank",
          header: labels.territoryRank,
          align: "right",
          className: "w-[6%] tabular-nums",
          render: (row) => row.territoryRank,
        },
        {
          key: "overallRank",
          header: labels.overallRank,
          align: "right",
          className: "w-[6%] tabular-nums",
          render: (row) => row.overallRank,
        },
      ]}
    />
  );
}
