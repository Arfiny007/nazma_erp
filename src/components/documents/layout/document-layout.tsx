import type { ReactNode } from "react";

interface DocumentLayoutProps {
  children: ReactNode;
  className?: string;
  /** Reserved extension slot — QR code, barcode, digital signature */
  extensionSlot?: ReactNode;
}

/**
 * Root A4 document shell shared by Invoice, Challan, Receipt, and Statement
 * documents. Keeps page dimensions and print-safe structure consistent.
 */
export function DocumentLayout({
  children,
  className = "",
  extensionSlot,
}: DocumentLayoutProps) {
  return (
    <article
      className={`document-print-root document-avoid-break ${className}`.trim()}
      data-document-layout=""
    >
      {children}
      {extensionSlot ? (
        <div className="hidden" data-document-extension="" aria-hidden="true">
          {extensionSlot}
        </div>
      ) : null}
    </article>
  );
}
