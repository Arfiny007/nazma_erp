interface InvoiceTitleProps {
  title: string;
}

export function InvoiceTitle({ title }: InvoiceTitleProps) {
  return (
    <section className="document-avoid-break my-2">
      <hr className="doc-hr mb-1.5" />
      <h1 className="text-center text-[16pt] font-bold tracking-[0.08em] doc-blue">{title}</h1>
      <hr className="doc-hr mt-1.5" />
    </section>
  );
}
