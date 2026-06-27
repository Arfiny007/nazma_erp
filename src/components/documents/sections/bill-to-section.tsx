import type { DocumentPartyDTO } from "@/types/document";

interface BillToSectionProps {
  label: string;
  party: DocumentPartyDTO;
}

export function BillToSection({ label, party }: BillToSectionProps) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[8.5pt] font-bold doc-blue">{label}</p>
      <p className="text-[8pt] font-semibold leading-snug">{party.name}</p>
      <p className="text-[8pt] leading-snug text-[var(--doc-muted)]">{party.address}</p>
      <p className="text-[8pt] leading-snug text-[var(--doc-muted)]">{party.phone}</p>
      {party.email ? (
        <p className="text-[8pt] leading-snug text-[var(--doc-muted)]">{party.email}</p>
      ) : null}
    </div>
  );
}
