interface SignatureSectionProps {
  label: string;
}

export function SignatureSection({ label }: SignatureSectionProps) {
  return (
    <section className="document-avoid-break mt-2 w-[72mm] shrink-0 text-center">
      <svg
        viewBox="0 0 200 48"
        className="mx-auto h-10 w-40 text-[var(--doc-enterprise-blue)]"
        aria-hidden="true"
      >
        <path
          d="M8 32 C 28 8, 48 40, 68 24 S 108 8, 128 28 S 168 40, 192 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <hr className="mx-auto mt-1 w-36 border-0 border-t border-dotted border-[var(--doc-enterprise-blue)]" />
      <p className="mt-1 text-[8pt] font-semibold doc-blue">{label}</p>
    </section>
  );
}
