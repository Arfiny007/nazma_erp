interface DocumentNotesProps {
  title: string;
  text: string;
}

export function DocumentNotes({ title, text }: DocumentNotesProps) {
  return (
    <section className="document-avoid-break min-w-0 flex-1">
      <hr className="doc-hr mb-1" />
      <p className="mb-0.5 text-[8.5pt] font-bold doc-blue">{title}</p>
      <p className="text-[8pt] leading-snug text-[var(--doc-muted)]">{text}</p>
    </section>
  );
}
