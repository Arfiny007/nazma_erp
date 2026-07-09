interface CompanyFooterProps {
  message: string;
}

/** Enterprise document footer — shared by all printable documents. */
export function CompanyFooter({ message }: CompanyFooterProps) {
  return (
    <footer className="document-avoid-break mt-auto">
      <div
        className="doc-blue-bar"
        style={{ height: "2px" }}
        aria-hidden="true"
      />
      <div
        className="mt-0 flex items-center justify-between px-1 pt-1.5"
        style={{ fontSize: "7.5pt" }}
      >
        <span className="text-[var(--doc-muted)]">
          Confidential — For addressee only
        </span>
        <span className="font-semibold italic doc-blue">{message}</span>
      </div>
    </footer>
  );
}
