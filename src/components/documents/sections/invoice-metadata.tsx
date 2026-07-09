import { DocumentMetadata } from "@/components/documents/sections/document-metadata";
import { DocumentParties } from "@/components/documents/sections/document-parties";
import type { InvoiceDocumentDTO } from "@/types/document";

interface InvoiceMetadataProps {
  document: InvoiceDocumentDTO;
  labels: {
    billTo: string;
    shipTo: string;
    invoiceNo: string;
    invoiceDate: string;
    salesPerson: string;
  };
  formatDate: (iso: string) => string;
}

/**
 * Invoice business information section.
 * Displays Bill To and Ship To as two columns (enterprise ERP convention).
 * Both currently resolve to the same dealer DTO — ready for future
 * alternate shipping address without structural change.
 */
export function InvoiceMetadata({
  document,
  labels,
  formatDate,
}: InvoiceMetadataProps) {
  const fields = [
    { label: labels.invoiceDate, value: formatDate(document.issueDate) },
    ...(document.salesPerson
      ? [{ label: labels.salesPerson, value: document.salesPerson }]
      : []),
  ];

  return (
    <DocumentMetadata
      primaryReference={document.invoiceNo}
      fields={fields}
      parties={
        <DocumentParties
          parties={[
            { label: labels.billTo, party: document.billTo },
            { label: labels.shipTo, party: document.billTo },
          ]}
        />
      }
    />
  );
}
