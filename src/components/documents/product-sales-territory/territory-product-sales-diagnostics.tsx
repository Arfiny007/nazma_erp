import type { TerritoryProductSalesDocumentLabels } from "./product-sales-document-types";

interface TerritoryProductSalesDiagnosticsProps {
  labels: TerritoryProductSalesDocumentLabels;
  diagnostics: Array<{ label: string; value: string }>;
}

/**
 * Real attribution diagnostics only — never territory-overlap fluff.
 */
export function TerritoryProductSalesDiagnostics({
  labels,
  diagnostics,
}: TerritoryProductSalesDiagnosticsProps) {
  if (diagnostics.length === 0) {
    return null;
  }

  return (
    <section
      className="document-avoid-break mb-3 border border-amber-200 bg-amber-50/40 p-2"
      data-product-sales-diagnostics=""
    >
      <h3 className="mb-1.5 text-[9pt] font-semibold uppercase tracking-wide text-amber-900">
        {labels.diagnosticsTitle}
      </h3>
      <ul className="space-y-0.5 text-[8pt] text-amber-950">
        {diagnostics.map((item) => (
          <li key={item.label} className="flex justify-between gap-4">
            <span>{item.label}</span>
            <span className="tabular-nums font-mono font-semibold">
              {item.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
