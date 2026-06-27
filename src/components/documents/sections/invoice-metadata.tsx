import { BillToSection } from "@/components/documents/sections/bill-to-section";
import { ShipToSection } from "@/components/documents/sections/ship-to-section";
import type { InvoiceDocumentDTO } from "@/types/document";

interface InvoiceMetadataProps {
  document: InvoiceDocumentDTO;
  labels: {
    billTo: string;
    shipTo: string;
    invoiceNo: string;
    invoiceDate: string;
    dueDate: string;
    salesPerson: string;
  };
  formatDate: (iso: string) => string;
}

export function InvoiceMetadata({
  document,
  labels,
  formatDate,
}: InvoiceMetadataProps) {
  return (
    <section className="document-avoid-break mb-2 grid grid-cols-[1fr_auto] gap-3">
      <div className="grid grid-cols-2 gap-3">
        <BillToSection label={labels.billTo} party={document.billTo} />
        <ShipToSection label={labels.shipTo} party={document.shipTo} />
      </div>

      <div className="min-w-[38mm] text-right">
        <p className="text-[14pt] font-bold leading-none text-[var(--doc-text)]">
          {document.invoiceNo}
        </p>
        <dl className="mt-1.5 space-y-0.5 text-[8pt]">
          <div className="flex justify-end gap-2">
            <dt className="font-semibold doc-blue">{labels.invoiceDate}:</dt>
            <dd>{formatDate(document.issueDate)}</dd>
          </div>
          <div className="flex justify-end gap-2">
            <dt className="font-semibold doc-blue">{labels.dueDate}:</dt>
            <dd>{formatDate(document.dueDate)}</dd>
          </div>
          {document.salesPerson ? (
            <div className="flex justify-end gap-2">
              <dt className="font-semibold doc-blue">{labels.salesPerson}:</dt>
              <dd>{document.salesPerson}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  );
}
