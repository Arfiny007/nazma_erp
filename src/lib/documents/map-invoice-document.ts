import type { InvoiceDetailDTO } from "@/types/invoice";
import type { DocumentPartyDTO, InvoiceDocumentDTO } from "@/types/document";

function toParty(
  name: string,
  address: string,
  phone: string,
  email?: string | null,
): DocumentPartyDTO {
  return { name, address, phone, email };
}

/**
 * Maps a persisted invoice DTO into the document engine payload.
 * All monetary values are passed through unchanged from the server.
 */
export function mapInvoiceToDocument(invoice: InvoiceDetailDTO): InvoiceDocumentDTO {
  const party = toParty(
    invoice.dealerName,
    invoice.dealerAddress,
    invoice.dealerMobile,
    invoice.dealerEmail,
  );

  return {
    invoiceNo: invoice.invoiceNo,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    salesPerson: invoice.salesPerson,
    billTo: party,
    shipTo: party,
    items: invoice.items,
    financial: {
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      vat: invoice.vat,
      grandTotal: invoice.grandTotal,
      previousDue: invoice.previousDue,
      currentDue: invoice.currentDue,
      outstanding: invoice.outstanding,
      status: invoice.status,
    },
  };
}
