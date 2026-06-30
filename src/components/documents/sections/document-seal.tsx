interface DocumentSealProps {
  label: string;
}

/** Reserved company seal area — digital seal image hook for future phases. */
export function DocumentSeal({ label }: DocumentSealProps) {
  return (
    <section
      className="document-avoid-break mt-2 w-[72mm] shrink-0 text-center"
      data-document-seal=""
      aria-label={label}
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-[var(--doc-enterprise-blue)]">
        <span className="text-[7pt] font-semibold uppercase tracking-wide doc-blue">
          {label}
        </span>
      </div>
    </section>
  );
}
