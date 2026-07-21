import type { TerritoryProductSalesDocumentLabels } from "./product-sales-document-types";

interface TerritoryProductSalesSummaryProps {
  labels: TerritoryProductSalesDocumentLabels;
  summary: {
    totalSoldQuantity: string;
    totalProducts: string;
    totalTerritories: string;
    totalInvoices: string;
    totalDealers: string;
  };
}

/**
 * Summary values from server DTO only — no React aggregation.
 */
export function TerritoryProductSalesSummary({
  labels,
  summary,
}: TerritoryProductSalesSummaryProps) {
  const items = [
    {
      key: "qty",
      label: labels.totalSoldQuantity,
      value: summary.totalSoldQuantity,
    },
    {
      key: "products",
      label: labels.totalProducts,
      value: summary.totalProducts,
    },
    {
      key: "territories",
      label: labels.totalTerritories,
      value: summary.totalTerritories,
    },
    {
      key: "invoices",
      label: labels.totalInvoices,
      value: summary.totalInvoices,
    },
    {
      key: "dealers",
      label: labels.totalDealers,
      value: summary.totalDealers,
    },
  ];

  return (
    <section
      className="document-avoid-break mb-3 border border-slate-300 p-2"
      data-product-sales-summary=""
    >
      <h3 className="mb-1.5 text-[9pt] font-semibold uppercase tracking-wide text-[var(--doc-enterprise-blue)]">
        {labels.summaryTitle}
      </h3>
      <dl className="grid grid-cols-5 gap-2 text-[8pt]">
        {items.map((item) => (
          <div key={item.key}>
            <dt className="text-slate-500">{item.label}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums font-mono">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
