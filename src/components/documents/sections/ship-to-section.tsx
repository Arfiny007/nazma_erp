import { DocumentParties } from "@/components/documents/sections/document-parties";
import type { DocumentPartyDTO } from "@/types/document";

interface ShipToSectionProps {
  label: string;
  party: DocumentPartyDTO;
}

/** @deprecated Use DocumentParties */
export function ShipToSection({ label, party }: ShipToSectionProps) {
  return <DocumentParties parties={[{ label, party }]} />;
}
