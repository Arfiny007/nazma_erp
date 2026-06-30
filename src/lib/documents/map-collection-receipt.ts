import type { CollectionDetailDTO } from "@/types/collection";
import type { DocumentPartyDTO, MoneyReceiptDocumentDTO } from "@/types/document";

function toParty(
  name: string,
  address: string,
  phone: string,
  email?: string | null,
): DocumentPartyDTO {
  return { name, address, phone, email };
}

/**
 * Maps a confirmed collection into the money receipt document payload.
 * All monetary values are passed through unchanged from the server.
 */
export function mapCollectionToReceiptDocument(
  source: CollectionDetailDTO,
): MoneyReceiptDocumentDTO {
  return {
    receiptNo: source.collectionNo,
    collectionNo: source.collectionNo,
    receiptDate: source.collectionDate,
    dealer: toParty(
      source.dealerName,
      source.dealerAddress,
      source.dealerMobile,
      source.dealerEmail,
    ),
    paymentMethod: source.paymentMethod,
    referenceNumber: source.referenceNumber,
    receivedAmount: source.receivedAmount,
    allocatedAmount: source.allocatedAmount,
    unallocatedAmount: source.unallocatedAmount,
    status: source.status,
    remarks: source.remarks,
    allocations: source.allocations.map((row) => ({
      referenceType: row.referenceType,
      referenceLabel: row.referenceLabel,
      allocatedAmount: row.allocatedAmount,
    })),
  };
}
