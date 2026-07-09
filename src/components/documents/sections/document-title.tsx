interface DocumentTitleProps {
  title: string;
}

/** Centered document title — the strongest typographic element below the header. */
export function DocumentTitle({ title }: DocumentTitleProps) {
  return (
    <section className="document-avoid-break my-2.5">
      <hr className="doc-hr mb-2" />
      <h1
        className="text-center font-black doc-blue"
        style={{ fontSize: "17pt", letterSpacing: "0.12em" }}
      >
        {title}
      </h1>
      <hr className="doc-hr mt-2" />
    </section>
  );
}
