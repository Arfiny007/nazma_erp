export interface DocumentFinancialLine {
  label: string;
  value: string;
  emphasis?: boolean;
  highlight?: boolean;
  /** Render a thin horizontal separator above this line to visually group rows. */
  divider?: boolean;
}

interface SummaryLineProps {
  line: DocumentFinancialLine;
}

function SummaryLine({ line }: SummaryLineProps) {
  return (
    <>
      {line.divider ? (
        <div
          className="border-t border-[var(--doc-border)]"
          aria-hidden="true"
        />
      ) : null}
      <div
        className={[
          "flex items-center justify-between gap-3 px-2 py-0.5",
          "doc-summary-row",
          line.highlight ? "doc-grand-total-row font-bold" : "",
          line.emphasis && !line.highlight ? "font-semibold" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ fontSize: "8pt" }}
      >
        <span>{line.label}</span>
        <span className="doc-numeric">{line.value}</span>
      </div>
    </>
  );
}

interface DocumentFinancialSummaryProps {
  lines: DocumentFinancialLine[];
}

/** Backend-sourced monetary lines — no client-side arithmetic. */
export function DocumentFinancialSummary({ lines }: DocumentFinancialSummaryProps) {
  return (
    <section className="document-avoid-break" style={{ width: "72mm" }}>
      <div className="border border-[var(--doc-border)]">
        {lines.map((line, index) => (
          <SummaryLine key={`${line.label}-${index}`} line={line} />
        ))}
      </div>
    </section>
  );
}
