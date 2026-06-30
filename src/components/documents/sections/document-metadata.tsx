import type { ReactNode } from "react";

export interface DocumentMetadataField {
  label: string;
  value: string;
}

interface DocumentMetadataProps {
  /** Large reference number displayed prominently (invoice no., receipt no., etc.). */
  primaryReference: string;
  fields: DocumentMetadataField[];
  /** Party block(s) rendered on the left — use {@link DocumentParties}. */
  parties?: ReactNode;
}

/**
 * Document header metadata grid — parties on the left, reference + fields on the right.
 * Shared by Invoice, Money Receipt, and future printable documents.
 */
export function DocumentMetadata({
  primaryReference,
  fields,
  parties,
}: DocumentMetadataProps) {
  return (
    <section className="document-avoid-break mb-2 grid grid-cols-[1fr_auto] gap-3">
      {parties ? <div className="min-w-0">{parties}</div> : <div />}

      <div className="min-w-[38mm] text-right">
        <p className="text-[14pt] font-bold leading-none text-[var(--doc-text)]">
          {primaryReference}
        </p>
        <dl className="mt-1.5 space-y-0.5 text-[8pt]">
          {fields.map((field) => (
            <div key={field.label} className="flex justify-end gap-2">
              <dt className="font-semibold doc-blue">{field.label}:</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
