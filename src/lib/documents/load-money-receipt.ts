import { loadCollectionDetailDTO } from "@/lib/actions/collections/helpers";import { canPrintMoneyReceipt } from "@/lib/collections/workflow";
import { mapCollectionToReceiptDocument } from "@/lib/documents/map-collection-receipt";
import type { MoneyReceiptDocumentDTO } from "@/types/document";

/**
 * Loads a printable money receipt document for confirmed collections only.
 * Returns null when the collection does not exist or cannot be printed.
 */
export async function loadMoneyReceiptDocument(
  collectionId: string,
): Promise<MoneyReceiptDocumentDTO | null> {
  const detail = await loadCollectionDetailDTO(collectionId);

  if (!detail || !canPrintMoneyReceipt(detail.status)) {
    return null;
  }

  return mapCollectionToReceiptDocument(detail);
}
