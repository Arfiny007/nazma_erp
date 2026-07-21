import type { TerritoryProductSalesDocumentLabels } from "./product-sales-document-types";

interface TerritoryProductSalesHeaderProps {
  labels: TerritoryProductSalesDocumentLabels;
  fromLabel: string;
  toLabel: string;
  territoryScopeLabel: string;
  generatedAtLabel: string;
  preparedForLabel: string;
}

/**
 * Print metadata block — report period, territory scope, generated, prepared for.
 */
export function TerritoryProductSalesHeader({
  labels,
  fromLabel,
  toLabel,
  territoryScopeLabel,
  generatedAtLabel,
  preparedForLabel,
}: TerritoryProductSalesHeaderProps) {
  return (
    <section className="document-avoid-break mb-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[8.5pt]">
      <div>
        <p className="font-semibold uppercase tracking-wide text-[var(--doc-enterprise-blue)]">
          {labels.reportPeriod}
        </p>
        <p>
          <span className="font-semibold">{labels.from}:</span> {fromLabel}
        </p>
        <p>
          <span className="font-semibold">{labels.to}:</span> {toLabel}
        </p>
      </div>
      <div className="text-right">
        <p>
          <span className="font-semibold">{labels.territoryScope}:</span>{" "}
          {territoryScopeLabel}
        </p>
        <p>
          <span className="font-semibold">{labels.generatedAt}:</span>{" "}
          {generatedAtLabel}
        </p>
        <p>
          <span className="font-semibold">{labels.preparedFor}:</span>{" "}
          {preparedForLabel}
        </p>
      </div>
    </section>
  );
}
