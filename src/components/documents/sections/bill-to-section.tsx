import { DocumentParties } from "@/components/documents/sections/document-parties";
import type { DocumentPartyDTO } from "@/types/document";

interface BillToSectionProps {
  label: string;
  party: DocumentPartyDTO;
}

/** @deprecated Use DocumentParties */
export function BillToSection({ label, party }: BillToSectionProps) {
  return <DocumentParties parties={[{ label, party }]} />;
}
