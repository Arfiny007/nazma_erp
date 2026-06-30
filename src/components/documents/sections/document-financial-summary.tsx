interface SummaryLineProps {
  label: string;
  value: string;
  emphasis?: boolean;
  highlight?: boolean;
}

function SummaryLine({ label, value, emphasis, highlight }: SummaryLineProps) {
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

export interface DocumentFinancialLine {
  label: string;
  value: string;
  emphasis?: boolean;
  highlight?: boolean;
}

interface DocumentFinancialSummaryProps {
  lines: DocumentFinancialLine[];
}

/** Backend-sourced monetary lines — no client-side arithmetic. */
export function DocumentFinancialSummary({ lines }: DocumentFinancialSummaryProps) {
  return (
    <section className="document-avoid-break w-[72mm] shrink-0">
      <div className="border border-[var(--doc-border)]">
        {lines.map((line) => (
          <SummaryLine
            key={line.label}
            label={line.label}
            value={line.value}
            emphasis={line.emphasis}
            highlight={line.highlight}
          />
        ))}
      </div>
    </section>
  );
}
