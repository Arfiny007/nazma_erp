import type { DocumentFinancialDTO, DocumentLabels } from "@/types/document";

interface FinancialSummaryProps {
  financial: DocumentFinancialDTO;
  labels: Pick<
    DocumentLabels,
    | "subtotal"
    | "discount"
    | "vat"
    | "grandTotal"
    | "previousDue"
    | "currentDue"
    | "outstanding"
    | "status"
  >;
  statusLabel: string;
  formatMoney: (value: string) => string;
}

function SummaryLine({
  label,
  value,
  emphasis,
  highlight,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-2 py-0.5 text-[8pt] ${
        highlight ? "doc-grand-total-row font-bold" : ""
      } ${emphasis && !highlight ? "font-semibold" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Backend-sourced totals only — no client-side arithmetic. */
export function FinancialSummary({
  financial,
  labels,
  statusLabel,
  formatMoney,
}: FinancialSummaryProps) {
  return (
    <section className="document-avoid-break w-[72mm] shrink-0">
      <div className="border border-[var(--doc-border)]">
        <SummaryLine label={labels.subtotal} value={formatMoney(financial.subtotal)} />
        <SummaryLine label={labels.discount} value={formatMoney(financial.discount)} />
        <SummaryLine label={labels.vat} value={formatMoney(financial.vat)} />
        <SummaryLine
          label={labels.grandTotal}
          value={formatMoney(financial.grandTotal)}
          highlight
        />
        <SummaryLine
          label={labels.previousDue}
          value={formatMoney(financial.previousDue)}
        />
        <SummaryLine
          label={labels.currentDue}
          value={formatMoney(financial.currentDue)}
          emphasis
        />
        <SummaryLine
          label={labels.outstanding}
          value={formatMoney(financial.outstanding)}
          emphasis
        />
        <SummaryLine label={labels.status} value={statusLabel} />
      </div>
    </section>
  );
}
