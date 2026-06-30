import type { DocumentPartyDTO } from "@/types/document";

export interface DocumentPartyBlock {
  label: string;
  party: DocumentPartyDTO;
}

interface DocumentPartyItemProps {
  label: string;
  party: DocumentPartyDTO;
}

function DocumentPartyItem({ label, party }: DocumentPartyItemProps) {
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

interface DocumentPartiesProps {
  parties: DocumentPartyBlock[];
}

/** One or more party blocks (Bill To, Ship To, Received From, etc.). */
export function DocumentParties({ parties }: DocumentPartiesProps) {
  return (
    <div
      className={
        parties.length > 1 ? "grid min-w-0 grid-cols-2 gap-3" : "min-w-0"
      }
    >
      {parties.map((block) => (
        <DocumentPartyItem key={block.label} label={block.label} party={block.party} />
      ))}
    </div>
  );
}
